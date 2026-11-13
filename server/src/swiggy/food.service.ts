import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { McpClientService } from '../mcp/mcp-client.service';
import { PrismaService } from '../prisma/prisma.service';
import { PLACEHOLDER_NAME } from '../auth/auth.service';
import { PlacementFailedError, ToolError } from '../mcp/mcp.errors';
import { redactToString } from '../common/redact';
import {
  mapAddress,
  mapCart,
  mapMenu,
  mapOrder,
  mapRestaurant,
  mapSearchMenuItem,
  mapTracking,
  parseCoupons,
  mapPlaceResult,
  mapPaymentStatus,
  mapPaymentOptions,
} from './mappers';
import type {
  Address,
  AddressId,
  Cart,
  Coupon,
  CreateAddressInput,
  Dish,
  Menu,
  OrderId,
  OrderSummary,
  PaymentMethod,
  PlaceOptions,
  PlaceResult,
  PaymentStatusResult,
  PaymentOption,
  RawAddresses,
  RawCart,
  RawCartItemInput,
  RawMenu,
  RawOrders,
  RawRestaurants,
  RawSearchMenu,
  Restaurant,
  RestaurantId,
  TrackingState,
} from '../mcp/mcp.types';

/**
 * Typed wrappers over the Swiggy Food MCP server.
 *
 * Two rules learned from the live API:
 *   1. `addressId` is how Swiggy derives the delivery coordinates. As of
 *      2026-09-13 the discovery tools also accept a latitude/longitude pair
 *      instead (Swiggy's "guest flow", for accounts with nothing saved), but
 *      cart, coupons, placement and orders remain address-gated. This service
 *      always has an authenticated user with a chosen address, so it passes
 *      addressId throughout and asserts it up front rather than letting the
 *      MCP round-trip fail.
 *   2. Tools return an entity-keyed envelope ({ restaurants: [...] }), never a
 *      bare array. Everything is normalized through ./mappers.
 */
/**
 * Broad terms used to build a browse list when the user hasn't searched.
 * Swiggy only does text search, so these stand in for a "popular near you" feed.
 */
const BROWSE_QUERIES = ['biryani', 'pizza', 'north indian', 'chinese', 'south indian', 'desserts'];

@Injectable()
export class FoodService {
  private readonly log = new Logger(FoodService.name);
  private readonly capRupees: number;

  constructor(
    private readonly mcp: McpClientService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.capRupees = this.config.get<number>('orchestration.foodOrderCapRupees', 1000);
  }

  private assertAddress(addressId: AddressId, tool: string): void {
    if (!addressId) throw new BadRequestException(`addressId is required for ${tool}`);
  }

  // ── Discover ────────────────────────────────────────────────────────────
  async getAddresses(userId: string): Promise<Address[]> {
    const res = await this.mcp.callTool<RawAddresses>('food', userId, 'get_addresses', {
      pageSize: 50,
    });
    const raw = res?.addresses ?? [];
    void this.backfillUserHint(userId, raw);
    return raw.map(mapAddress);
  }

  /**
   * Record the account's masked phone the first time we see it.
   *
   * The OAuth grant tells us nothing about who the user is — no phone, no name,
   * no profile tool on the MCP — so the display hint stayed null and the header
   * rendered "+91 null". Addresses carry it (`phoneNumber: "****0778"`, already
   * masked by Swiggy and identical across every address on the account), and
   * this call has just fetched them, so the backfill is free.
   *
   * Deliberately fire-and-forget: a failed write here must never break address
   * loading, which is on the critical path for the whole food flow.
   */
  private async backfillUserHint(userId: string, addresses: RawAddresses['addresses']): Promise<void> {
    const hint = addresses.find((a) => a.phoneNumber)?.phoneNumber;
    if (!hint) return;
    try {
      await this.prisma.swiggyAuth.updateMany({
        where: { userId, swiggyUserHint: null },
        data: { swiggyUserHint: hint },
      });
    } catch (err) {
      this.log.warn(`could not store the phone hint for ${userId}: ${(err as Error).message}`);
    }
  }

  /**
   * Create a delivery address, then return the refreshed list.
   *
   * NOT idempotent: a blind retry is how you end up with the same address saved
   * twice. Returning the fresh list doubles as reconciliation — if the write
   * landed but the response was lost, the caller still sees the truth.
   */
  async createAddress(userId: string, input: CreateAddressInput): Promise<Address[]> {
    await this.mcp.callTool('food', userId, 'create_address', { ...input }, { idempotent: false });
    // Swiggy documents `userName` as the account holder, and nothing else in
    // the MCP reports it — so this is the one authoritative chance to replace
    // the "Swiggy user" placeholder. Only ever fills a blank: a later address
    // saved for someone else must not rename the account.
    if (input.userName.trim()) {
      await this.prisma.user
        .updateMany({
          where: { id: userId, OR: [{ displayName: null }, { displayName: PLACEHOLDER_NAME }] },
          data: { displayName: input.userName.trim() },
        })
        .catch(() => undefined);
    }
    return this.getAddresses(userId);
  }

