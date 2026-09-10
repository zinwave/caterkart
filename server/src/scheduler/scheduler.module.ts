import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SwiggyModule } from '../swiggy/swiggy.module';
import { SchedulerService } from './scheduler.service';
import { PlacementPlannerService } from './placement-planner.service';
import { PlacementProcessor } from './placement.processor';
import { TrackingProcessor } from './tracking.processor';
import { PLACEMENT_QUEUE, TRACKING_QUEUE } from './scheduler.constants';

@Module({
  imports: [
    SwiggyModule,
    BullModule.registerQueue({ name: PLACEMENT_QUEUE }, { name: TRACKING_QUEUE }),
  ],
  providers: [SchedulerService, PlacementPlannerService, PlacementProcessor, TrackingProcessor],
  exports: [SchedulerService, PlacementPlannerService],
})
export class SchedulerModule {}
