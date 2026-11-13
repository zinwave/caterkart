/**
 * CaterKart backend client.
 *
 * The app talks to the NestJS API (under server/), which owns the Swiggy OAuth
 * grant and every MCP call. Tokens never reach the browser — the backend holds
 * them. Set VITE_API_BASE to point at the API.
 */
import { isMockOrders, mockOrderId, isTestOrderId, mockTracking } from './demo';
import type {
  Address,
  Cart,
  CartItemInput,
  Coupon,
  CreateAddressInput,
  Dish,
  Menu,
  OrderId,
  OrderSummary,
  PaymentMethod,
  PlaceResult,
  PaymentStatusResult,
  PaymentOption,
  UpiApp,
  Product,
  Restaurant,
  TrackingState,
} from './mcp/types';

const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:4000';

// Identity travels in an httpOnly session cookie set by the Swiggy OAuth
// callback, so `credentials: 'include'` below is the whole mechanism. This used
// to send an `x-user-id` header the client chose for itself, which let any
// caller name someone else's account and spend their Swiggy grant.
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, body || res.statusText);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  /** The Swiggy grant expired — they last ~5 days and there is no refresh token. */
  get needsSwiggyAuth() {
    return this.status === 401 || /reauth|authorization required/i.test(this.message);
  }
}

/**
 * A safe, human message for the UI. We never surface raw Swiggy/MCP error text
 * (it's internal and unfriendly) — the real error is logged for debugging and
 * the user sees a calm, reassuring line instead.
 */
export function friendlyError(e: unknown): string {
  if (e instanceof ApiError && e.needsSwiggyAuth) {
    return 'Your Swiggy session timed out — reconnect to continue.';
  }
  try {
    // eslint-disable-next-line no-console
    console.warn('[caterkart] handled error:', e);
  } catch {
    /* ignore */
  }
  return 'Swiggy is taking a moment — please try again in a few seconds.';
}

const qs = (o: Record<string, string | undefined>) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
    .join('&');

