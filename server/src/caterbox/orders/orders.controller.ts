import {
  Body,
  Controller,
  Post,
  Get,
  Put,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OrdersService } from './orders.service';
import { UpdateOrderDto, ListOrdersQueryDto } from './orders.dto';
import { CurrentUser, Staff, type AuthUser } from '../auth/decorators';

/**
 * CaterBox orders — the own-kitchen mealbox flow, from checkout to tracking.
 *
 * Identity here is the phone number the customer proved with an OTP: verifying
 * the code mints a JWT carrying that number, and these routes trust the claim
 * in the token rather than anything in the request body or path.
 *
 * That replaced three open doors. `POST /order` was unauthenticated, so orders
 * could be filed against any phone number. `GET /order/track/:phone` returned
 * every order for any number handed to it — a name, address, event date and
 * order history for anyone willing to iterate ten digits. `GET /order/:id`
 * took a Mongo ObjectId, which is a timestamp plus a counter and enumerable
 * from a single known id.
 */
@Controller('ck/order')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * File a new order against the caller's own verified number.
   *
   * Throttled tightly: each call writes a document and is the entry point to a
   * payment, so the ceiling is "a person checking out, including retries",
   * not "a script".
   */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('')
  async createOrder(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    // Typed as a plain object so the global ValidationPipe (whitelist +
    // forbidNonWhitelisted) skips it — the order is an intentionally flexible
    // quote blob persisted as-is. The service normalises it, binds the
    // customer phone to the token, and recomputes the price server-side.
    return this.ordersService.create(body, user.phone);
  }

  @Staff()
  @Get('')
  async getAllOrders(@Query() query: ListOrdersQueryDto) {
    return this.ordersService.findAll(query);
  }

  /**
   * The caller's own order history.
   *
   * The number stays in the path so the route and the client are unchanged, but
   * it is now checked against the token: a customer may only read their own,
   * and staff may read anyone's.
   */
  @Get('track/:phone')
  async trackByPhone(@CurrentUser() user: AuthUser, @Param('phone') phone: string) {
    return this.ordersService.findByPhoneFor(phone, user);
  }

  @Get(':id')
  async getOrderById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const order = await this.ordersService.findByIdFor(id, user);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  @Staff()
  @Post(':id/invoice')
  async assignInvoice(@Param('id') id: string) {
    // Allocate (once) and return the order's sequential GST invoice number.
    return this.ordersService.assignInvoice(id);
  }

  @Staff()
  @Post(':id/commission-invoice')
  async assignCommissionInvoice(@Param('id') id: string) {
    // Allocate (once) the vendor commission tax-invoice number (series COM).
    return this.ordersService.assignCommissionInvoice(id);
  }

  @Staff()
  @Post(':id/payout')
  async assignPayoutNo(@Param('id') id: string) {
    // Allocate (once) the vendor payout-statement number (series PAY).
    return this.ordersService.assignPayoutNo(id);
  }

  @Staff()
  @Put(':id')
  async replaceOrder(@Param('id') id: string, @Body() body: UpdateOrderDto) {
    // UpdateOrderDto whitelists the editable fields (status [enum-validated],
    // manager, remarks, vendors, payments, date, order). The admin client sends
    // a patch limited to these keys; OrdersService.update() also re-whitelists
    // before $set as defence in depth.
    const updated = await this.ordersService.update(id, body);
    if (!updated) throw new NotFoundException('Order not found');
    return updated;
  }
}
