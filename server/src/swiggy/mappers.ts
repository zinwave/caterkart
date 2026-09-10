/**
 * Anti-corruption layer: raw Swiggy wire shapes → our domain types.
 *
 * This is the ONLY file allowed to know that Swiggy says "OPEN", prices addons
 * in paise, encodes veg-ness as the string "2", and hands back totals as "₹491".
 * Everything downstream (services, controller, React) sees clean domain types.
 */
import type {
  AddonGroup,
  Address,
  Bill,
  Cart,
  CartItem,
  Coupon,
  Dish,
  Menu,
  OrderSummary,
  Product,
  RawAddress,
  RawAddonGroup,
  RawCart,
  RawCartItem,
  RawMenu,
  RawMenuItem,
  RawMenuRestaurant,
  RawOrder,
  RawProduct,
  RawRestaurant,
  RawSearchMenuItem,
  Restaurant,
  TrackingState,
  PlaceResult,
  PaymentStatusResult,
  PaymentOption,
} from '../mcp/mcp.types';
import { EMPTY_BILL, EMPTY_CART } from '../mcp/mcp.types';

// ── primitives ─────────────────────────────────────────────────────────────

/** "₹491" | "491" | 491 → 491. Returns 0 for anything unparseable. */
export function toRupees(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'string') return 0;
  const n = Number(v.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Swiggy encodes veg-ness three different ways depending on the endpoint:
 * a real boolean (menu), or the string "1"/"2" (cart, where 2 = non-veg).
 */
export function toVeg(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === '1') return true;
  return false;
}

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

// ── addresses ──────────────────────────────────────────────────────────────

export const mapAddress = (a: RawAddress): Address => ({
  id: a.id,
  label: a.addressTag || a.addressCategory || 'Address',
  display: a.addressLine ?? '',
});

// ── restaurants ────────────────────────────────────────────────────────────

export const mapRestaurant = (r: RawRestaurant): Restaurant => ({
  id: r.id,
  name: r.name,
  cuisines: r.cuisines ?? [],
  rating: typeof r.avgRating === 'number' ? r.avgRating : null,
  ratingCount: r.totalRatings ?? '',
  etaMin: num(r.deliveryTimeMinutes),
  etaRange: r.deliveryTimeRange ?? '',
  costForTwo: r.costForTwo ?? '',
  areaName: r.areaName ?? '',
  distanceKm: typeof r.distanceKm === 'number' ? r.distanceKm : null,
  promo: r.offer || undefined,
  imageUrl: r.imageUrl || undefined,
  // Swiggy says "OPEN". Treat anything else (CLOSED, NOT_SERVICEABLE) as shut.
  isOpen: (r.availabilityStatus ?? '').toUpperCase() === 'OPEN',
});

/** The menu endpoint returns a richer restaurant header with different keys. */
export const mapMenuRestaurant = (r: RawMenuRestaurant): Restaurant => ({
  id: r.id,
  name: r.name,
  cuisines: r.cuisines ?? [],
  rating: typeof r.avgRating === 'number' ? r.avgRating : null,
  ratingCount: r.totalRatingsString ?? '',
  etaMin: num(r.deliveryTime),
  etaRange: r.slaString ?? '',
  costForTwo: r.costForTwoMessage ?? '',
  areaName: r.areaName ?? r.city ?? '',
  distanceKm: null,
  imageUrl: r.imageUrl || undefined,
  isOpen: r.isOpen !== false,
});

// ── dishes ─────────────────────────────────────────────────────────────────

export const mapMenuItem = (i: RawMenuItem): Dish => ({
  id: String(i.id),
  name: i.name,
  price: toRupees(i.price),
  veg: toVeg(i.isVeg),
  bestseller: !!i.isBestseller,
  description: i.description || undefined,
  imageUrl: i.imageUrl || undefined,
  rating: i.rating || undefined,
  inStock: (i.inStock ?? 1) !== 0,
  hasVariants: !!i.hasVariants,
  hasAddons: !!i.hasAddons,
});

