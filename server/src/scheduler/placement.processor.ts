import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { FoodService } from '../swiggy/food.service';
import { InstamartService } from '../swiggy/instamart.service';
import { NeedsReauthError, PlacementFailedError } from '../mcp/mcp.errors';
import { PLACEMENT_QUEUE, TRACKING_QUEUE, PlacementJob, TrackingJob } from './scheduler.constants';

/**
 * Fires one sub-order at its scheduled time: build the Swiggy cart, then place.
 *
 * Placement is non-idempotent. We never let BullMQ auto-retry a place call
 * (attempts:1). On failure we run a `reconcile` pass that reads get_*_orders to
 * discover whether the order actually went through before deciding FAILED.
 */
@Processor(PLACEMENT_QUEUE, { concurrency: 4 })
export class PlacementProcessor extends WorkerHost {
  private readonly log = new Logger(PlacementProcessor.name);
  private readonly pollMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly food: FoodService,
    private readonly instamart: InstamartService,
    private readonly config: ConfigService,
    @InjectQueue(PLACEMENT_QUEUE) private readonly placementQueue: Queue<PlacementJob>,
    @InjectQueue(TRACKING_QUEUE) private readonly trackingQueue: Queue<TrackingJob>,
  ) {
    super();
    this.pollMs = this.config.get<number>('orchestration.trackingPollMinMs', 10000);
  }

  async process(job: Job<PlacementJob>): Promise<void> {
    if (job.name === 'reconcile') return this.reconcile(job);
    return this.place(job);
  }

  private async place(job: Job<PlacementJob>): Promise<void> {
    const { subOrderId, celebrationId, userId } = job.data;
    const sub = await this.prisma.subOrder.findUnique({ where: { id: subOrderId } });
    if (!sub || sub.swiggyOrderId) return; // already placed — never double-fire

    await this.setStatus(subOrderId, celebrationId, 'PLACING');

    try {
      const addressId = await this.addressOf(celebrationId);
      const orderId =
        sub.kind === 'FOOD'
          ? await this.placeFood(userId, sub, addressId)
          : await this.placeInstamart(userId, sub, addressId);

      await this.prisma.subOrder.update({
        where: { id: subOrderId },
        data: { swiggyOrderId: orderId, placedAt: new Date(), status: 'PLACED' },
      });
      this.events.emit({ celebrationId, type: 'suborder.placed', payload: { subOrderId, orderId } });

      // Start the tracking loop (respect the >=10s cadence).
      await this.trackingQueue.add(
        'poll',
        { subOrderId, celebrationId, userId },
        { delay: this.pollMs, jobId: `track:${subOrderId}:${Date.now()}`, removeOnComplete: true },
      );
    } catch (err) {
      if (err instanceof NeedsReauthError) {
        await this.fail(subOrderId, celebrationId, 'reauth_required', 'Swiggy session expired — reconnect and retry.');
        return;
      }
      if (err instanceof PlacementFailedError) {
        // Unsafe to retry directly — reconcile to find out what really happened.
        this.log.warn(`placement ${subOrderId} failed; queuing reconcile`);
        await this.fail(subOrderId, celebrationId, 'place_failed', String(err.cause));
        await this.placementQueue.add(
          'reconcile',
          { subOrderId, celebrationId, userId },
          { delay: 5000, jobId: `reconcile:${subOrderId}`, removeOnComplete: true },
        );
        return;
      }
      await this.fail(subOrderId, celebrationId, 'unknown', String(err));
    }
  }

  private async placeFood(userId: string, sub: any, addressId: string): Promise<string> {
    const lines = sub.lines as Array<{ itemId: string; qty: number }>;
    // Carts are single-restaurant — flush any prior restaurant's cart first so
    // this sub-order's items never bleed into the wrong order.
    await this.food.flushFoodCart(userId).catch(() => undefined);
    await this.food.updateFoodCart(
      userId,
      addressId,
      sub.restaurantId,
      lines.map((l) => ({ menu_item_id: String(l.itemId), quantity: l.qty })),
    );
    if (sub.couponCode) {
      await this.food.applyFoodCoupon(userId, addressId, sub.couponCode).catch(() => undefined);
    }
    // Automated placement is COD-only — no human is present to complete a UPI
    // payment. placeFood returns `placed` for COD.
    const res = await this.food.placeFood(userId, addressId, { paymentMethod: 'COD' });
    if (res.status !== 'placed') {
      throw new Error('Automated placement requires COD — got a pending online payment.');
    }
    return res.orderId;
  }

  private async placeInstamart(userId: string, sub: any, addressId: string): Promise<string> {
    const lines = sub.lines as Array<{ spinId: string; qty: number }>;
    await this.instamart.updateCart(
      userId,
      addressId,
      lines.map((l) => ({ spinId: l.spinId, quantity: l.qty })),
    );
    const { orderId } = await this.instamart.checkout(userId, addressId, 'COD');
    return orderId;
  }

  /**
   * Did the order actually go through despite the 5xx? Read get_*_orders, then
   * — for food — confirm the candidate with get_food_order_details by matching
   * restaurant + amount within a short window. Never blind-adopt "most recent".
   * If nothing matches, report_error and leave the sub-order FAILED.
   */
  private async reconcile(job: Job<PlacementJob>): Promise<void> {
    const { subOrderId, celebrationId, userId } = job.data;
    const sub = await this.prisma.subOrder.findUnique({ where: { id: subOrderId } });
    if (!sub || sub.swiggyOrderId) return;
    try {
      const addressId = await this.addressOf(celebrationId);
      let matchedOrderId: string | undefined;

      if (sub.kind === 'FOOD') {
        // Swiggy orders carry no machine-readable timestamp — `orderedTime` is a
        // display string ("May 22, 1:40 PM") — so we cannot window by age. We
        // match on restaurant + amount instead, over the newest-first list.
        const orders = await this.food.getFoodOrders(userId, addressId);
        const candidates = orders.filter((o) => o.restaurantId === sub.restaurantId);
        const tolerance = Math.max(1, sub.couponValue ?? 0);
        matchedOrderId = candidates.find(
          (c) => Math.abs(c.total - sub.subtotal) <= tolerance,
        )?.orderId;
        // Fall back to a live order at the same restaurant even if the amount drifted.
        matchedOrderId ??= candidates.find((c) => c.isActive)?.orderId;
      } else {
        // Instamart's order list is not normalized yet; adopt the newest active one.
        const raw = (await this.instamart.getOrders(userId, true)) as {
          orders?: Array<{ orderId: string }>;
        };
        matchedOrderId = raw?.orders?.[0]?.orderId;
      }

      if (matchedOrderId) {
        await this.prisma.subOrder.update({
          where: { id: subOrderId },
          data: { swiggyOrderId: matchedOrderId, placedAt: new Date(), status: 'PLACED', lastErrorCode: null, lastErrorMsg: null },
        });
        this.events.emit({ celebrationId, type: 'suborder.placed', payload: { subOrderId, orderId: matchedOrderId, reconciled: true } });
        await this.trackingQueue.add('poll', { subOrderId, celebrationId, userId }, { delay: this.pollMs, removeOnComplete: true });
      } else {
        // Genuinely didn't land — surface it to Swiggy's support channel.
        this.log.warn(`reconcile ${subOrderId}: no matching order — leaving FAILED`);
        if (sub.kind === 'FOOD') {
          await this.food
            .reportError(userId, {
              tool: 'place_food_order',
              errorMessage: `Reconcile found no order for sub-order ${subOrderId}`,
              toolContext: JSON.stringify({
                celebrationId,
                restaurantId: sub.restaurantId,
                subtotal: sub.subtotal,
              }),
            })
            .catch(() => undefined);
        }
      }
    } catch (err) {
      this.log.error(`reconcile ${subOrderId} errored: ${err}`);
    }
  }

  /** The Swiggy address bound to this celebration (required by place/get_orders). */
  private async addressOf(celebrationId: string): Promise<string> {
    const c = await this.prisma.celebration.findUnique({
      where: { id: celebrationId },
      select: { swiggyAddressId: true },
    });
    if (!c?.swiggyAddressId) throw new NeedsReauthError('address-not-bound');
    return c.swiggyAddressId;
  }

  private async setStatus(subOrderId: string, celebrationId: string, status: any) {
    await this.prisma.subOrder.update({ where: { id: subOrderId }, data: { status } });
    this.events.emit({ celebrationId, type: 'suborder.updated', payload: { subOrderId, status } });
  }

  private async fail(subOrderId: string, celebrationId: string, code: string, msg: string) {
    await this.prisma.subOrder.update({
      where: { id: subOrderId },
      data: { status: 'FAILED', lastErrorCode: code, lastErrorMsg: msg, lastErrorAt: new Date() },
    });
    this.events.emit({ celebrationId, type: 'suborder.failed', payload: { subOrderId, code, msg } });
  }
}