  /** Permanent, per Swiggy. The UI must confirm before calling this. */
  async deleteAddress(userId: string, addressId: AddressId): Promise<Address[]> {
    this.assertAddress(addressId, 'delete_address');
    await this.mcp.callTool('food', userId, 'delete_address', { addressId }, { idempotent: false });
    return this.getAddresses(userId);
  }

  async searchRestaurants(userId: string, addressId: AddressId, query: string): Promise<Restaurant[]> {
    this.assertAddress(addressId, 'search_restaurants');
    const res = await this.mcp.callTool<RawRestaurants>('food', userId, 'search_restaurants', {
      addressId,
      query,
    });
    return (res?.restaurants ?? []).map(mapRestaurant);
  }

  /** Only surface restaurants Swiggy will actually deliver from right now. */
  async getServiceableRestaurants(
    userId: string,
    addressId: AddressId,
    query = '',
  ): Promise<Restaurant[]> {
    const all = query.trim()
      ? await this.searchRestaurants(userId, addressId, query)
      : await this.getPopularRestaurants(userId, addressId);
    return all.filter((r) => r.isOpen);
  }

  /**
   * A "browse" list for when the user hasn't searched yet.
   *
   * Swiggy has NO listing endpoint — search_restaurants requires a query and
   * text-matches it. (Searching the literal word "popular" returns cinema
   * snack counters, which is how this bug first showed up.) So we fan out across
   * a few broad cuisine terms and merge, interleaving the results so the list
   * isn't just twenty biryani places.
   */
  async getPopularRestaurants(userId: string, addressId: AddressId): Promise<Restaurant[]> {
    this.assertAddress(addressId, 'search_restaurants');

    const results = await Promise.all(
      BROWSE_QUERIES.map((q) =>
        this.searchRestaurants(userId, addressId, q).catch((err) => {
          this.log.warn(`browse query "${q}" failed: ${(err as Error).message}`);
          return [] as Restaurant[];
        }),
      ),
    );

    // Round-robin across the queries so every cuisine gets a look in, dropping
    // duplicates (a restaurant matches several terms).
    const seen = new Set<string>();
    const merged: Restaurant[] = [];
    const depth = Math.max(...results.map((r) => r.length), 0);
    for (let i = 0; i < depth; i++) {
      for (const list of results) {
        const r = list[i];
        if (!r || seen.has(r.id)) continue;
        seen.add(r.id);
        merged.push(r);
      }
    }
    return merged;
  }

  async getRestaurantMenu(
    userId: string,
    addressId: AddressId,
    restaurantId: RestaurantId,
    page = 1,
    pageSize = 20,
  ): Promise<Menu> {
    this.assertAddress(addressId, 'get_restaurant_menu');
    const res = await this.mcp.callTool<RawMenu>('food', userId, 'get_restaurant_menu', {
      addressId,
      restaurantId,
      page,
      pageSize,
    });
    return mapMenu(res);
  }

  /**
   * Dish-level search. This is the ONLY tool that returns addon groups, so the
   * UI must call it (not get_restaurant_menu) before customising an item.
   */
  async searchMenu(
    userId: string,
    addressId: AddressId,
    query: string,
    restaurantId?: RestaurantId,
  ): Promise<Dish[]> {
    this.assertAddress(addressId, 'search_menu');
    const res = await this.mcp.callTool<RawSearchMenu>('food', userId, 'search_menu', {
      addressId,
      query,
      ...(restaurantId ? { restaurantIdOfAddedItem: restaurantId } : {}),
    });
    return (res?.items ?? []).map(mapSearchMenuItem);
  }

  // ── Cart ──────────────────────────────────────────────────────────────────
  /** Carts are single-restaurant: adding from a new restaurant replaces the cart. */
  async updateFoodCart(
    userId: string,
    addressId: AddressId,
    restaurantId: RestaurantId,
    cartItems: RawCartItemInput[],
  ): Promise<Cart> {
    this.assertAddress(addressId, 'update_food_cart');
    if (!restaurantId) throw new BadRequestException('restaurantId is required');
    const res = await this.mcp.callTool<RawCart>('food', userId, 'update_food_cart', {
      addressId,
      restaurantId,
      cartItems,
    });
    return mapCart(res, restaurantId);
  }

  async getFoodCart(userId: string, addressId: AddressId): Promise<Cart> {
    this.assertAddress(addressId, 'get_food_cart');
    const res = await this.mcp.callTool<RawCart | null>('food', userId, 'get_food_cart', {
      addressId,
    });
    return mapCart(res);
  }

