/**
 * Swiggy domain types — the shape our backend serves (see server/src/mcp/mcp.types.ts).
 *
 * These are ALREADY normalized: the backend's mapper layer strips Swiggy's
 * quirks (paise-vs-rupees, "₹491" strings, is_veg: "2", "OPEN" vs "AVAILABLE").
 * Prices are rupees, booleans are booleans.
 *
 * Never call mcp.swiggy.com from the browser: it does not CORS-allow browsers,
 * and the OAuth token must never live here. Always go through our backend.
 */

export type AddressId = string;
export type RestaurantId = string;
export type ItemId = string;
export type SpinId = string;
export type OrderId = string;

export type PaymentMethod = 'COD' | 'UPI';

/** Which UPI app to deep-link into (mobile). A QR works everywhere. */
export type UpiApp = 'gpay' | 'phonepe' | 'paytm' | 'bhim';

/** Outcome of placing an order: settled (COD) or awaiting an online payment. */
export type PlaceResult =
  | { status: 'placed'; orderId: OrderId }
  | {
      status: 'payment_pending';
      paasId: string;
      orderId?: OrderId;
      upiQR?: string;
      upiIntentUri?: string;
    };

export type PaymentStatusResult = {
  paid: boolean;
  failed: boolean;
  pending: boolean;
  orderId?: OrderId;
  status?: string;
};

export type PaymentOption = {
  method: PaymentMethod;
  label: string;
  available: boolean;
};

export type Address = {
  id: AddressId;
  /** "Office", "Home" … */
  label: string;
  display: string;
};

export type Restaurant = {
  id: RestaurantId;
  name: string;
  cuisines: string[];
  /** null when Swiggy has no rating for it yet */
  rating: number | null;
  ratingCount: string;
  etaMin: number;
  etaRange: string;
  /** already formatted by Swiggy, e.g. "₹500 for two" */
  costForTwo: string;
  areaName: string;
  distanceKm: number | null;
  /** offer strip, e.g. "₹100 OFF ABOVE ₹549" */
  promo?: string;
  imageUrl?: string;
  isOpen: boolean;
};

export type AddonGroup = {
  groupId: string;
  groupName: string;
  maxAddons: number;
  choices: Array<{ id: string; name: string; price: number }>;
};

export type Dish = {
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
  /** only present via dish search */
  addonGroups?: AddonGroup[];
};

export type Menu = {
  restaurant: Restaurant;
  categories: Array<{ title: string; items: Dish[] }>;
  page: number;
  hasMore: boolean;
};

export type CartItem = {
  id: ItemId;
  name: string;
  quantity: number;
  veg: boolean;
  price: number;
  imageUrl?: string;
  inStock: boolean;
};

/** The REAL Swiggy bill — never compute delivery/taxes on the client. */
export type Bill = {
  itemTotal: number;
  deliveryCharge: number;
  deliveryChargeStrikeoff: number;
  taxesAndCharges: number;
  toPay: number;
  couponApplied?: string;
  couponDiscount: number;
  freeDelivery: boolean;
};

export type Cart = {
  cartId: string | null;
  restaurantId?: RestaurantId;
  deliverySubtitle?: string;
  items: CartItem[];
  itemCount: number;
  bill: Bill;
};

/**
 * A Swiggy coupon. NOTE: apply with `code` (e.g. "ORDERON") — Swiggy also prints
 * a uuid, but applying that fails with "Coupon does not exist".
 */
export type Coupon = {
  code: string;
  applicable: boolean;
  /** "Save ₹75 on this order!" / "Add ₹610 more to avail this offer" */
  description: string;
  /** Swiggy's own "Best coupon" pick */
  best: boolean;
};

export type OrderSummary = {
  orderId: OrderId;
  restaurantId?: RestaurantId;
  restaurantName: string;
  areaName?: string;
  /** rupees */
  total: number;
  status: string;
  deliveryStatus?: string;
  /** e.g. "Mutton Biryani (1),Chicken Biryani (1)" */
  itemsSummary: string;
  /** display string, e.g. "May 22, 1:40 PM" */
  orderedTime: string;
  isActive: boolean;
};

/** An Instamart product, flattened to its default variation. */
export type Product = {
  /** spinId — this is what the Instamart cart wants */
  id: SpinId;
  productId: string;
  name: string;
  brand?: string;
  /** e.g. "500 g" */
  unit: string;
  price: number;
  mrp: number;
  imageUrl?: string;
  inStock: boolean;
};

export type TrackingState =
  | { status: 'PLACED'; etaMinutes: number }
  | { status: 'PREPARING'; etaMinutes: number }
  | { status: 'PICKED_UP'; etaMinutes: number; rider?: { name: string; phone: string } }
  | { status: 'DELIVERED'; deliveredAt: string }
  | { status: 'CANCELLED'; reason: string };

/** What the food cart expects for each line. */
export type CartItemInput = {
  menu_item_id: string;
  quantity: number;
};
