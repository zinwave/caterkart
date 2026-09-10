import { Module } from '@nestjs/common';
import { CelebrationsService } from './celebrations.service';
import { CelebrationsController } from './celebrations.controller';
import { SwiggyModule } from '../swiggy/swiggy.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { SettlementModule } from '../settlement/settlement.module';
import { InvitesModule } from '../invites/invites.module';

// SchedulerModule (BullMQ/Redis) is opt-in — see app.module.ts. Without it the
// celebration "place" endpoint returns 503, but everything else works.
const QUEUES_ENABLED = process.env.ENABLE_QUEUES === 'true';

@Module({
  imports: [SwiggyModule, ...(QUEUES_ENABLED ? [SchedulerModule] : []), SettlementModule, InvitesModule],
  controllers: [CelebrationsController],
  providers: [CelebrationsService],
})
export class CelebrationsModule {}
