import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
// Type-only: `express` is a transitive dependency of @nestjs/platform-express,
// so a value import would emit a require() for a package this app does not declare.
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CreateDirectLinkDto, CreatePaymentDto, VerifyPaymentDto } from './payments.dto';
import { CurrentUser, Public, Staff, type AuthUser } from '../auth/decorators';

/**
 * CaterBox payments (Razorpay).
 *
 * The customer-facing routes authenticate with the same OTP-issued token as
 * the rest of the mealbox flow, and the service re-checks that the order
 * belongs to the caller. Amounts are never taken from the request — they are
 * recomputed from the order's own line items — but the routes still needed an
 * owner: creating an intent writes `razorpayOrderId` onto the order document,
 * so an open endpoint let anyone overwrite the pending intent on anyone's
 * order and have a genuine payment settle against the wrong amount.
 */
@Controller('ck/payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /**
   * Open a Razorpay order for one of the caller's own CaterKart orders.
   * kind = advance | balance | full. The amount is server-authoritative.
   */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('order/:id')
  @HttpCode(HttpStatus.OK)
  createOrderPayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: CreatePaymentDto,
  ) {
    return this.payments.createOrderPayment(id, body?.kind || 'advance', user);
  }

  // Create a hosted Razorpay payment link & notify the customer (SMS/email) — staff action
  @Staff()
  @Post('order/:id/link')
  @HttpCode(HttpStatus.OK)
  createPaymentLink(@Param('id') id: string, @Body() body: CreatePaymentDto) {
    return this.payments.createPaymentLink(id, body?.kind || 'balance');
  }

  // Create a hosted Razorpay payment link for an explicit amount (subscriptions) — staff action
  @Staff()
  @Post('link')
  @HttpCode(HttpStatus.OK)
  createDirectLink(@Body() body: CreateDirectLinkDto) {
    return this.payments.createDirectLink(body);
  }

  /**
   * Reconcile an order's payment status from Razorpay.
   *
   * Open to the order's owner as well as staff: the webhook cannot reach a
   * local dev server, and a customer who has just paid should be able to
   * refresh rather than wait. Razorpay remains the source of truth — this only
   * reads back what it reports.
   */
  @Post('order/:id/sync')
  @HttpCode(HttpStatus.OK)
  sync(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payments.syncOrderPayment(id, user);
  }

  /** Verify the Checkout signature and mark the order paid. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verify(@CurrentUser() user: AuthUser, @Body() body: VerifyPaymentDto) {
    return this.payments.verifyPayment(body, user);
  }

  /**
   * Razorpay server-to-server webhook.
   *
   * Public and un-throttled by design: it carries its own authentication — an
   * HMAC over the exact raw bytes, keyed by RAZORPAY_WEBHOOK_SECRET — and a
   * rate limit here would drop retries of genuine settlement events during the
   * exact burst that follows an outage, leaving paid orders marked unpaid.
   * A forged request fails the HMAC and never reaches the handler.
   */
  @Public()
  @SkipThrottle()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(@Req() req: Request) {
    const signature = req.headers['x-razorpay-signature'] as string;
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody as Buffer;
    await this.payments.handleWebhook(rawBody, signature);
    return { received: true };
  }
}