  async flushFoodCart(userId: string): Promise<Cart> {
    await this.mcp.callTool('food', userId, 'flush_food_cart', {});
    return mapCart(null);
  }

  // ── Coupons ───────────────────────────────────────────────────────────────
  /**
   * Coupons for the CURRENT cart at this restaurant. Applicability depends on the
   * cart's value ("Add ₹610 more to avail this offer"), so build the cart first.
   * Returns prose, which mappers.parseCoupons turns into real objects.
   */
  async fetchFoodCoupons(
    userId: string,
    addressId: AddressId,
    restaurantId: RestaurantId,
  ): Promise<Coupon[]> {
    this.assertAddress(addressId, 'fetch_food_coupons');
    const raw = await this.mcp.callTool('food', userId, 'fetch_food_coupons', {
      addressId,
      restaurantId,
    });
    return parseCoupons(raw);
  }

  /**
   * Apply a coupon to the current cart.
   *
   * Pass the DISPLAY code ("ORDERON"), not the uuid that fetch_food_coupons
   * prints — the uuid fails with "Coupon does not exist".
   *
   * apply_food_coupon answers with prose ("Coupon 'ORDERON' applied successfully!
   * Discount: -₹75"), NOT a cart, so we re-read the cart to get the real bill.
   */
  async applyFoodCoupon(userId: string, addressId: AddressId, couponCode: string): Promise<Cart> {
    this.assertAddress(addressId, 'apply_food_coupon');
    let res: unknown;
    try {
      res = await this.mcp.callTool<unknown>('food', userId, 'apply_food_coupon', {
        addressId,
        couponCode,
      });
    } catch (err) {
      // Swiggy refuses bad/inapplicable coupons via isError — that's a 400, not a 500.
      if (err instanceof ToolError) throw new BadRequestException(err.reason);
      throw err;
    }

    // It can also refuse in prose with a success envelope, so sniff the text too.
    const text = typeof res === 'string' ? res : '';
    if (/does not exist|not applicable|invalid|cannot be applied|something went wrong/i.test(text)) {
      throw new BadRequestException(text.split('\n')[0] || `Coupon ${couponCode} could not be applied`);
    }

    return this.getFoodCart(userId, addressId);
  }

  // ── Order ─────────────────────────────────────────────────────────────────
  /**
   * NOT idempotent. callTool is told idempotent:false so it never auto-retries;
   * a failure throws PlacementFailedError and the caller reconciles via
   * getFoodOrders before any manual retry.
   */
  async placeFood(
    userId: string,
    addressId: AddressId,
    opts: PlaceOptions = { paymentMethod: 'COD' },
  ): Promise<PlaceResult> {
    this.assertAddress(addressId, 'place_food_order');
    const args: Record<string, unknown> = {
      addressId,
      paymentMethod: opts.paymentMethod,
    };
    if (opts.paymentMethod === 'UPI') {
      // A QR is scannable from a laptop demo; intentApp deep-links only resolve
      // on a phone, so default to the QR unless a specific app was requested.
      args.generateUPIQR = opts.generateUPIQR ?? true;
      if (opts.intentApp) args.intentApp = opts.intentApp;
    }
    const raw = await this.mcp.callTool<unknown>(
      'food',
      userId,
      'place_food_order',
      args,
      { idempotent: false },
    );
    const result = mapPlaceResult(raw);
    if (!result) {
      // Unknown shape → log it so the payment mappers can be pinned to reality.
      // Redacted: an order response carries the customer's name, phone, full
      // delivery address and coordinates, and the debugging value here is the
      // SHAPE of the payload, not whose order it was.
      this.log.warn(`place_food_order returned an unrecognized shape: ${redactToString(raw, 800)}`);
      throw new ToolError(
        'place_food_order',
        'The order response was unrecognized — check the Swiggy app before retrying.',
      );
    }
    return result;
  }

  /**
   * The pre-place ritual: read the cart, confirm it is non-empty and under the
   * ₹1000 cap, THEN place. The UI is responsible for explicit user consent —
   * this only enforces the invariants Swiggy imposes.
   */
  async placeFoodOrderGuarded(
    userId: string,
    addressId: AddressId,
    opts: PlaceOptions = { paymentMethod: 'COD' },
  ): Promise<PlaceResult> {
    const cart = await this.getFoodCart(userId, addressId);
    if (!cart.items.length) throw new BadRequestException('Cart is empty');
    if (cart.bill.toPay >= this.capRupees) {
      throw new BadRequestException(
        `Cart ₹${cart.bill.toPay} is at or above the ₹${this.capRupees} cap — split it before placing.`,
      );
    }
    return this.placeFood(userId, addressId, opts);
  }

