import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { FoodService } from '../swiggy/food.service';
import { EventsService } from '../events/events.service';
import { CelebrationAccessService } from './celebration-access.service';
import {
  AddFoodSubOrderDto,
  AddGuestDto,
  AddInstamartSubOrderDto,
  CreateCelebrationDto,
  UpdateGuestDto,
} from './dto';

/** Swiggy refuses an Instamart basket below this. Stop it here, not at placement. */
const INSTAMART_MINIMUM_RUPEES = 99;

/**
 * The host's side of a celebration.
 *
 * Every method that names a celebration takes the caller's user id and runs it
 * through CelebrationAccessService first. That is not defence in depth layered
 * over a guard — it IS the check, deliberately at the service boundary rather
 * than in a decorator, so a new controller route cannot acquire access to a
 * celebration by forgetting an annotation.
 */
@Injectable()
export class CelebrationsService {
  private readonly log = new Logger(CelebrationsService.name);
  private readonly cap: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly food: FoodService,
    private readonly events: EventsService,
    private readonly access: CelebrationAccessService,
  ) {
    this.cap = this.config.get<number>('orchestration.foodOrderCapRupees', 1000);
  }

  async create(userId: string, dto: CreateCelebrationDto) {
    await this.ensureUser(userId);

    // Validated here as well as in setAddress: the create payload can carry one
    // directly, and an id that is not on this account would only fail much
    // later, inside a queued placement job, where the user never sees it.
    if (dto.swiggyAddressId) await this.assertOwnAddress(userId, dto.swiggyAddressId);

    // The OAuth flow only knows the host as "Swiggy user"; their real name comes
    // from the app session. Guests see this on the invite, so keep it current.
    if (dto.hostName?.trim()) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { displayName: dto.hostName.trim() },
      });
    }

    const celebration = await this.prisma.celebration.create({
      data: {
        hostId: userId,
        occasion: dto.occasion,
        addressLabel: dto.addressLabel,
        swiggyAddressId: dto.swiggyAddressId,
        members: {
          create: dto.members.map((m, i) => ({
            name: m.name,
            phone: m.phone,
            isHost: m.isHost ?? i === 0,
          })),
        },
      },
      include: { members: true },
    });
    this.log.log(`celebration created ${celebration.id} (${dto.members.length} members)`);
    return celebration;
  }

  list(userId: string) {
    return this.prisma.celebration.findMany({
      where: { hostId: userId },
      orderBy: { createdAt: 'desc' },
      include: { members: true, subOrders: true },
    });
  }

  /** The full aggregate, for the host only. */
  async get(id: string, userId: string) {
    await this.access.assertHost(id, userId);
    const c = await this.prisma.celebration.findUnique({
      where: { id },
      include: {
        members: { include: { picks: true }, orderBy: { joinedAt: 'asc' } },
        subOrders: { include: { events: { orderBy: { at: 'desc' }, take: 5 } } },
        plan: { include: { entries: true } },
        settlement: { include: { shares: true } },
      },
    });
    if (!c) throw new NotFoundException('celebration not found');
    return c;
  }

  // ── Guests ────────────────────────────────────────────────────────────────

  /**
   * Add someone the host invited by email or phone. They exist as an INVITED
   * member straight away (so the host can see them in the list) and get their own
   * invite link — the guest fills in the rest when they open it.
   */
  async addGuest(celebrationId: string, userId: string, dto: AddGuestDto) {
    await this.access.assertHost(celebrationId, userId);

    return this.prisma.member.create({
      data: {
        celebrationId,
        name: dto.name.trim(),
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        dietary: dto.dietary ?? null,
        isKid: dto.isKid ?? false,
        status: 'INVITED',
      },
    });
  }

  async removeGuest(celebrationId: string, userId: string, memberId: string) {
    await this.access.assertHost(celebrationId, userId);
    const m = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!m || m.celebrationId !== celebrationId) throw new NotFoundException('member not found');
    if (m.isHost) throw new BadRequestException('cannot remove the host');
    await this.prisma.member.delete({ where: { id: memberId } });
    return { ok: true };
  }

  async updateGuest(
    celebrationId: string,
    userId: string,
    memberId: string,
    patch: UpdateGuestDto,
  ) {
    await this.access.assertHost(celebrationId, userId);
    const m = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!m || m.celebrationId !== celebrationId) throw new NotFoundException('member not found');
    return this.prisma.member.update({ where: { id: memberId }, data: patch });
  }

  /**
   * The host's REAL address book: everyone they have actually invited before,
   * across their past celebrations. There is no seeded friends list — a brand-new
   * host sees an empty state until they invite their first guest.
   */
  async contacts(userId: string) {
    const rows = await this.prisma.member.findMany({
      where: { celebration: { hostId: userId }, isHost: false },
      orderBy: { joinedAt: 'desc' },
      take: 200,
      select: { name: true, email: true, phone: true, dietary: true, joinedAt: true },
    });

    // Collapse to one entry per person (same email/phone, else same name).
    const byKey = new Map<
      string,
      { name: string; email?: string; phone?: string; dietary?: string; times: number; lastAt: Date }
    >();
    for (const r of rows) {
      const key = (r.email || r.phone || r.name).toLowerCase();
      const cur = byKey.get(key);
      if (cur) {
        cur.times += 1;
        continue;
      }
      byKey.set(key, {
        name: r.name,
        email: r.email ?? undefined,
        phone: r.phone ?? undefined,
        dietary: r.dietary ?? undefined,
        times: 1,
        lastAt: r.joinedAt,
      });
    }
    return [...byKey.values()].sort((a, b) => +b.lastAt - +a.lastAt);
  }

  /** List the user's Swiggy addresses so the host can bind one. */
  resolveAddresses(userId: string) {
    return this.food.getAddresses(userId);
  }

  /**
   * Bind the celebration to one of the host's own saved Swiggy addresses.
   *
   * The id is checked against their real address book rather than stored as
   * given: it is later used to place orders and to broker guest menu reads, so
   * an arbitrary string here would send a real order to an address the host
   * never chose.
   */
  async setAddress(id: string, userId: string, swiggyAddressId: string) {
    await this.access.assertHost(id, userId);
    await this.assertOwnAddress(userId, swiggyAddressId);
    return this.prisma.celebration.update({ where: { id }, data: { swiggyAddressId } });
  }

  /**
   * The address must be one Swiggy actually holds for this account.
   *
   * Swiggy scopes address ids to the authenticated account, so it would refuse
   * a foreign one anyway — but that refusal arrives inside a queued placement
   * job, long after the host has left the screen. Checking it at bind time
   * turns a silent failed order into an immediate, fixable message.
   */
  private async assertOwnAddress(userId: string, swiggyAddressId: string): Promise<void> {
    const addresses = await this.food.getAddresses(userId);
    if (!addresses.some((a) => String(a?.id) === swiggyAddressId)) {
      throw new BadRequestException('That address is not on your Swiggy account.');
    }
  }

  // ── Sub-orders ────────────────────────────────────────────────────────────

  async addFoodSubOrder(id: string, userId: string, dto: AddFoodSubOrderDto) {
    await this.assertEditable(id, userId);

    // Recomputed from the line items, never read from an aggregate the client
    // supplied: this total gates the ₹1,000 Swiggy cap and drives the
    // settlement split.
    const subtotal = dto.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    const capExceeded = subtotal > this.cap;

    const sub = await this.prisma.subOrder.create({
      data: {
        celebrationId: id,
        kind: 'FOOD',
        restaurantId: dto.restaurantId,
        restaurantName: dto.restaurantName,
        lines: dto.lines as unknown as object,
        subtotal,
        couponCode: dto.couponCode,
        capExceeded,
      },
    });
    this.events.emit({ celebrationId: id, type: 'suborder.updated', payload: sub });

    if (capExceeded) {
      // surfaced, not thrown — UI must split before placement.
      return {
        ...sub,
        warning: `Food order ₹${subtotal} exceeds the ₹${this.cap} per-order cap. Split into multiple orders.`,
      };
    }
    return sub;
  }

  async addInstamartSubOrder(id: string, userId: string, dto: AddInstamartSubOrderDto) {
    await this.assertEditable(id, userId);

    const subtotal = dto.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    if (subtotal < INSTAMART_MINIMUM_RUPEES) {
      throw new BadRequestException(`Instamart minimum order is ₹${INSTAMART_MINIMUM_RUPEES}`);
    }
    const sub = await this.prisma.subOrder.create({
      data: {
        celebrationId: id,
        kind: 'INSTAMART',
        lines: dto.lines as unknown as object,
        subtotal,
        // pre-drop lands first → negative offset applied by the planner
      },
    });
    this.events.emit({ celebrationId: id, type: 'suborder.updated', payload: sub });
    return sub;
  }

  async removeSubOrder(id: string, userId: string, subOrderId: string) {
    await this.assertEditable(id, userId);
    // Walks the sub-order back to its own celebration: the two path segments are
    // independent inputs, so a valid id of yours plus a stranger's sub-order id
    // would otherwise delete theirs.
    await this.access.assertHostOfSubOrder(id, subOrderId, userId);

    await this.prisma.subOrder.delete({ where: { id: subOrderId } });
    this.events.emit({
      celebrationId: id,
      type: 'suborder.updated',
      payload: { removed: subOrderId },
    });
    return { ok: true };
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async ensureUser(userId: string) {
    await this.prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, displayName: 'Host' },
      update: {},
    });
  }

  /**
   * Ownership AND a status that still permits edits.
   *
   * Once placement starts, the cart has been handed to Swiggy and queued jobs
   * are holding ids for sub-orders that existed at planning time. Adding or
   * removing one after that point silently desynchronises the plan from what is
   * actually being ordered, so it is refused outright.
   */
  private async assertEditable(celebrationId: string, userId: string) {
    const c = await this.access.assertHost(celebrationId, userId);
    if (c.status !== 'PLANNING') {
      throw new BadRequestException(
        `This celebration is already ${c.status.toLowerCase().replace('_', ' ')} and can no longer be edited.`,
      );
    }
    return c;
  }
}
