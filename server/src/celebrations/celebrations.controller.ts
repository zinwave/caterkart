import {
  Body,
  Controller,
  Delete,
  Get,
  Optional,
  Param,
  Post,
  Put,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import { CelebrationsService } from './celebrations.service';
import { CelebrationHostGuard } from './celebration-host.guard';
import { SchedulerService } from '../scheduler/scheduler.service';
import { SettlementService } from '../settlement/settlement.service';
import { InvitesService } from '../invites/invites.service';
import {
  AddFoodSubOrderDto,
  AddGuestDto,
  CreateCelebrationDto,
  AddInstamartSubOrderDto,
  SetAddressDto,
  SettleDto,
  UpdateGuestDto,
} from './dto';

/**
 * The host's celebration.
 *
 * EVERY route takes `@CurrentUser()`, and every route that names a celebration
 * passes it to the service, which re-checks ownership against the database.
 * There is no route here that acts on a path id alone — that was the hole: the
 * id was treated as the credential, so anyone who had one (or guessed one)
 * could read the guest list, add food the host would pay for, or mint an invite
 * link that browsed Swiggy on the host's grant.
 *
 * Guests do not authenticate here at all. They hold an invite token and use
 * /api/invites/* (see InvitesController), which cannot place or pay for
 * anything.
 */
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
  get(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.celebrations.get(id, userId);
  }

  @Put(':id/address')
  setAddress(@CurrentUser() userId: string, @Param('id') id: string, @Body() dto: SetAddressDto) {
    return this.celebrations.setAddress(id, userId, dto.swiggyAddressId);
  }

  // ── guests ──
  /** Add a guest (invited by email/phone) AND mint their personal invite link. */
  @Post(':id/guests')
  async addGuest(@CurrentUser() userId: string, @Param('id') id: string, @Body() dto: AddGuestDto) {
    const member = await this.celebrations.addGuest(id, userId, dto);
    const invite = await this.invites.create(id, userId, member.id);
    return { member, invite };
  }

  @Put(':id/guests/:memberId')
  updateGuest(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() patch: UpdateGuestDto,
  ) {
    return this.celebrations.updateGuest(id, userId, memberId, patch);
  }

  @Delete(':id/guests/:memberId')
  removeGuest(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.celebrations.removeGuest(id, userId, memberId);
  }

  // ── sub-orders ──
  @Post(':id/suborders/food')
  addFood(@CurrentUser() userId: string, @Param('id') id: string, @Body() dto: AddFoodSubOrderDto) {
    return this.celebrations.addFoodSubOrder(id, userId, dto);
  }

  @Post(':id/suborders/instamart')
  addInstamart(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() dto: AddInstamartSubOrderDto,
  ) {
    return this.celebrations.addInstamartSubOrder(id, userId, dto);
  }

  @Delete(':id/suborders/:subOrderId')
  removeSubOrder(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Param('subOrderId') subOrderId: string,
  ) {
    return this.celebrations.removeSubOrder(id, userId, subOrderId);
  }

  // ── placement (the orchestration trigger) ──
  /**
   * Rate-limited hard: this is the one call in the product that spends real
   * money on a real Swiggy account, and placement is not idempotent.
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(CelebrationHostGuard)
  @Post(':id/place')
  place(@CurrentUser() userId: string, @Param('id') id: string) {
    // The guard above has already established that this caller hosts this
    // celebration. That ordering matters: answering 503 first would tell a
    // stranger the deployment's queue configuration, and — once queues are on —
    // would have let the ownership check depend on a config flag.
    if (!this.scheduler) {
      throw new ServiceUnavailableException(
        'Order placement queue is disabled. Set ENABLE_QUEUES=true and run Redis to place orders.',
      );
    }
    return this.scheduler.planAndPlace(id, userId);
  }

  // ── settlement ──
  @Post(':id/settle')
  settle(@CurrentUser() userId: string, @Param('id') id: string, @Body() dto: SettleDto) {
    return this.settlement.settle(id, userId, dto);
  }

  @Post(':id/shares/:shareId/paid')
  markPaid(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Param('shareId') shareId: string,
  ) {
    return this.settlement.markPaid(id, shareId, userId);
  }

  // ── invites ──
  @Post(':id/invites')
  invite(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.invites.create(id, userId);
  }
}