  /** Payment methods Swiggy will accept for this cart value (COD / UPI). */
  async getPaymentOptions(
    userId: string,
    addressId: AddressId,
    cartAmount: number,
  ): Promise<PaymentOption[]> {
    this.assertAddress(addressId, 'get_payment_options');
    const raw = await this.mcp.callTool<unknown>('food', userId, 'get_payment_options', {
      addressId,
      cartAmount,
    });
    return mapPaymentOptions(raw);
  }

  /**
   * Poll (and, with `finalize`, settle) an online/UPI payment kicked off by
   * placeFood. Idempotent — safe to call repeatedly while the payer scans a QR.
   */
  checkPaymentStatus(
    userId: string,
    input: {
      paasId: string;
      orderId?: OrderId;
      addressId?: AddressId;
      cartId?: string;
      lat?: number;
      lng?: number;
      finalize?: boolean;
    },
  ): Promise<PaymentStatusResult> {
    return this.mcp
      .callTool<unknown>(
        'food',
        userId,
        'check_payment_status',
        {
          paasId: input.paasId,
          orderId: input.orderId,
          addressId: input.addressId,
          cartId: input.cartId,
          lat: input.lat,
          lng: input.lng,
          finalize: input.finalize ?? false,
        },
        { idempotent: true },
      )
      .then(mapPaymentStatus);
  }

  /**
   * Place one sub-order and survive the non-idempotency hazard: on failure we do
   * NOT blind-retry — we read get_food_orders, look for a matching order
   * (same restaurant, total within ₹1) and adopt it if found.
   *
   * Note: orders carry no machine-readable timestamp (`orderedTime` is a display
   * string like "May 22, 1:40 PM"), so we match on restaurant + total among the
   * most recent orders, which Swiggy returns newest-first.
   */
  async placeReconciled(
    userId: string,
    addressId: AddressId,
    ctx: { restaurantId: RestaurantId; expectedTotal: number; paymentMethod?: PaymentMethod },
  ): Promise<{ orderId: OrderId; reconciled: boolean }> {
    try {
      const res = await this.placeFood(userId, addressId, {
        paymentMethod: ctx.paymentMethod ?? 'COD',
      });
      if (res.status !== 'placed') {
        // Automated corporate placement can't complete an interactive UPI
        // payment — a human has to approve it. Keep this path COD-only.
        throw new ToolError(
          'place_food_order',
          'Online payment is not supported for automated corporate placement — use COD.',
        );
      }
      return { orderId: res.orderId, reconciled: false };
    } catch (err) {
      if (!(err instanceof PlacementFailedError)) throw err;

      // Uncertain — did it land? Reconcile against the order list.
      const orders = await this.getFoodOrders(userId, addressId).catch(() => [] as OrderSummary[]);
      const sameRestaurant = orders.filter((o) => o.restaurantId === ctx.restaurantId);

      const exact = sameRestaurant.find((o) => Math.abs(o.total - ctx.expectedTotal) <= 1);
      if (exact) {
        this.log.warn(`placeReconciled: adopted ${exact.orderId} after a failed place call`);
        return { orderId: exact.orderId, reconciled: true };
      }
      const active = sameRestaurant.find((o) => o.isActive);
      if (active) {
        this.log.warn(`placeReconciled: adopted active order ${active.orderId} (total mismatch)`);
        return { orderId: active.orderId, reconciled: true };
      }

      await this.reportError(userId, {
        tool: 'place_food_order',
        errorMessage: 'Reconcile found no matching order after a failed placement',
        toolContext: JSON.stringify(ctx),
      }).catch(() => undefined);
      throw err;
    }
  }

  // ── Track / reconcile ─────────────────────────────────────────────────────
  async getFoodOrders(
    userId: string,
    addressId: AddressId,
    activeOnly = false,
  ): Promise<OrderSummary[]> {
    this.assertAddress(addressId, 'get_food_orders');
    const res = await this.mcp.callTool<RawOrders>('food', userId, 'get_food_orders', {
      addressId,
      activeOnly,
    });
    return (res?.orders ?? []).map(mapOrder);
  }

  getFoodOrderDetails(userId: string, orderId: OrderId): Promise<unknown> {
    return this.mcp.callTool('food', userId, 'get_food_order_details', { orderId });
  }

  async trackFoodOrder(userId: string, orderId: OrderId): Promise<TrackingState> {
    const raw = await this.mcp.callTool('food', userId, 'track_food_order', { orderId });
    return mapTracking(raw);
  }

  // ── Support ───────────────────────────────────────────────────────────────
  reportError(
    userId: string,
    input: { tool: string; errorMessage: string; toolContext?: string; userNotes?: string },
  ): Promise<unknown> {
    return this.mcp.callTool('food', userId, 'report_error', { domain: 'food', ...input });
  }
}
