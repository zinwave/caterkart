/**
 * Swiggy MCP types, in two layers.
 *
 *  1. Raw*  — EXACTLY what the MCP servers put on the wire. Captured live on
 *             2026-07-13 (see server/tools/swiggy-fixtures.json). Do not guess
 *             here; if a field is not in the fixtures it does not exist.
 *  2. Domain — the clean shape this API serves to the frontend. The mappers in
 *             swiggy/mappers.ts are the only place the two ever meet, so
 *             Swiggy's quirks (paise-vs-rupees, "₹491" strings, is_veg: "2")
 *             never leak into React.
 *
 * Quirks worth knowing, all real:
 *   - Nearly every food/instamart tool REQUIRES addressId.
 *   - Payloads arrive in `structuredContent`, keyed by entity ({restaurants:[…]}).
 *   - search_restaurants → availabilityStatus is "OPEN" (not "AVAILABLE").
 *   - get_restaurant_menu → item id is `id`; search_menu → it is `menu_item_id`.
 *   - Cart items use is_veg: "1" (veg) | "2" (non-veg), as a STRING.
 *   - Cart `valid_addons[].price` is in PAISE (37500 = ₹375), while
 *     search_menu `addons[].choices[].price` is in RUPEES (375). Same concept,
 *     different units, different endpoints.
 *   - Order totals are display strings: orderTotal: "₹491".
 */

export type ServerKey = 'food' | 'instamart' | 'dineout';

export type AddressId = string;
export type RestaurantId = string;
export type ItemId = string;
export type SpinId = string;
export type OrderId = string;

/** v1 of the MCP was COD-only; the schema now also accepts UPI intents. */
export type PaymentMethod = 'COD' | 'UPI';

/** Which UPI app to deep-link into (mobile intents). A QR works everywhere. */
export type UpiApp = 'gpay' | 'phonepe' | 'paytm' | 'bhim';

export interface PlaceOptions {
  paymentMethod: PaymentMethod;
  /** UPI only: deep-link into a specific app (mobile). */
  intentApp?: UpiApp;
  /** UPI only: ask Swiggy for a scannable QR (desktop-friendly). Default true. */
  generateUPIQR?: boolean;
}

/**
 * Outcome of place_food_order. COD (and any pre-settled method) lands as
 * `placed` with a real orderId. An online/UPI order comes back `payment_pending`
 * with a `paasId` to poll, plus (usually) a QR image/URI or intent link.
 *
 * ⚠️ The `payment_pending` field names are UNVERIFIED against a live UPI order:
 * the schema dump carries no output shape and there is no fixture. They are
 * parsed defensively in `mapPlaceResult`; confirm on the first real UPI place.
 */
export type PlaceResult =
  | { status: 'placed'; orderId: OrderId }
  | {
      status: 'payment_pending';
      paasId: string;
      orderId?: OrderId;
      upiQR?: string;
      upiIntentUri?: string;
    };

export interface PaymentStatusResult {
  paid: boolean;
  failed: boolean;
  pending: boolean;
  orderId?: OrderId;
  /** Raw status string from Swiggy, kept for display / debugging. */
  status?: string;
}

export interface PaymentOption {
  method: PaymentMethod;
  label: string;
  available: boolean;
}

// ───────────────────────────────────────────────────────────────────────────
// RAW — the wire
// ───────────────────────────────────────────────────────────────────────────

export interface RawAddress {
  id: string;
  addressLine: string;
  phoneNumber?: string;
  addressCategory?: string;
  addressTag?: string;
}
export interface RawAddresses {
  addresses: RawAddress[];
  total?: number;
  pagination?: unknown;
}

export interface RawRestaurant {
  id: string;
  name: string;
  cuisines?: string[];
  avgRating?: number;
  totalRatings?: string;
  costForTwo?: string;
  areaName?: string;
  distanceKm?: number;
  deliveryTimeMinutes?: number;
  deliveryTimeRange?: string;
  offer?: string;
  imageUrl?: string;
  /** "OPEN" | "CLOSED" | … — Swiggy's wording, NOT "AVAILABLE". */
  availabilityStatus?: string;
}
export interface RawRestaurants {
  restaurants: RawRestaurant[];
  total?: number;
  query?: string;
}

/** get_restaurant_menu → restaurant header (a richer shape than search results). */
export interface RawMenuRestaurant {
  id: string;
  name: string;
  city?: string;
  areaName?: string;
  cuisines?: string[];
  avgRating?: number;
  totalRatingsString?: string;
  costForTwoMessage?: string;
  isOpen?: boolean;
  deliveryTime?: number;
  slaString?: string;
  address?: string;
  imageUrl?: string;
}

