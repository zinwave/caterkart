import {
  Body, Controller, Delete, Get, Optional, Param, Post, Put, ServiceUnavailableException,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { CelebrationsService } from './celebrations.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { SettlementService } from '../settlement/settlement.service';
import { InvitesService } from '../invites/invites.service';
import {
  AddFoodSubOrderDto,
  AddInstamartSubOrderDto,
  CreateCelebrationDto,
  SettleDto,
} from './dto';

@Controller('celebrations')
export class CelebrationsController {
  constructor(
    private readonly celebrations: CelebrationsService,
    // Present only when ENABLE_QUEUES=true (needs Redis). Placement 503s otherwise.
    @Optional() private readonly scheduler: SchedulerService | undefined,
    private readonly settlement: SettlementService,
    private readonly invites: InvitesService,
  ) {}

  @Post()
  create(@CurrentUser() userId: string, @Body() dto: CreateCelebrationDto) {
    return this.celebrations.create(userId, dto);
  }

  @Get()
  list(@CurrentUser() userId: string) {
    return this.celebrations.list(userId);
  }

  /**
   * The host's real address book — people they have actually invited before.
   * Declared before `:id` so Nest doesn't match "contacts" as a celebration id.
   */
  @Get('contacts')
  contacts(@CurrentUser() userId: string) {
    return this.celebrations.contacts(userId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.celebrations.get(id);
  }

  @Put(':id/address')
  setAddress(@Param('id') id: string, @Body('swiggyAddressId') swiggyAddressId: string) {
    return this.celebrations.setAddress(id, swiggyAddressId);
  }

  // ── guests ──
  /** Add a guest (invited by email/phone) AND mint their personal invite link. */
  @Post(':id/guests')
  async addGuest(
    @Param('id') id: string,
    @Body() dto: { name: string; email?: string; phone?: string; dietary?: string; isKid?: boolean },
  ) {
    const member = await this.celebrations.addGuest(id, dto);
    const invite = await this.invites.create(id, member.id);
    return { member, invite };
  }

  @Put(':id/guests/:memberId')
  updateGuest(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() patch: { name?: string; dietary?: string; isKid?: boolean },
  ) {
    return this.celebrations.updateGuest(id, memberId, patch);
  }

  @Delete(':id/guests/:memberId')
  removeGuest(@Param('id') id: string, @Param('memberId') memberId: string) {
    return this.celebrations.removeGuest(id, memberId);
  }

  // ── sub-orders ──
  @Post(':id/suborders/food')
  addFood(@Param('id') id: string, @Body() dto: AddFoodSubOrderDto) {
    return this.celebrations.addFoodSubOrder(id, dto);
  }

  @Post(':id/suborders/instamart')
  addInstamart(@Param('id') id: string, @Body() dto: AddInstamartSubOrderDto) {
    return this.celebrations.addInstamartSubOrder(id, dto);
  }

  @Delete(':id/suborders/:subOrderId')
  removeSubOrder(@Param('id') id: string, @Param('subOrderId') subOrderId: string) {
    return this.celebrations.removeSubOrder(id, subOrderId);
  }

  // ── placement (the orchestration trigger) ──
  @Post(':id/place')
  place(@CurrentUser() userId: string, @Param('id') id: string) {
    if (!this.scheduler) {
      throw new ServiceUnavailableException(
        'Order placement queue is disabled. Set ENABLE_QUEUES=true and run Redis to place orders.',
      );
    }
    return this.scheduler.planAndPlace(id, userId);
  }

  // ── settlement ──
  @Post(':id/settle')
  settle(@Param('id') id: string, @Body() dto: SettleDto) {
    return this.settlement.settle(id, dto);
  }

  @Post(':id/shares/:shareId/paid')
  markPaid(@Param('shareId') shareId: string) {
    return this.settlement.markPaid(shareId);
  }

  // ── invites ──
  @Post(':id/invites')
  invite(@Param('id') id: string) {
    return this.invites.create(id);
  }
}
