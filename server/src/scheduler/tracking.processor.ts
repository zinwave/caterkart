import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { FoodService } from '../swiggy/food.service';
import { InstamartService } from '../swiggy/instamart.service';
import type { TrackingState } from '../mcp/mcp.types';
import { SubOrderStatus } from '@prisma/client';
import { TRACKING_QUEUE, TrackingJob } from './scheduler.constants';

const STATUS_MAP: Record<TrackingState['status'], SubOrderStatus> = {
  PLACED: 'PLACED',
  PREPARING: 'PREPARING',
  PICKED_UP: 'ON_THE_WAY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
};

/**
 * Polls one order's status no faster than TRACKING_POLL_MIN_MS (Swiggy: >=10s),
 * records each transition, and self-re-enqueues until the order is terminal.
 * When every sub-order in a celebration is terminal, the celebration completes.
 */
@Processor(TRACKING_QUEUE, { concurrency: 8 })
export class TrackingProcessor extends WorkerHost {
  private readonly log = new Logger(TrackingProcessor.name);
  private readonly pollMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly food: FoodService,
    private readonly instamart: InstamartService,
    private readonly config: ConfigService,
    @InjectQueue(TRACKING_QUEUE) private readonly trackingQueue: Queue<TrackingJob>,
  ) {
    super();
    this.pollMs = this.config.get<number>('orchestration.trackingPollMinMs', 10000);
  }

  async process(job: Job<TrackingJob>): Promise<void> {
    const { subOrderId, celebrationId, userId } = job.data;
    const sub = await this.prisma.subOrder.findUnique({ where: { id: subOrderId } });
    if (!sub || !sub.swiggyOrderId) return;
    if (sub.status === 'DELIVERED' || sub.status === 'CANCELLED') return;

    let tracking: TrackingState;
    try {
      tracking =
        sub.kind === 'FOOD'
          ? await this.food.trackFoodOrder(userId, sub.swiggyOrderId)
          : await this.instamart.trackOrder(userId, sub.swiggyOrderId);
    } catch (err) {
      this.log.warn(`track ${subOrderId} failed, will retry: ${err}`);
      await this.requeue(job.data);
      return;
    }

    const status = STATUS_MAP[tracking.status];
    const etaMinutes = 'etaMinutes' in tracking ? tracking.etaMinutes : null;

    await this.prisma.subOrder.update({
      where: { id: subOrderId },
      data: { status, etaMinutes },
    });
    await this.prisma.orderEvent.create({
      data: { subOrderId, status, etaMinutes, raw: tracking as any },
    });
    this.events.emit({ celebrationId, type: 'tracking', payload: { subOrderId, status, etaMinutes, tracking } });

    if (status === 'DELIVERED' || status === 'CANCELLED') {
      await this.maybeCompleteCelebration(celebrationId);
    } else {
      await this.requeue(job.data);
    }
  }

  private async requeue(data: TrackingJob): Promise<void> {
    await this.trackingQueue.add('poll', data, {
      delay: this.pollMs,
      jobId: `track:${data.subOrderId}:${Date.now()}`,
      removeOnComplete: true,
    });
  }

  private async maybeCompleteCelebration(celebrationId: string): Promise<void> {
    const subs = await this.prisma.subOrder.findMany({ where: { celebrationId } });
    const allTerminal = subs.every((s) =>
      ['DELIVERED', 'CANCELLED', 'FAILED'].includes(s.status),
    );
    if (!allTerminal) {
      await this.prisma.celebration.update({ where: { id: celebrationId }, data: { status: 'IN_FLIGHT' } });
      return;
    }
    const anyDelivered = subs.some((s) => s.status === 'DELIVERED');
    await this.prisma.celebration.update({
      where: { id: celebrationId },
      data: { status: anyDelivered ? 'COMPLETED' : 'FAILED' },
    });
    this.events.emit({ celebrationId, type: 'suborder.updated', payload: { celebrationStatus: anyDelivered ? 'COMPLETED' : 'FAILED' } });
  }
}
