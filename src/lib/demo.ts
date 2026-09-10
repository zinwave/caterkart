/**
 * Demo / test mode for the PERSONAL flow.
 *
 * When on, order PLACEMENT is mocked — `place_food_order` is never called, so no
 * real Swiggy order is created and nothing is charged. Everything else stays
 * real: browsing, live pricing (cart build), coupons, the event tab and settle.
 *
 * Persisted in localStorage so it survives reloads, and defaulted from
 * `VITE_MOCK_ORDERS=true` if that build-time flag is set.
 */
const KEY = 'caterkart_mock_orders';

export function isMockOrders(): boolean {
  try {
    const ls = localStorage.getItem(KEY);
    if (ls != null) return ls === '1';
  } catch {
    /* no storage (SSR / privacy mode) */
  }
  return import.meta.env.VITE_MOCK_ORDERS === 'true';
}

export function setMockOrders(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** A believable fake Swiggy order id, clearly prefixed so it's never mistaken for real. */
export function mockOrderId(): string {
  const rand = Math.floor(Date.now() % 1_000_000).toString(36).toUpperCase();
  return `TEST-${rand}`;
}

/** True for orders minted by test mode — safe to mock-track. */
export function isTestOrderId(orderId: string): boolean {
  return orderId.startsWith('TEST-');
}

// First time we saw each test order, so mock tracking can advance with real time.
const firstSeen = new Map<string, number>();

/**
 * Believable, time-advancing tracking for a test order: Placed → Preparing →
 * On the way (with a rider) → Delivered over ~40s, so the tracker visibly moves
 * during a demo without any real Swiggy order.
 */
export function mockTracking(orderId: string): import('./mcp/types').TrackingState {
  let t0 = firstSeen.get(orderId);
  if (t0 == null) {
    t0 = Date.now();
    firstSeen.set(orderId, t0);
  }
  const secs = (Date.now() - t0) / 1000;
  if (secs < 8) return { status: 'PLACED', etaMinutes: 34 };
  if (secs < 18) return { status: 'PREPARING', etaMinutes: 27 };
  if (secs < 38) return { status: 'PICKED_UP', etaMinutes: 11, rider: { name: 'Rahul K.', phone: '98765 43210' } };
  return { status: 'DELIVERED', deliveredAt: 'just now' };
}