/** An item as returned by get_restaurant_menu (id) — prices in RUPEES. */
export interface RawMenuItem {
  id: string;
  name: string;
  description?: string;
  price?: number;
  inStock?: number;
  isVeg?: boolean;
  isBestseller?: boolean;
  rating?: string;
  imageUrl?: string;
  hasVariants?: boolean;
  hasAddons?: boolean;
}

/** An item as returned by search_menu — note `menu_item_id`, and it carries addons. */
export interface RawSearchMenuItem {
  menu_item_id: string;
  name: string;
  price?: number;
  inStock?: number;
  isVeg?: boolean;
  imageUrl?: string;
  rating?: string;
  totalRatings?: string;
  hasVariants?: boolean;
  hasAddons?: boolean;
  addons?: RawAddonGroup[];
  variations?: unknown[];
  variantsV2?: unknown;
}

/** search_menu addon groups — choice prices are in RUPEES here. */
export interface RawAddonGroup {
  groupId: string | number;
  groupName: string;
  choices: Array<{ id: string | number; name: string; price: number }>;
  maxAddons?: number;
  maxFreeAddons?: number;
}

export interface RawMenu {
  restaurant: RawMenuRestaurant;
  categories: Array<{
    title: string;
    items: RawMenuItem[];
    totalItems?: number;
    hasMoreItems?: boolean;
  }>;
  totalCategories?: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
}

export interface RawSearchMenu {
  items: RawSearchMenuItem[];
  total?: number;
  query?: string;
}

/** update_food_cart / get_food_cart. `null` when the cart is empty. */
export interface RawCart {
  cart_id: number | string;
  result?: string;
  restaurant?: { deliverySubtitle?: string; name?: string; id?: string };
  items: RawCartItem[];
  item_count?: number;
  pricing?: {
    item_total?: number;
    delivery_charge?: number;
    delivery_charge_strikeoff?: number;
    taxes_and_charges?: number;
    to_pay?: number;
  };
  offers?: {
    coupon_applied?: string;
    coupon_discount?: number;
    free_delivery_applied?: boolean;
  };
}

export interface RawCartItem {
  menu_item_id: number | string;
  name: string;
  imageUrl?: string;
  quantity: number;
  /** STRING. "1" = veg, "2" = non-veg. */
  is_veg?: string | number;
  subtotal?: number;
  total?: number;
  final_price?: number;
  in_stock?: number;
  variants?: unknown[];
  addons?: unknown[];
  /** prices here are in PAISE — divide by 100. */
  valid_addons?: unknown[];
}

/** What we send to update_food_cart. */
export interface RawCartItemInput {
  menu_item_id: string;
  quantity: number;
  variants?: Array<Record<string, unknown>>;
  variantsV2?: unknown;
  addons?: Array<{ group_id?: string | number; choice_id?: string | number }>;
}

export interface RawOrder {
  orderId: string;
  restaurantId?: string;
  restaurantName?: string;
  restaurantAreaName?: string;
  /** display string, e.g. "₹491" */
  orderTotal?: string;
  orderStatus?: string;
  orderDeliveryStatus?: string;
  orderType?: string;
  /** CSV string, e.g. "Mutton Biryani Single (1),Chicken Biryani Single (1)" */
  orderedItems?: string;
  /** display string, e.g. "May 22, 1:40 PM" */
  orderedTime?: string;
  isActiveOrder?: boolean;
  actions?: unknown[];
}
export interface RawOrders {
  orders: RawOrder[];
  total?: number;
}

/** Instamart: one product, priced through its variations[]. */
export interface RawProduct {
  productId: string;
  parentProductId?: string;
  displayName: string;
  brand?: string;
  inStock?: boolean;
  isAvail?: boolean;
  isPromoted?: boolean;
  variations?: Array<{
    spinId: string;
    skuId?: string;
    displayName?: string;
    brandName?: string;
    quantityDescription?: string;
    price?: { mrp?: number; offerPrice?: number };
    isInStockAndAvailable?: boolean;
    imageUrl?: string;
  }>;
}
export interface RawProducts {
  products: RawProduct[];
  nextOffset?: number;
}

// ───────────────────────────────────────────────────────────────────────────
// DOMAIN — what we serve to the app
// ───────────────────────────────────────────────────────────────────────────

