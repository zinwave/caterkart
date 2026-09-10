import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { FoodService } from './food.service';
import { InstamartService } from './instamart.service';
import type { PaymentMethod, RawCartItemInput, UpiApp } from '../mcp/mcp.types';

/**
 * The frontend's window onto Swiggy. Everything here is live MCP data.
 *
 * `addressId` is required by Swiggy on nearly every tool, so it is a mandatory
 * query/body param on nearly every route — the app must pick an address first.
 */
@Controller('swiggy')
export class SwiggyController {
  constructor(
    private readonly food: FoodService,
    private readonly instamart: InstamartService,
  ) {}

  // ── Discover ────────────────────────────────────────────────────────────
  @Get('addresses')
  addresses(@CurrentUser() userId: string) {
    return this.food.getAddresses(userId);
  }

  @Get('restaurants')
  restaurants(
    @CurrentUser() userId: string,
    @Query('addressId') addressId: string,
    @Query('query') query = '',
    @Query('openOnly') openOnly?: string,
  ) {
    // An empty query means "browse" — Swiggy has no listing endpoint, so the
    // service fans out across broad cuisine terms instead.
    return openOnly === 'true'
      ? this.food.getServiceableRestaurants(userId, addressId, query)
      : query.trim()
        ? this.food.searchRestaurants(userId, addressId, query)
        : this.food.getPopularRestaurants(userId, addressId);
  }

  @Get('restaurants/:restaurantId/menu')
  menu(
    @CurrentUser() userId: string,
    @Param('restaurantId') restaurantId: string,
    @Query('addressId') addressId: string,
    @Query('page') page = '1',
  ) {
    return this.food.getRestaurantMenu(userId, addressId, restaurantId, Number(page) || 1);
  }

  /** Dish search — the only source of addon groups. */
  @Get('dishes')
  dishes(
    @CurrentUser() userId: string,
    @Query('addressId') addressId: string,
    @Query('query') query = '',
    @Query('restaurantId') restaurantId?: string,
  ) {
    return this.food.searchMenu(userId, addressId, query, restaurantId);
  }

  // ── Cart ────────────────────────────────────────────────────────────────
  @Get('cart')
  getCart(@CurrentUser() userId: string, @Query('addressId') addressId: string) {
    return this.food.getFoodCart(userId, addressId);
  }

  /** Swiggy carts are single-restaurant: this replaces the cart contents. */
  @Post('cart')
  updateCart(
    @CurrentUser() userId: string,
    @Body() body: { addressId: string; restaurantId: string; items: RawCartItemInput[] },
  ) {
    return this.food.updateFoodCart(userId, body.addressId, body.restaurantId, body.items ?? []);
  }

  @Delete('cart')
  flushCart(@CurrentUser() userId: string) {
    return this.food.flushFoodCart(userId);
  }

  /**
   * Coupons for the CURRENT cart at this restaurant. Build the cart first —
   * applicability depends on its value.
   */
  @Get('cart/coupons')
  coupons(
    @CurrentUser() userId: string,
    @Query('addressId') addressId: string,
    @Query('restaurantId') restaurantId: string,
  ) {
    return this.food.fetchFoodCoupons(userId, addressId, restaurantId);
  }

  @Post('cart/coupon')
  applyCoupon(
    @CurrentUser() userId: string,
    @Body() body: { addressId: string; couponCode: string },
  ) {
    return this.food.applyFoodCoupon(userId, body.addressId, body.couponCode);
  }

  // ── Orders ──────────────────────────────────────────────────────────────
  /**
   * Places a REAL, paid Swiggy order. Guarded: the cart must be non-empty and
   * under the ₹1000 cap. The UI must get explicit user confirmation first.
   */
  @Post('orders')
  place(
    @CurrentUser() userId: string,
    @Body()
    body: {
      addressId: string;
      paymentMethod?: PaymentMethod;
      intentApp?: UpiApp;
      generateUPIQR?: boolean;
    },
  ) {
    return this.food.placeFoodOrderGuarded(userId, body.addressId, {
      paymentMethod: body.paymentMethod ?? 'COD',
      intentApp: body.intentApp,
      generateUPIQR: body.generateUPIQR,
    });
  }

  /** Payment methods valid for a given cart amount (COD / UPI). */
  @Get('payment/options')
  paymentOptions(
    @CurrentUser() userId: string,
    @Query('addressId') addressId: string,
    @Query('cartAmount') cartAmount?: string,
  ) {
    return this.food.getPaymentOptions(userId, addressId, Number(cartAmount) || 0);
  }

  /** Poll / finalize an online (UPI) payment started by placing an order. */
  @Post('payment/status')
  paymentStatus(
    @CurrentUser() userId: string,
    @Body()
    body: {
      paasId: string;
      orderId?: string;
      addressId?: string;
      cartId?: string;
      lat?: number;
      lng?: number;
      finalize?: boolean;
    },
  ) {
    return this.food.checkPaymentStatus(userId, body);
  }

  @Get('orders')
  orders(
    @CurrentUser() userId: string,
    @Query('addressId') addressId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.food.getFoodOrders(userId, addressId, activeOnly === 'true');
  }

  @Get('orders/:orderId')
  orderDetails(@CurrentUser() userId: string, @Param('orderId') orderId: string) {
    return this.food.getFoodOrderDetails(userId, orderId);
  }

  /** Poll no faster than every 10s (Swiggy's stated floor). */
  @Get('orders/:orderId/track')
  track(@CurrentUser() userId: string, @Param('orderId') orderId: string) {
    return this.food.trackFoodOrder(userId, orderId);
  }

  // ── Instamart ───────────────────────────────────────────────────────────
  @Get('instamart/go-to')
  goTo(@CurrentUser() userId: string, @Query('addressId') addressId: string) {
    return this.instamart.yourGoToItems(userId, addressId);
  }

  @Get('instamart/search')
  search(
    @CurrentUser() userId: string,
    @Query('addressId') addressId: string,
    @Query('query') query = '',
  ) {
    return this.instamart.searchProducts(userId, addressId, query);
  }

  /**
   * Places a REAL, paid Instamart order: builds the cart from `items`, then
   * checks out. Guard with the same explicit-consent modal as food.
   */
  @Post('instamart/checkout')
  async checkoutInstamart(
    @CurrentUser() userId: string,
    @Body()
    body: {
      addressId: string;
      items: Array<{ spinId: string; quantity: number }>;
      paymentMethod?: PaymentMethod;
    },
  ) {
    await this.instamart.updateCart(userId, body.addressId, body.items ?? []);
    return this.instamart.checkout(userId, body.addressId, body.paymentMethod ?? 'COD');
  }
}
