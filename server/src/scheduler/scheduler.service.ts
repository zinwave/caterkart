import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { CelebrationAccessService } from '../celebrations/celebration-access.service';
import { PlacementPlannerService, PlannableSubOrder } from './placement-planner.service';
import { PLACEMENT_QUEUE, PlacementJob } from './scheduler.constants';

/**
 * Computes a PlacementPlan for a celebration and schedules each sub-order's
 * placement as a delayed BullMQ job. Durable: if the process restarts, the jobs
 * are still in Redis and fire on time.
 */
@Injectable()
export class SchedulerService {
  private readonly log = new Logger(SchedulerService.name);

  constructor(
    @InjectQueue(PLACEMENT_QUEUE) private readonly placementQueue: Queue<PlacementJob>,
    private readonly prisma: PrismaService,
    private readonly planner: PlacementPlannerService,
    private readonly events: EventsService,
    private readonly access: CelebrationAccessService,
  ) {}

  /**
   * Validate, compute the plan, persist it, and queue every placement.
   *
   * `userId` is both the authorization subject AND the Swiggy grant the orders
   * are placed on, which is why the host check below is not optional: without
   * it, any signed-in user could fire somebody else's celebration, and anyone
   * who had quietly added sub-orders to a celebration could have the host pay
   * for them.
   */
  async planAndPlace(celebrationId: string, userId: string) {
    await this.access.assertHost(celebrationId, userId);

    const c = await this.prisma.celebration.findUnique({
      where: { id: celebrationId },
      include: { subOrders: true },
    });
    if (!c) throw new BadRequestException('celebration not found');
    if (!c.swiggyAddressId) throw new BadRequestException('Bind a Swiggy address before placing');
    if (!c.subOrders.length) throw new BadRequestException('No sub-orders to place');

    // Placement is NOT idempotent — Swiggy creates a real order per call. A
    // double-submit (impatient tap, retried request) must not queue the same
    // sub-orders twice, so anything past PLANNING is refused outright rather
    // than re-planned.
    if (c.status !== 'PLANNING') {
      throw new BadRequestException(
        `This celebration is already ${c.status.toLowerCase().replace('_', ' ')}.`,
      );
    }

    const overCap = c.subOrders.find((s) => s.capExceeded);
    if (overCap) {
      throw new BadRequestException(
        `Sub-order ${overCap.id} exceeds the ₹1000 food cap — split it before placing.`,
      );
    }

    const plannable: PlannableSubOrder[] = c.subOrders.map((s) => ({
      id: s.id,
      kind: s.kind,
      estimatedEtaMin: this.planner.defaultEta(s.kind, s.etaMinutes),
    }));

    const t0 = Date.now();
    const plan = this.planner.compute(plannable, t0);

    // Persist plan (replace any prior one).
    await this.prisma.placementPlan.deleteMany({ where: { celebrationId } });
    await this.prisma.placementPlan.create({
      data: {
        celebrationId,
        targetConvergenceMin: plan.targetConvergenceMin,
        preDropLeadMin: plan.preDropLeadMin,
        entries: {
          create: plan.entries.map((e) => ({
            subOrderId: e.subOrderId,
            estimatedEtaMin: e.estimatedEtaMin,
            fireAt: new Date(e.fireAtMs),
          })),
        },
      },
    });

    await this.prisma.celebration.update({ where: { id: celebrationId }, data: { status: 'PLACING' } });

    // Queue each placement with the computed delay; mark sub-orders QUEUED.
    for (const e of plan.entries) {
      const delay = Math.max(0, e.fireAtMs - Date.now());
      await this.prisma.subOrder.update({
        where: { id: e.subOrderId },
        data: { status: 'QUEUED', scheduledFor: new Date(e.fireAtMs), placementOffsetMs: e.fireAtMs - t0 },
      });
      await this.placementQueue.add(
        'place',
        { subOrderId: e.subOrderId, celebrationId, userId },
        { delay, jobId: `place:${e.subOrderId}`, attempts: 1, removeOnComplete: true },
      );
      this.log.log(`queued placement ${e.subOrderId} in ${Math.round(delay / 1000)}s`);
    }

    this.events.emit({ celebrationId, type: 'plan.computed', payload: plan });
    return this.prisma.placementPlan.findUnique({
      where: { celebrationId },
      include: { entries: true },
    });
  }
}
