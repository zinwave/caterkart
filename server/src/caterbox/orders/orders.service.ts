// src/orders/orders.service.ts
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { OrdersDocument, OrdersModelName } from './orders.schema';
import { InvoicingService } from '../invoicing/invoicing.service';
import { PricingService } from '../pricing/pricing.service';
import type { AuthUser } from '../auth/decorators';

/** Last 10 digits, which is how Indian numbers are stored and compared here. */
function last10(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '').slice(-10);
}

/**
 * A checkout-retry key that can only ever collide with the same customer.
 *
 * Returns undefined when the client sent none, which falls back to a plain
 * insert (legacy clients).
 */
function idempotencyKeyFrom(raw: unknown, phone: string): string | undefined {
  if (typeof raw !== 'string' || !raw.trim() || !phone) return undefined;
  return `${phone}:${raw.trim().slice(0, 100)}`;
}

const ALLOWED_UPDATE_FIELDS = new Set([
  'status',
  'manager',
  'remarks',
  'vendors',
  'payments',
  'date',
  'order',
]);

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(OrdersModelName) private readonly orderModel: Model<OrdersDocument>,
    private readonly invoicing: InvoicingService,
    private readonly pricing: PricingService,
  ) {}

  /**
   * Allocate a sequential number into a specific field of an order, exactly once.
   * Idempotent: if the field is already set it's returned unchanged. The number
   * is written only while the field is empty (guards concurrent double-assign).
   */
  private async allocateOnce(
    id: string,
    field: 'invoiceNo' | 'commissionInvoiceNo' | 'payoutNo',
    type: 'ORD' | 'COM' | 'PAY',
  ): Promise<string> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Order with id ${id} not found`);
    }
    const order: any = await (this.orderModel as any).findById(id).lean().exec();
    if (!order) throw new NotFoundException(`Order with id ${id} not found`);
    if (order[field]) return order[field];

    const dateStr = order.date || order.order?.date;
    const number = await this.invoicing.allocate(type, dateStr);

    const updated: any = await (this.orderModel as any)
      .findOneAndUpdate(
        { _id: id, [field]: { $exists: false } },
        { $set: { [field]: number } },
        { new: true },
      )
      .lean()
      .exec();

    // Lost a concurrent race — return whoever's number won (the allocated seq is
    // discarded; this can leave a rare gap, acceptable for invoice numbering).
    if (!updated) {
      const fresh: any = await (this.orderModel as any).findById(id).lean().exec();
      return fresh?.[field] || number;
    }
    return number;
  }

  // Sequential customer food tax-invoice number (series ORD).
  async assignInvoice(id: string): Promise<{ invoiceNo: string }> {
    return { invoiceNo: await this.allocateOnce(id, 'invoiceNo', 'ORD') };
  }

  // Sequential vendor commission tax-invoice number (series COM).
  async assignCommissionInvoice(id: string): Promise<{ commissionInvoiceNo: string }> {
    return { commissionInvoiceNo: await this.allocateOnce(id, 'commissionInvoiceNo', 'COM') };
  }

  // Sequential vendor payout-statement number (series PAY).
  async assignPayoutNo(id: string): Promise<{ payoutNo: string }> {
    return { payoutNo: await this.allocateOnce(id, 'payoutNo', 'PAY') };
  }

  /**
   * File an order for a customer whose phone number has been proved by OTP.
   *
   * `verifiedPhone` comes from the JWT, never from the payload. The body still
   * carries `customerData` (name, address, event details) because the quote is
   * a flexible blob, but the phone inside it is overwritten: it is the key the
   * order is later retrieved by, so letting the client choose it would let
   * anyone file orders under — and therefore read orders belonging to — someone
   * else's number.
   */
  async create(order: any, verifiedPhone: string): Promise<any> {
    try {
      if (!order || typeof order !== 'object') {
        throw new BadRequestException('Invalid order payload');
      }

      const phone = last10(verifiedPhone);
      if (phone.length !== 10) {
        throw new BadRequestException('A verified phone number is required to place an order');
      }
      // Written into both shapes the rest of the codebase reads from, so the
      // lookup in findByPhone matches regardless of which the client sent.
      order.customerData = { ...(order.customerData ?? {}), phone };
      if (order.customer && typeof order.customer === 'object') {
        order.customer = { ...order.customer, phone };
      }

      const vendorTemplate = () => ({
        vendor: null,
        finalPayment: 0,
        vendorPayout: 0,
        taxes: 0,
        PAT: 0,
      });

      const vendors: Record<string, any> = { caterer: vendorTemplate() };

      if (Array.isArray(order?.services)) {
        order.services.forEach((service: any, idx: number) => {
          const key =
            typeof service?.title === 'string' && service.title.trim()
              ? service.title
              : `service_${idx + 1}`;
          vendors[key] = vendorTemplate();
        });
      }

      const payments = {
        finalPayment: 0,
        vendorPayout: 0,
        taxes: 0,
        PAT: 0,
      };

      // Idempotency: the client may send a stable key per checkout attempt.
      // A retry / double-submit with the same key returns the original order
      // instead of writing a duplicate (enforced by a unique partial index).
      //
      // The key is NAMESPACED to the verified phone before it touches the
      // unique index. The index is global, and the raw key is chosen by the
      // client: two customers colliding would hand one of them the other's
      // order document back, and a guessed key would do it on purpose. Prefixed
      // this way, a key can only ever match a retry by the same person.
      const idempotencyKey = idempotencyKeyFrom(order?.idempotencyKey, phone);

      const docToCreate: Record<string, any> = {
        vendors,
        payments,
        order,
        date: order.date,
        // Server-authoritative pricing (what we'll actually charge). Recomputed
        // from the order's line-item components — never trusted from the client.
        serverPricing: this.pricing.computeOrderPricing(order),
      };
      if (idempotencyKey) docToCreate.idempotencyKey = idempotencyKey;

      // Without a key, fall back to a plain insert (legacy behaviour).
      if (!idempotencyKey) {
        const createdDoc = await this.orderModel.create(docToCreate as any);
        const plain =
          typeof (createdDoc as any).toObject === 'function'
            ? (createdDoc as any).toObject()
            : createdDoc;
        this.logger.debug(`Order saved: ${plain?._id ?? '[no-id]'}`);
        return plain;
      }

      // Atomic upsert keyed by idempotencyKey: first call inserts, retries
      // match the existing doc and return it unchanged.
      const saved = await (this.orderModel as any)
        .findOneAndUpdate(
          { idempotencyKey },
          { $setOnInsert: docToCreate },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        )
        .lean()
        .exec();

      this.logger.debug(`Order upserted: ${saved?._id ?? '[no-id]'} (key=${idempotencyKey})`);
      return saved;
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      // Concurrent requests sharing an idempotency key race on the unique index;
      // the loser gets E11000 — return the order the winner already wrote.
      if (err?.code === 11000) {
        const key = idempotencyKeyFrom(order?.idempotencyKey, last10(verifiedPhone));
        if (key) {
          const existing = await (this.orderModel as any)
            .findOne({ idempotencyKey: key })
            .lean()
            .exec();
          if (existing) return existing;
        }
      }
      this.logger.error('Failed to store order', err);
      throw new InternalServerErrorException('Failed to store order');
    }
  }

  async findAll(opts: { page?: number; limit?: number; status?: string } = {}): Promise<{
    data: any[];
    page: number;
    limit: number;
    total: number;
  }> {
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(opts.limit) || 50));
    const filter: Record<string, any> = {};
    if (opts.status && typeof opts.status === 'string') {
      filter.status = opts.status;
    }

    try {
      const [data, total] = await Promise.all([
        (this.orderModel as any)
          .find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean()
          .exec() as Promise<any[]>,
        this.orderModel.countDocuments(filter).exec(),
      ]);
      return { data: data as any[], page, limit, total };
    } catch (err) {
      this.logger.error('Failed to fetch all orders', err);
      throw new InternalServerErrorException('Failed to fetch orders');
    }
  }

  /**
   * One order, for a caller entitled to see it.
   *
   * Staff see any order. A customer sees only an order filed against their own
   * verified number — and a mismatch answers 404, not 403, so the response
   * cannot be used to confirm that an id exists.
   */
  async findByIdFor(id: string, user: AuthUser): Promise<any | null> {
    const order = await this.findById(id);
    if (!order) return null;
    if (user.isAdmin) return order;

    const caller = last10(user.phone);
    if (!caller || caller !== this.customerPhoneOf(order)) return null;
    return order;
  }

  /**
   * Order history for one number, for a caller entitled to it.
   *
   * Staff may look up anyone (the ops console does). A customer may look up
   * only themselves, whatever number they put in the path.
   */
  async findByPhoneFor(phone: string, user: AuthUser): Promise<any[]> {
    const requested = last10(phone);
    if (requested.length !== 10) {
      throw new BadRequestException('A valid 10-digit phone number is required');
    }
    if (!user.isAdmin && requested !== last10(user.phone)) {
      throw new ForbiddenException('You can only view orders placed with your own number');
    }
    return this.findByPhone(requested);
  }

  /** The customer phone on an order, across the shapes it has been stored in. */
  private customerPhoneOf(order: any): string {
    return last10(
      order?.order?.customerData?.phone ??
        order?.order?.customer?.phone ??
        order?.customerData?.phone,
    );
  }

  async findById(id: string): Promise<any | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    try {
      return await (this.orderModel as any).findById(id).lean().exec();
    } catch (err) {
      this.logger.error(`Failed to fetch order by id ${id}`, err);
      throw new InternalServerErrorException('Failed to fetch order');
    }
  }

  /**
   * Orders whose customer phone matches the given number (last 10 digits).
   *
   * Internal: callers must have established that the requester is entitled to
   * this number — see findByPhoneFor, which is what the HTTP layer uses.
   */
  async findByPhone(phone: string): Promise<any[]> {
    const digits = last10(phone);
    if (digits.length !== 10) {
      throw new BadRequestException('A valid 10-digit phone number is required');
    }
    try {
      // `digits` is stripped to [0-9] above, so it carries no regex metacharacters.
      const re = new RegExp(`${digits}$`);
      const docs = await (this.orderModel as any)
        .find({
          $or: [
            { 'order.customerData.phone': re },
            { 'order.customer.phone': re },
            { 'customerData.phone': re },
          ],
        })
        .sort({ createdAt: -1, _id: -1 })
        .lean()
        .exec();
      return docs || [];
    } catch (err) {
      this.logger.error(`Failed to fetch orders for phone`, err);
      throw new InternalServerErrorException('Failed to fetch orders');
    }
  }

  async update(id: string, body: any): Promise<any | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Invalid payload for update');
    }

    // Whitelist allowed fields to prevent mass-assignment.
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(body)) {
      if (ALLOWED_UPDATE_FIELDS.has(k)) sanitized[k] = v;
    }

    if (Object.keys(sanitized).length === 0) {
      throw new BadRequestException('No updatable fields in payload');
    }

    // If the order body changed (e.g. admin edited items or the negotiated
    // discount), recompute the server-authoritative pricing alongside it. This
    // is a staff-only route (@Staff), so the admin's confirmed final total wins.
    if (sanitized.order && typeof sanitized.order === 'object') {
      sanitized.serverPricing = this.pricing.computeOrderPricing(sanitized.order, {
        trustFinal: true,
      });
    }

    try {
      // Atomic: single op, no read-then-write race.
      const updated = await (this.orderModel as any)
        .findByIdAndUpdate(id, { $set: sanitized }, { new: true, runValidators: true })
        .lean()
        .exec();

      if (!updated) {
        throw new NotFoundException(`Order with id ${id} not found`);
      }

      this.logger.debug(`Order updated: ${id}`);
      return updated;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error('Failed to update order', err);
      throw new InternalServerErrorException('Failed to update order');
    }
  }
}
