import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { OrdersService } from './orders.service';
import type { AuthUser } from '../auth/decorators';
import type { InvoicingService } from '../invoicing/invoicing.service';
import type { PricingService } from '../pricing/pricing.service';

/**
 * The mealbox flow identifies a customer by the phone number they proved with
 * an OTP. These tests pin that the number is taken from the token and nowhere
 * else — the body used to choose it, and the path used to choose whose history
 * was returned.
 */
describe('OrdersService — customer identity', () => {
  const CUSTOMER: AuthUser = { phone: '9876543210', isAdmin: false };
  const OTHER: AuthUser = { phone: '9000000001', isAdmin: false };
  const STAFF: AuthUser = { phone: '9111111111', isAdmin: true, type: 'admin' };
  const ID = new Types.ObjectId().toHexString();

  function build() {
    const created: any[] = [];
    const model: any = {
      create: jest.fn(async (doc: any) => {
        created.push(doc);
        return { ...doc, _id: ID, toObject: () => ({ ...doc, _id: ID }) };
      }),
      findById: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      countDocuments: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };
    const invoicing = { allocate: jest.fn() } as unknown as InvoicingService;
    const pricing = { computeOrderPricing: jest.fn().mockReturnValue({ total: 0 }) } as unknown as PricingService;
    const service = new OrdersService(model, invoicing, pricing);
    return { service, model, created };
  }

  const orderDoc = (phone: string) => ({
    _id: ID,
    order: { customerData: { phone, name: 'Asha' } },
  });

  describe('create', () => {
    it('overwrites a client-supplied phone with the verified one', async () => {
      const { service, created } = build();

      await service.create(
        { date: '2026-12-01', customerData: { name: 'Asha', phone: '9999999999' } },
        CUSTOMER.phone,
      );

      expect(created[0].order.customerData.phone).toBe('9876543210');
    });

    it('refuses an order with no verified number behind it', async () => {
      const { service } = build();

      await expect(service.create({ date: '2026-12-01' }, '')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    /**
     * The idempotency key is client-chosen and the unique index is global, so
     * without namespacing, a guessed key would return another customer's order.
     */
    it('namespaces the idempotency key to the customer', async () => {
      const { service, model } = build();
      model.findOneAndUpdate.mockReturnValue({
        lean: () => ({ exec: async () => ({ _id: ID }) }),
      });

      await service.create({ date: '2026-12-01', idempotencyKey: 'checkout-1' }, CUSTOMER.phone);

      expect(model.findOneAndUpdate.mock.calls[0][0]).toEqual({
        idempotencyKey: '9876543210:checkout-1',
      });
    });
  });

  describe('findByIdFor', () => {
    it('gives a customer their own order', async () => {
      const { service, model } = build();
      model.findById.mockReturnValue({ lean: () => ({ exec: async () => orderDoc('9876543210') }) });

      await expect(service.findByIdFor(ID, CUSTOMER)).resolves.toMatchObject({ _id: ID });
    });

    it("hides another customer's order behind a null, not a 403", async () => {
      const { service, model } = build();
      model.findById.mockReturnValue({ lean: () => ({ exec: async () => orderDoc('9876543210') }) });

      await expect(service.findByIdFor(ID, OTHER)).resolves.toBeNull();
    });

    it('lets staff read any order', async () => {
      const { service, model } = build();
      model.findById.mockReturnValue({ lean: () => ({ exec: async () => orderDoc('9876543210') }) });

      await expect(service.findByIdFor(ID, STAFF)).resolves.toMatchObject({ _id: ID });
    });
  });

  describe('findByPhoneFor', () => {
    it('refuses to hand a customer somebody else’s order history', async () => {
      const { service } = build();

      await expect(service.findByPhoneFor('9000000001', CUSTOMER)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('accepts the same number written with a country code', async () => {
      const { service, model } = build();
      model.find.mockReturnValue({
        sort: () => ({ lean: () => ({ exec: async () => [] }) }),
      });

      await expect(service.findByPhoneFor('+919876543210', CUSTOMER)).resolves.toEqual([]);
    });

    it('lets staff look up any customer', async () => {
      const { service, model } = build();
      model.find.mockReturnValue({
        sort: () => ({ lean: () => ({ exec: async () => [orderDoc('9000000001')] }) }),
      });

      await expect(service.findByPhoneFor('9000000001', STAFF)).resolves.toHaveLength(1);
    });
  });
});