/** search_menu items key the id as `menu_item_id` and carry addon groups. */
export const mapSearchMenuItem = (i: RawSearchMenuItem): Dish => ({
  id: String(i.menu_item_id),
  name: i.name,
  price: toRupees(i.price),
  veg: toVeg(i.isVeg),
  bestseller: false,
  imageUrl: i.imageUrl || undefined,
  rating: i.rating || undefined,
  inStock: (i.inStock ?? 1) !== 0,
  hasVariants: !!i.hasVariants,
  hasAddons: !!i.hasAddons,
  addonGroups: (i.addons ?? []).map(mapAddonGroup),
});

/** Prices here are already in RUPEES (unlike the cart's valid_addons). */
export const mapAddonGroup = (g: RawAddonGroup): AddonGroup => ({
  groupId: String(g.groupId),
  groupName: g.groupName,
  maxAddons: num(g.maxAddons, 1),
  choices: (g.choices ?? []).map((c) => ({
    id: String(c.id),
    name: c.name,
    price: toRupees(c.price),
  })),
});

export const mapMenu = (m: RawMenu): Menu => ({
  restaurant: mapMenuRestaurant(m.restaurant),
  categories: (m.categories ?? []).map((c) => ({
    title: c.title,
    items: (c.items ?? []).map(mapMenuItem),
  })),
  page: num(m.page, 1),
  hasMore: !!m.hasMore,
});

// ── cart ───────────────────────────────────────────────────────────────────

export const mapCartItem = (i: RawCartItem): CartItem => ({
  id: String(i.menu_item_id),
  name: i.name,
  quantity: num(i.quantity, 1),
  veg: toVeg(i.is_veg),
  // `final_price` is the line price Swiggy actually charges; `total` includes
  // addons/taxes on some responses, so prefer final_price then subtotal.
  price: toRupees(i.final_price ?? i.subtotal ?? i.total),
  imageUrl: i.imageUrl || undefined,
  inStock: (i.in_stock ?? 1) !== 0,
});

export const mapBill = (c: RawCart): Bill => {
  const p = c.pricing ?? {};
  const o = c.offers ?? {};
  return {
    itemTotal: toRupees(p.item_total),
    deliveryCharge: toRupees(p.delivery_charge),
    deliveryChargeStrikeoff: toRupees(p.delivery_charge_strikeoff),
    taxesAndCharges: toRupees(p.taxes_and_charges),
    toPay: toRupees(p.to_pay),
    couponApplied: o.coupon_applied || undefined,
    couponDiscount: toRupees(o.coupon_discount),
    freeDelivery: !!o.free_delivery_applied,
  };
};

/** get_food_cart returns `null` for an empty cart — normalize that away. */
export const mapCart = (c: RawCart | null | undefined, restaurantId?: string): Cart => {
  if (!c || !c.cart_id) return { ...EMPTY_CART, bill: { ...EMPTY_BILL }, items: [] };
  return {
    cartId: String(c.cart_id),
    restaurantId: restaurantId ?? c.restaurant?.id,
    deliverySubtitle: c.restaurant?.deliverySubtitle,
    items: (c.items ?? []).map(mapCartItem),
    itemCount: num(c.item_count, (c.items ?? []).length),
    bill: mapBill(c),
  };
};

// ── coupons ────────────────────────────────────────────────────────────────

/**
 * fetch_food_coupons has no structured output — it returns prose:
 *
 *   Found 2 coupons (1 applicable):
 *
 *   **Best coupon**
 *     - ORDERON [✅ APPLICABLE] — Save ₹75 on this order! (code: bc33…)
 *
 *   **More offers**
 *     - FLATDEAL [❌ NOT APPLICABLE] — Add ₹610 more to avail this offer (code: a533…)
 *
 * So we parse it. NOTE the `(code: <uuid>)` is NOT what you apply — apply_food_coupon
 * takes the display code ("ORDERON"); the uuid errors with "Coupon does not exist".
 */
