import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PaymentsService } from './payments.service';
import type { ConfigService } from '@nestjs/config';
import type { PricingService } from '../pricing/pricing.service';

const WEBHOOK_SECRET = 'whsec_test_value';
const ORDER_ID = '6512c0f0a1b2c3d4e5f60718';

/**
 * Money paths. The two failure modes worth a test are both silent: a settlement
 * counted twice leaves an order showing as overpaid, and an unauthenticated
 * webhook would let anyone mark any order paid.
 */
describe('PaymentsService', () => {
  function build(doc: Record<string, unknown> | null = null) {
    const collection = {
      findOne: jest.fn().mockResolvedValue(doc),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const connection = { collection: () => collection } as never;
    const config = {
      get: (key: string) =>
        ({
          RAZORPAY_KEY_ID: 'rzp_test_key',
          RAZORPAY_KEY_SECRET: 'rzp_test_secret',
          RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
          RAZORPAY_CURRENCY: 'INR',
        })[key],
    } as unknown as ConfigService;
    const pricing = { computeOrderPricing: jest.fn() } as unknown as PricingService;

    const service = new PaymentsService(connection, config, pricing);
    jest.spyOn((service as never as { logger: { log: () => void; warn: () => void } }).logger, 'log').mockImplementation(() => undefined);
    jest.spyOn((service as never as { logger: { warn: () => void } }).logger, 'warn').mockImplementation(() => undefined);
    return { service, collection };
  }

  const sign = (body: string) => createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

  const capturedEvent = (amountPaise: number, paymentId = 'pay_1') =>
    JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: paymentId, amount: amountPaise, notes: { orderId: ORDER_ID } } } },
    });

  describe('handleWebhook', () => {
    it('rejects a forged signature', async () => {
      const { service, collection } = build({ _id: ORDER_ID });
      const body = capturedEvent(50_000);

      await expect(
        service.handleWebhook(Buffer.from(body), 'deadbeef'.repeat(8)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(collection.updateOne).not.toHaveBeenCalled();
    });

    it('rejects a signature of the right length but the wrong value', async () => {
      const { service } = build({ _id: ORDER_ID });
      const body = capturedEvent(50_000);
      const wrong = sign('a different body');

      await expect(service.handleWebhook(Buffer.from(body), wrong)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('records a genuine capture exactly once', async () => {
      const { service, collection } = build({
        _id: ORDER_ID,
        serverPricing: { total: 500 },
        paidPaymentIds: [],
      });
      const body = capturedEvent(50_000);

      await service.handleWebhook(Buffer.from(body), sign(body));

      // The settlement write must be the conditional one: the payment id is
      // part of the FILTER, which is what makes a replay a no-op.
      const [filter, update] = collection.updateOne.mock.calls[0];
      expect(filter).toMatchObject({ paidPaymentIds: { $ne: 'pay_1' } });
      expect(update.$inc).toEqual({ paidAmount: 500 });
    });

    /**
     * The webhook, the browser's verify call and a reconciliation sync all
     * report the same capture. The second one through must add no money.
     */
    it('adds nothing when the same payment arrives again', async () => {
      const { service, collection } = build({
        _id: ORDER_ID,
        serverPricing: { total: 500 },
        paidPaymentIds: ['pay_1'],
      });
      collection.updateOne.mockResolvedValue({ modifiedCount: 0 });
      const body = capturedEvent(50_000);

      await service.handleWebhook(Buffer.from(body), sign(body));

      // One attempt, which matched nothing — and no follow-up status write.
      expect(collection.updateOne).toHaveBeenCalledTimes(1);
      expect(collection.updateOne.mock.calls[0][1].$inc).toEqual({ paidAmount: 500 });
    });

    it('ignores events it does not settle on', async () => {
      const { service, collection } = build({ _id: ORDER_ID });
      const body = JSON.stringify({ event: 'payment.failed', payload: {} });

      await service.handleWebhook(Buffer.from(body), sign(body));

      expect(collection.updateOne).not.toHaveBeenCalled();
    });

    it('refuses to run at all when no webhook secret is configured', async () => {
      const collection = { findOne: jest.fn(), updateOne: jest.fn() };
      const service = new PaymentsService(
        { collection: () => collection } as never,
        { get: () => undefined } as unknown as ConfigService,
        { computeOrderPricing: jest.fn() } as unknown as PricingService,
      );
      jest.spyOn((service as never as { logger: { warn: () => void } }).logger, 'warn').mockImplementation(() => undefined);

      await expect(service.handleWebhook(Buffer.from('{}'), 'anything')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('ownership', () => {
    it("will not open a payment intent on another customer's order", async () => {
      const { service } = build({
        _id: ORDER_ID,
        order: { customerData: { phone: '9876543210' } },
      });

      await expect(
        service.createOrderPayment(ORDER_ID, 'advance', { phone: '9000000001', isAdmin: false }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