export const api = {
  // ── Identity ─────────────────────────────────────────────────────────────
  // Swiggy is the identity provider: `begin` is both sign-in and sign-up, and
  // the callback opens the app session. There is no separate account to create.
  auth: {
    /** 401 when signed out — that is the ordinary case, not an error. */
    session: () =>
      req<{
        user: { id: string; name: string; phone: string | null };
        swiggy: { connected: boolean; expiresAt?: string };
      }>(`/auth/swiggy/session`),
    begin: (redirectAfter?: string) =>
      req<{ authorizeUrl: string }>(`/auth/swiggy/begin`, {
        method: 'POST',
        body: JSON.stringify({ redirectAfter }),
      }),
    /** Ends the app session; the Swiggy grant survives for the next sign-in. */
    logout: () => req(`/auth/swiggy/logout`, { method: 'POST', body: '{}' }),
  },

  // ── Swiggy connection ────────────────────────────────────────────────────
  swiggy: {
    status: () => req<{ connected: boolean; expiresAt?: string }>(`/auth/swiggy/status`),
    begin: (redirectAfter?: string) =>
      req<{ authorizeUrl: string }>(`/auth/swiggy/begin`, {
        method: 'POST',
        body: JSON.stringify({ redirectAfter }),
      }),
    /** Revokes the grant but keeps the account, its celebrations and history. */
    disconnect: () => req(`/auth/swiggy/disconnect`, { method: 'POST', body: '{}' }),

    // ── Discover ──
    addresses: () => req<Address[]>(`/swiggy/addresses`),
    /**
     * Saves a REAL address on the user's Swiggy account. Both of these return
     * the refreshed list, so there's no need to re-fetch after calling them.
     */
    createAddress: (input: CreateAddressInput) =>
      req<Address[]>(`/swiggy/addresses`, { method: 'POST', body: JSON.stringify(input) }),
    /** ⚠️ Permanent on Swiggy's side. Confirm with the user first. */
    deleteAddress: (addressId: string) =>
      req<Address[]>(`/swiggy/addresses/${encodeURIComponent(addressId)}`, { method: 'DELETE' }),
    restaurants: (addressId: string, query = '', openOnly = true) =>
      req<Restaurant[]>(
        `/swiggy/restaurants?${qs({ addressId, query, openOnly: String(openOnly) })}`,
      ),
    menu: (restaurantId: string, addressId: string, page = 1) =>
      req<Menu>(`/swiggy/restaurants/${restaurantId}/menu?${qs({ addressId, page: String(page) })}`),
    /** Dish-level search — the only call that returns addon groups. */
    dishes: (addressId: string, query: string, restaurantId?: string) =>
      req<Dish[]>(`/swiggy/dishes?${qs({ addressId, query, restaurantId })}`),

    // ── Cart (single-restaurant; mirrors the user's REAL Swiggy cart) ──
    getCart: (addressId: string) => req<Cart>(`/swiggy/cart?${qs({ addressId })}`),
    setCart: (addressId: string, restaurantId: string, items: CartItemInput[]) =>
      req<Cart>(`/swiggy/cart`, {
        method: 'POST',
        body: JSON.stringify({ addressId, restaurantId, items }),
      }),
    flushCart: () => req<Cart>(`/swiggy/cart`, { method: 'DELETE' }),
    /** Coupons for the CURRENT cart — build the cart first, applicability depends on its value. */
    coupons: (addressId: string, restaurantId: string) =>
      req<Coupon[]>(`/swiggy/cart/coupons?${qs({ addressId, restaurantId })}`),
    applyCoupon: (addressId: string, couponCode: string) =>
      req<Cart>(`/swiggy/cart/coupon`, {
        method: 'POST',
        body: JSON.stringify({ addressId, couponCode }),
      }),

    // ── Orders ──
    /**
     * ⚠️ Places a REAL, paid Swiggy order. Confirm with the user first.
     * COD → `{ status: 'placed', orderId }`. UPI → `{ status: 'payment_pending',
     * paasId, upiQR? }`, which must then be settled via `paymentStatus`.
     */
    placeOrder: async (
      addressId: string,
      opts: { paymentMethod?: PaymentMethod; intentApp?: UpiApp; generateUPIQR?: boolean } = {},
    ): Promise<PlaceResult> => {
      // Demo/test mode: never hit place_food_order — fake a placed order so the
      // whole flow can be exercised without a real, paid Swiggy order.
      if (isMockOrders()) {
        await new Promise((r) => setTimeout(r, 650));
        return { status: 'placed', orderId: mockOrderId() };
      }
      return req<PlaceResult>(`/swiggy/orders`, {
        method: 'POST',
        body: JSON.stringify({
          addressId,
          paymentMethod: opts.paymentMethod ?? 'COD',
          intentApp: opts.intentApp,
          generateUPIQR: opts.generateUPIQR,
        }),
      });
    },
    /** Payment methods valid for this cart amount (COD / UPI). */
    paymentOptions: (addressId: string, cartAmount: number) =>
      req<PaymentOption[]>(`/swiggy/payment/options?${qs({ addressId, cartAmount: String(cartAmount) })}`),
    /** Poll / finalize a UPI payment while the payer scans the QR. */
    paymentStatus: (body: {
      paasId: string;
      orderId?: string;
      addressId?: string;
      cartId?: string;
      finalize?: boolean;
    }) =>
      req<PaymentStatusResult>(`/swiggy/payment/status`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    orders: (addressId: string, activeOnly = false) =>
      req<OrderSummary[]>(`/swiggy/orders?${qs({ addressId, activeOnly: String(activeOnly) })}`),
    track: async (orderId: string): Promise<TrackingState> => {
      // Test orders aren't real, so mock a moving rider/delivery timeline.
      if (isTestOrderId(orderId)) {
        await new Promise((r) => setTimeout(r, 300));
        return mockTracking(orderId);
      }
      return req<TrackingState>(`/swiggy/orders/${orderId}/track`);
    },

    // ── Instamart ──
    goTo: (addressId: string) => req<Product[]>(`/swiggy/instamart/go-to?${qs({ addressId })}`),
    searchProducts: (addressId: string, query = '') =>
      req<Product[]>(`/swiggy/instamart/search?${qs({ addressId, query })}`),
    /** ⚠️ Places a REAL, paid Instamart order (mocked in test mode). */
    checkoutInstamart: async (
      addressId: string,
      items: Array<{ spinId: string; quantity: number }>,
      paymentMethod: PaymentMethod = 'COD',
    ): Promise<{ orderId: OrderId }> => {
      if (isMockOrders()) {
        await new Promise((r) => setTimeout(r, 650));
        return { orderId: mockOrderId() };
      }
      return req<{ orderId: OrderId }>(`/swiggy/instamart/checkout`, {
        method: 'POST',
        body: JSON.stringify({ addressId, items, paymentMethod }),
      });
    },
  },

  // ── Celebrations (host side) ─────────────────────────────────────────────
  celebrations: {
    create: (body: CreateCelebrationBody) =>
      req<CelebrationView>(`/celebrations`, { method: 'POST', body: JSON.stringify(body) }),
    list: () => req<CelebrationView[]>(`/celebrations`),
    get: (id: string) => req<CelebrationView>(`/celebrations/${id}`),
    setAddress: (id: string, swiggyAddressId: string) =>
      req(`/celebrations/${id}/address`, {
        method: 'PUT',
        body: JSON.stringify({ swiggyAddressId }),
      }),

    /** The host's REAL address book — people they have actually invited before. */
    contacts: () => req<Contact[]>(`/celebrations/contacts`),

    /** Adds the guest AND mints their personal invite link in one call. */
    addGuest: (id: string, g: GuestInput) =>
      req<{ member: CelebrationMember; invite: InviteLink }>(`/celebrations/${id}/guests`, {
        method: 'POST',
        body: JSON.stringify(g),
      }),
    updateGuest: (id: string, memberId: string, patch: Partial<GuestInput>) =>
      req<CelebrationMember>(`/celebrations/${id}/guests/${memberId}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      }),
    removeGuest: (id: string, memberId: string) =>
      req(`/celebrations/${id}/guests/${memberId}`, { method: 'DELETE' }),

    /** A shareable link anyone can open (not addressed to one person). */
    invite: (id: string) =>
      req<InviteLink>(`/celebrations/${id}/invites`, { method: 'POST', body: '{}' }),

    place: (id: string) => req(`/celebrations/${id}/place`, { method: 'POST', body: '{}' }),
    /**
     * Live order + settlement updates.
     *
     * `withCredentials` is what sends the session cookie: the stream is
     * host-only on the server, and EventSource omits credentials on a
     * cross-origin request unless asked — so without this the connection is
     * anonymous and is refused.
     */
    stream: (id: string) =>
      new EventSource(`${API_BASE}/api/celebrations/${id}/stream`, { withCredentials: true }),
  },

  // ── Invites (guest side — the token IS the credential; no login) ──────────
  invites: {
    preview: (token: string) => req<InvitePreview>(`/invites/${token}`),
    accept: (token: string, g: GuestInput) =>
      req<{ celebrationId: string; member: CelebrationMember }>(`/invites/${token}/accept`, {
        method: 'POST',
        body: JSON.stringify(g),
      }),
    /** Real Swiggy, brokered with the HOST's grant — a guest needs no Swiggy account. */
    restaurants: (token: string, query = '') =>
      req<Restaurant[]>(`/invites/${token}/restaurants?${qs({ query })}`),
    menu: (token: string, restaurantId: string) =>
      req<Menu>(`/invites/${token}/restaurants/${restaurantId}/menu`),
    /** Instamart products for a guest — brokered with the host's grant. */
    instamart: (token: string, query = '') =>
      req<Product[]>(`/invites/${token}/instamart?${qs({ query })}`),
    savePicks: (token: string, memberId: string, picks: GuestPick[]) =>
      req<{ ok: boolean; count: number }>(`/invites/${token}/picks`, {
        method: 'PUT',
        body: JSON.stringify({ memberId, picks }),
      }),
    ready: (token: string, memberId: string) =>
      req<CelebrationMember>(`/invites/${token}/ready`, {
        method: 'POST',
        body: JSON.stringify({ memberId }),
      }),
  },
};

// ── shapes the backend serves ───────────────────────────────────────────────

export type MemberStatus = 'INVITED' | 'JOINED' | 'PICKING' | 'READY';

export type GuestInput = {
  name: string;
  email?: string;
  phone?: string;
  dietary?: string;
  isKid?: boolean;
};

export type GuestPick = {
  restaurantId: string;
  restaurantName: string;
  dishId: string;
  dishName: string;
  price: number;
  qty: number;
  veg?: boolean;
  imageUrl?: string;
  /** 'instamart' picks use restaurantId 'instamart'; default is a restaurant dish. */
  kind?: 'food' | 'instamart';
  // Restaurant metadata so the host can show ETA / area for a guest's spots.
  restaurantEtaMin?: number;
  restaurantEtaRange?: string;
  restaurantArea?: string;
  restaurantRating?: number;
};

export type CelebrationMember = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  dietary?: string | null;
  isKid: boolean;
  isHost: boolean;
  status: MemberStatus;
  picks?: GuestPick[];
};

export type CelebrationView = {
  id: string;
  occasion: string;
  addressLabel: string;
  swiggyAddressId?: string | null;
  members: CelebrationMember[];
};

export type CreateCelebrationBody = {
  occasion: string;
  hostName?: string;
  addressLabel: string;
  swiggyAddressId?: string;
  members: Array<{ name: string; phone?: string; isHost?: boolean }>;
};

export type InviteLink = { token: string; url: string; memberId?: string | null };

/** A person the host has actually invited before. No seeded friends list exists. */
export type Contact = {
  name: string;
  email?: string;
  phone?: string;
  dietary?: string;
  times: number;
};

export type InvitePreview = {
  celebrationId: string;
  occasion: string;
  hostName: string;
  addressLabel: string;
  hasAddress: boolean;
  members: Array<{ id: string; name: string; isHost: boolean; dietary?: string | null; status: MemberStatus }>;
  invitedMember: {
    id: string;
    name: string;
    dietary?: string | null;
    isKid: boolean;
    status: MemberStatus;
    /** their saved picks — lets a guest resume on any device, not just the first */
    picks: GuestPick[];
  } | null;
};