export function parseCoupons(raw: unknown): Coupon[] {
  const text = typeof raw === 'string' ? raw : ((raw as any)?.text ?? '');
  if (!text || typeof text !== 'string') return [];

  const out: Coupon[] = [];
  let best = false;

  for (const line of text.split('\n')) {
    const heading = line.match(/\*\*(.+?)\*\*/);
    if (heading) {
      best = /best/i.test(heading[1]);
      continue;
    }
    // "  - CODE [✅ APPLICABLE] — description (code: uuid)"
    const m = line.match(/^\s*[-•]\s*(\S+)\s*\[([^\]]*)\]\s*[—–-]?\s*(.*)$/);
    if (!m) continue;

    const [, code, status, rest] = m;
    if (!code) continue;

    out.push({
      code,
      applicable: /applicable/i.test(status) && !/not\s+applicable/i.test(status),
      description: rest.replace(/\s*\(code:[^)]*\)\s*$/i, '').trim(),
      best,
    });
  }
  return out;
}

// ── orders ─────────────────────────────────────────────────────────────────

export const mapOrder = (o: RawOrder): OrderSummary => ({
  orderId: String(o.orderId),
  restaurantId: o.restaurantId,
  restaurantName: o.restaurantName ?? 'Restaurant',
  areaName: o.restaurantAreaName,
  total: toRupees(o.orderTotal),
  status: o.orderStatus ?? 'Unknown',
  deliveryStatus: o.orderDeliveryStatus,
  itemsSummary: o.orderedItems ?? '',
  orderedTime: o.orderedTime ?? '',
  isActive: !!o.isActiveOrder,
});

// ── instamart ──────────────────────────────────────────────────────────────

/** A product is priced through its first available variation. */
export const mapProduct = (p: RawProduct): Product | null => {
  const v = p.variations?.find((x) => x.isInStockAndAvailable) ?? p.variations?.[0];
  if (!v) return null;
  return {
    id: v.spinId,
    productId: p.productId,
    name: p.displayName ?? v.displayName ?? '',
    brand: p.brand ?? v.brandName,
    unit: v.quantityDescription ?? '',
    price: toRupees(v.price?.offerPrice ?? v.price?.mrp),
    mrp: toRupees(v.price?.mrp ?? v.price?.offerPrice),
    imageUrl: v.imageUrl || undefined,
    inStock: v.isInStockAndAvailable ?? p.inStock ?? true,
  };
};

// ── tracking ───────────────────────────────────────────────────────────────

/**
 * track_food_order's payload is not in the fixtures (it needs a live order), so
 * this maps defensively off whatever status string comes back and keeps our
 * own TrackingState union stable for the scheduler.
 */
export function mapTracking(raw: unknown): TrackingState {
  const r = (raw ?? {}) as Record<string, any>;
  const s = String(r.status ?? r.orderStatus ?? r.orderDeliveryStatus ?? '').toUpperCase();
  const eta = num(r.etaMinutes ?? r.eta ?? r.deliveryTimeMinutes, 0);

  if (/CANCEL/.test(s)) return { status: 'CANCELLED', reason: String(r.reason ?? 'Cancelled') };
  if (/DELIVERED|COMPLETE/.test(s)) {
    return { status: 'DELIVERED', deliveredAt: String(r.deliveredAt ?? new Date().toISOString()) };
  }
  if (/PICK|OUT_FOR|ON_THE_WAY|ARRIV/.test(s)) {
    const rider = r.rider ?? r.deliveryPartner;
    return {
      status: 'PICKED_UP',
      etaMinutes: eta,
      rider: rider ? { name: String(rider.name ?? ''), phone: String(rider.phone ?? '') } : undefined,
    };
  }
  if (/PREPAR|COOK|FOOD/.test(s)) return { status: 'PREPARING', etaMinutes: eta };
  return { status: 'PLACED', etaMinutes: eta };
}