export interface Address {
  id: AddressId;
  /** "Office", "Home" … from addressTag */
  label: string;
  /** the full one-line address */
  display: string;
}

export interface Restaurant {
  id: RestaurantId;
  name: string;
  cuisines: string[];
  /** null when Swiggy has no rating yet */
  rating: number | null;
  ratingCount: string;
  etaMin: number;
  etaRange: string;
  costForTwo: string;
  areaName: string;
  distanceKm: number | null;
  /** the offer strip, e.g. "₹100 OFF ABOVE ₹549" */
  promo?: string;
  imageUrl?: string;
  isOpen: boolean;
}

export interface Dish {
  id: ItemId;
  name: string;
  /** rupees */
  price: number;
  veg: boolean;
  bestseller: boolean;
  description?: string;
  imageUrl?: string;
  rating?: string;
  inStock: boolean;
  hasVariants: boolean;
  hasAddons: boolean;
  /** only present from search_menu */
  addonGroups?: AddonGroup[];
}

export interface AddonGroup {
  groupId: string;
  groupName: string;
  maxAddons: number;
  choices: Array<{ id: string; name: string; price: number }>;
}

export interface Menu {
  restaurant: Restaurant;
  categories: Array<{ title: string; items: Dish[] }>;
  page: number;
  hasMore: boolean;
}

export interface CartItem {
  id: ItemId;
  name: string;
  quantity: number;
  veg: boolean;
  /** rupees, for the whole line */
  price: number;
  imageUrl?: string;
  inStock: boolean;
}

export interface Bill {
  itemTotal: number;
  deliveryCharge: number;
  deliveryChargeStrikeoff: number;
  taxesAndCharges: number;
  toPay: number;
  couponApplied?: string;
  couponDiscount: number;
  freeDelivery: boolean;
}

export interface Cart {
  cartId: string | null;
  restaurantId?: RestaurantId;
  deliverySubtitle?: string;
  items: CartItem[];
  itemCount: number;
  bill: Bill;
}

export const EMPTY_BILL: Bill = {
  itemTotal: 0,
  deliveryCharge: 0,
  deliveryChargeStrikeoff: 0,
  taxesAndCharges: 0,
  toPay: 0,
  couponDiscount: 0,
  freeDelivery: false,
};

export const EMPTY_CART: Cart = {
  cartId: null,
  items: [],
  itemCount: 0,
  bill: EMPTY_BILL,
};

/**
 * A Swiggy coupon.
 *
 * fetch_food_coupons returns NO structured content — only LLM-facing prose, e.g.
 *   **Best coupon**
 *     - ORDERON [✅ APPLICABLE] — Save ₹75 on this order! (code: bc33…-…)
 * so mappers.ts parses that text. The trailing `(code: <uuid>)` is a red herring:
 * apply_food_coupon wants the DISPLAY code ("ORDERON"); passing the uuid fails
 * with "Coupon does not exist" (verified live).
 */
export interface Coupon {
  /** the code you actually apply, e.g. "ORDERON" */
  code: string;
  applicable: boolean;
  /** "Save ₹75 on this order!" or "Add ₹610 more to avail this offer" */
  description: string;
  /** Swiggy's own "Best coupon" pick */
  best: boolean;
}

export interface OrderSummary {
  orderId: OrderId;
  restaurantId?: RestaurantId;
  restaurantName: string;
  areaName?: string;
  /** rupees, parsed out of "₹491" */
  total: number;
  status: string;
  deliveryStatus?: string;
  itemsSummary: string;
  orderedTime: string;
  isActive: boolean;
}

export interface Product {
  /** the spinId of the default variation — this is what the cart wants */
  id: SpinId;
  productId: string;
  name: string;
  brand?: string;
  /** e.g. "21.6 g" */
  unit: string;
  price: number;
  mrp: number;
  imageUrl?: string;
  inStock: boolean;
}

/** Normalized tracking, mapped from whatever track_food_order reports. */
export type TrackingState =
  | { status: 'PLACED'; etaMinutes: number }
  | { status: 'PREPARING'; etaMinutes: number }
  | { status: 'PICKED_UP'; etaMinutes: number; rider?: { name: string; phone: string } }
  | { status: 'DELIVERED'; deliveredAt: string }
  | { status: 'CANCELLED'; reason: string };

/** Maps an MCP ServerKey to its base-URL path segment. */
export const SERVER_PATH_KEY: Record<ServerKey, 'food' | 'instamart' | 'dineout'> = {
  food: 'food',
  instamart: 'instamart',
  dineout: 'dineout',
};