// ── payments ─────────────────────────────────────────────────────────────────
//
// ⚠️ Unlike everything above, the payment mappers are NOT verified against a
// live wire capture — the schema dump has no output shape for place_food_order /
// check_payment_status and there is no fixture. Field names below are inferred
// from the input schema (paasId, generateUPIQR) and Swiggy's usual conventions,
// and parsed permissively so an unseen shape still yields something usable. The
// service logs the raw payload on the first real UPI place so these can be
// pinned down.

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

/** First string/number-ish value among `keys`, searched one level deep too. */
function pickString(o: Record<string, unknown>, keys: string[]): string | undefined {
  const scan = (rec: Record<string, unknown>): string | undefined => {
    for (const k of keys) {
      const v = rec[k];
      if (typeof v === 'string' && v.trim()) return v;
      if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    }
    return undefined;
  };
  const top = scan(o);
  if (top) return top;
  // Swiggy sometimes nests the payload under `data`/`payment`/`order`.
  for (const container of ['data', 'payment', 'order', 'result', 'response']) {
    const nested = o[container];
    if (nested && typeof nested === 'object') {
      const hit = scan(nested as Record<string, unknown>);
      if (hit) return hit;
    }
  }
  return undefined;
}

const ORDER_ID_KEYS = ['orderId', 'order_id', 'orderID', 'id'];
const PAAS_ID_KEYS = ['paasId', 'paas_id', 'paasID', 'paymentId', 'payment_id', 'txnId'];
const QR_KEYS = ['upiQR', 'upiQr', 'qr', 'qrCode', 'qr_code', 'qrString', 'qrImage', 'qr_image', 'qrUrl'];
const INTENT_KEYS = ['upiIntent', 'intentUri', 'upiUri', 'upi_uri', 'intent', 'intentUrl', 'deeplink'];

/** place_food_order response → PlaceResult, or null if nothing recognizable. */
export function mapPlaceResult(raw: unknown): PlaceResult | null {
  const o = asRecord(raw);
  const orderId = pickString(o, ORDER_ID_KEYS);
  const paasId = pickString(o, PAAS_ID_KEYS);
  const upiQR = pickString(o, QR_KEYS);
  const upiIntentUri = pickString(o, INTENT_KEYS);

  // A paasId means an online payment is in flight — even if an (unpaid) orderId
  // was also minted, the payment still has to be completed and finalized.
  if (paasId) return { status: 'payment_pending', paasId, orderId, upiQR, upiIntentUri };
  if (orderId) return { status: 'placed', orderId };
  return null;
}

/** check_payment_status response → a normalized paid/failed/pending verdict. */
export function mapPaymentStatus(raw: unknown): PaymentStatusResult {
  const o = asRecord(raw);
  const status = pickString(o, ['status', 'paymentStatus', 'payment_status', 'state', 'txnStatus']);
  const orderId = pickString(o, ORDER_ID_KEYS);
  const s = (status ?? '').toUpperCase();
  const flag = (k: string) => o[k] === true || asRecord(o.data)[k] === true;
  const paid =
    flag('paid') || flag('success') || flag('isPaid') ||
    /SUCCESS|PAID|COMPLETE|SETTLED|CONFIRM|CAPTURED/.test(s);
  const failed = !paid && /FAIL|CANCEL|DECLIN|ERROR|EXPIRE/.test(s);
  return { paid, failed, pending: !paid && !failed, orderId, status };
}

/**
 * get_payment_options response → the methods we support. The exact wire shape is
 * unverified, so we sniff the payload for COD/UPI hints but always offer both
 * (Swiggy still validates at place time).
 */
export function mapPaymentOptions(raw: unknown): PaymentOption[] {
  const blob = JSON.stringify(raw ?? {}).toUpperCase();
  return [
    { method: 'COD', label: 'Cash on delivery', available: !blob.includes('"CODAVAILABLE":FALSE') },
    { method: 'UPI', label: 'UPI', available: !blob.includes('"UPIAVAILABLE":FALSE') },
  ];
}
