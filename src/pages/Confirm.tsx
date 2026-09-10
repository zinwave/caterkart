import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Timeline from '../components/Timeline';
import BillSplit from '../components/BillSplit';
import { OccasionIcon } from '../components/OccasionIcon';
import RealOrderWarning from '../components/RealOrderWarning';
import CouponSheet from '../components/CouponSheet';
import { FoodImage } from '../components/RestaurantCard';
import { useCelebration } from '../state/CelebrationContext';
import type { LedgerOrder } from '../state/CelebrationContext';
import { useSwiggy } from '../state/SwiggyContext';
import { api, friendlyError } from '../lib/api';
import { isMockOrders, setMockOrders } from '../lib/demo';
import type { Bill, Cart, CartItemInput, Restaurant } from '../lib/mcp/types';
import {
  IconStore, IconCart, IconSparkles, IconCheck, IconClock, IconMapPin, IconCalendar,
  IconTruck, IconBolt, IconUsers, IconTag, IconGift, IconArrowRight, IconWallet,
} from '../components/icons/Icons';

/**
 * Swiggy's OWN restriction, quoted from the place_food_order tool description:
 *   "RESTRICTION: Order placement is NOT allowed for cart values of ₹1000 or more."
 * It is per ORDER, not per restaurant — so instead of making the user delete food,
 * we split an over-cap restaurant into several orders.
 */
const SWIGGY_CAP = 1000;

/**
 * Target ITEM total per split part. The cap applies to the final to-pay, which
 * adds ~15% taxes on top of items, so we pack to a lower item figure to leave
 * headroom. (Observed live: items ₹587 → to-pay ₹663.)
 */
const SPLIT_TARGET = 800;

/** One real Swiggy order: a restaurant, plus the slice of its items that fits under the cap. */
type Part = {
  /** stable id: restaurantId#index */
  key: string;
  restaurant: Restaurant;
  items: CartItemInput[];
  /** 1-based; `of` > 1 means this restaurant had to be split */
  index: number;
  of: number;
};

type Priced = {
  part: Part;
  bill: Bill;
  itemCount: number;
  /** still over the cap even after splitting (a single dish above ₹1000) */
  overCap: boolean;
};

type PlacedOrder = { part: Part; orderId?: string; error?: string };

/**
 * Pack a restaurant's dishes into as few orders as possible, each under the cap.
 * First-fit-decreasing over individual units: big items are placed first, then
 * smaller ones fill the gaps. A single dish costing more than the target still
 * gets its own order (and is flagged if even that breaks the cap).
 */
function splitByCap(
  lines: Array<{ id: string; price: number; qty: number }>,
  target: number,
): CartItemInput[][] {
  const units: Array<{ id: string; price: number }> = [];
  for (const l of lines) {
    for (let i = 0; i < l.qty; i++) units.push({ id: l.id, price: l.price });
  }
  units.sort((a, b) => b.price - a.price);

  const bins: Array<{ units: typeof units; total: number }> = [];
  for (const u of units) {
    const fit = bins.find((b) => b.total + u.price <= target);
    if (fit) {
      fit.units.push(u);
      fit.total += u.price;
    } else {
      bins.push({ units: [u], total: u.price });
    }
  }

  return bins.map((b) => {
    const qty = new Map<string, number>();
    for (const u of b.units) qty.set(u.id, (qty.get(u.id) ?? 0) + 1);
    return [...qty.entries()].map(([menu_item_id, quantity]) => ({ menu_item_id, quantity }));
  });
}

/**
 * Review & place.
 *
 * Three facts about real Swiggy drive this page:
 *
 *  1. A Swiggy cart is SINGLE-RESTAURANT. A celebration across N restaurants is
 *     N separate real orders. To price (or coupon) each one we load it into the
 *     user's real cart in turn — which is why pricing is a visible step, not
 *     client-side arithmetic.
 *  2. The bill is Swiggy's, not ours. Delivery, taxes and coupon discounts all
 *     come back from the cart; we never invent them.
 *  3. There is NO sandbox. Placing spends real money, so it goes through
 *     RealOrderWarning.
 */
export default function Confirm() {
  const nav = useNavigate();
  const {
    occasion, eventTitle, time, date,
    restaurantsInCart, addonSelections, allAddons, addonTotal, addonCount,
    carts, allLines, members, groupSize,
    syncedDelivery, setSyncedDelivery,
    round, recordRound, commitPlaced,
  } = useCelebration();
  const { addressId, address } = useSwiggy();

  const [priced, setPriced] = useState<Priced[]>([]);
  const [pricing, setPricing] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  /** coupon code chosen per restaurant — re-applied on every re-price and before placing */
  const [couponBy, setCouponBy] = useState<Record<string, string>>({});
  const [couponFor, setCouponFor] = useState<string | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placedOrders, setPlacedOrders] = useState<PlacedOrder[] | null>(null);
  /** Result of the single Instamart supplies order (placed after the food). */
  const [instamartResult, setInstamartResult] = useState<{ orderId?: string; error?: string } | null>(null);

  /** Test mode: mock placement (no real Swiggy order, no charge). Persisted. */
  const [testMode, setTestMode] = useState(isMockOrders());
  const toggleTestMode = (on: boolean) => {
    setMockOrders(on);
    setTestMode(on);
  };

  // Read inside priceOrder without making it a dependency: applying a coupon
  // already updates that restaurant's bill locally, so it must NOT trigger a
  // full re-price (which would re-run a setCart per restaurant).
  const couponRef = useRef(couponBy);
  couponRef.current = couponBy;

  /** set while a staggered order is being held back, so we can show a countdown */
  const [holding, setHolding] = useState<{ name: string; until: number } | null>(null);
  const skipWaitRef = useRef(false);

  // allLines = the host's picks PLUS every guest's picks (from their phones).
  const totalItems = allLines.reduce((s, l) => s + l.qty, 0);

  /**
   * Every real Swiggy order this celebration becomes: one per restaurant, and
   * MORE than one when a restaurant's basket exceeds Swiggy's ₹1000 cap.
   */
  const parts = useMemo<Part[]>(() => {
    return restaurantsInCart.flatMap((r) => {
      const lines = allLines
        .filter((l) => l.restaurantId === r.id)
        .reduce<Record<string, { id: string; price: number; qty: number }>>((acc, l) => {
          const cur = acc[l.dish.id] ?? { id: l.dish.id, price: l.dish.price, qty: 0 };
          cur.qty += l.qty;
          acc[l.dish.id] = cur;
          return acc;
        }, {});
      const bins = splitByCap(Object.values(lines), SPLIT_TARGET);
      return bins.map((items, i) => ({
        key: `${r.id}#${i}`,
        restaurant: r,
        items,
        index: i + 1,
        of: bins.length,
      }));
    });
  }, [restaurantsInCart, allLines]);

  /**
   * Load each restaurant into the real Swiggy cart in turn, re-apply its chosen
   * coupon, and keep the bill Swiggy quotes back. Sequential on purpose: the
   * account has exactly ONE cart, so these cannot run in parallel.
   */
  const priceOrder = useCallback(async () => {
    if (!addressId || parts.length === 0) return;
    setPricing(true);
    setPriceError(null);
    const out: Priced[] = [];
    try {
      for (const part of parts) {
        if (part.items.length === 0) continue;

        let cart = await api.swiggy.setCart(addressId, part.restaurant.id, part.items);
        const chosen = couponRef.current[part.key];
        if (chosen) {
          // A rebuilt cart loses its coupon — re-apply, but never fail the whole
          // page just because a coupon stopped qualifying.
          cart = await api.swiggy.applyCoupon(addressId, chosen).catch(() => cart);
        }
        out.push({
          part,
          bill: cart.bill,
          itemCount: cart.itemCount,
          overCap: cart.bill.toPay >= SWIGGY_CAP,
        });
      }
      setPriced(out);
    } catch (err) {
      setPriceError(friendlyError(err));
    } finally {
      setPricing(false);
    }
  }, [addressId, parts]);

  useEffect(() => {
    void priceOrder();
  }, [priceOrder]);

  /**
   * The placement plan.
   *
   * Swiggy has NO scheduled delivery, so "synced arrival" can only mean
   * STAGGERED PLACEMENT: order the slowest kitchen first and hold the quicker
   * ones back by their ETA difference, so everything lands together. With sync
   * off, every hold is 0 and all orders go out immediately.
   */
  const plan = useMemo(() => {
    const slowest = Math.max(0, ...priced.map((p) => p.part.restaurant.etaMin));
    return priced
      .map((p) => ({
        p,
        holdMin: syncedDelivery ? Math.max(0, slowest - p.part.restaurant.etaMin) : 0,
      }))
      .sort((a, b) => a.holdMin - b.holdMin);
  }, [priced, syncedDelivery]);

  /** How long the last order is held back — i.e. how long the tab must stay open. */
  const maxHoldMin = plan.length ? plan[plan.length - 1].holdMin : 0;

  /**
   * Place for real. Each restaurant's cart (and coupon) is rebuilt immediately
   * before its own placement, because the single shared cart still holds whichever
   * restaurant we touched last. Nothing is retried automatically —
   * place_food_order is not idempotent, so a blind retry risks double-charging.
   */
  async function placeForReal() {
    if (!addressId) return;
    setConfirming(false);
    setPlacing(true);
    skipWaitRef.current = false;
    setInstamartResult(null);
    const results: PlacedOrder[] = [];
    const startedAt = Date.now();

    for (const { p, holdMin } of plan) {
      // Hold this one back until its slot (relative to when we started).
      const dueAt = startedAt + holdMin * 60_000;
      if (dueAt > Date.now()) {
        setHolding({ name: p.part.restaurant.name, until: dueAt });
        await waitUntil(dueAt, skipWaitRef);
        setHolding(null);
      }

      try {
        await api.swiggy.setCart(addressId, p.part.restaurant.id, p.part.items);
        const chosen = couponRef.current[p.part.key];
        if (chosen) await api.swiggy.applyCoupon(addressId, chosen).catch(() => undefined);
        // Swiggy is always COD here. A "UPI" checkout doesn't pay Swiggy — the
        // host collects the bill back from the group once, after placement.
        const res = await api.swiggy.placeOrder(addressId, { paymentMethod: 'COD' });
        if (res.status === 'placed') results.push({ part: p.part, orderId: res.orderId });
        else results.push({ part: p.part, error: 'Placement failed' });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[caterkart] placement failed:', err);
        results.push({ part: p.part, error: "Couldn't place this one — you can retry." });
      }
      // Show progress as we go — a staggered run can take a while.
      setPlacedOrders([...results]);
    }

    // Instamart supplies go out as ONE order for the whole basket, after the
    // food (mocked in test mode; a real Instamart order otherwise).
    let instamart: { orderId?: string; error?: string } | null = null;
    if (allAddons.length > 0) {
      try {
        const items = allAddons.map((l) => ({ spinId: l.product.id, quantity: l.qty }));
        const { orderId } = await api.swiggy.checkoutInstamart(addressId, items, 'COD');
        instamart = { orderId };
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[caterkart] instamart checkout failed:', err);
        instamart = { error: "Couldn't place the Instamart order." };
      }
      setInstamartResult(instamart);
    }

    setPlacing(false);

    // Record this round onto the event's running tab (the open "bill"), then
    // land on the event page where the host can add another order or settle up.
    const ledgerOrders: LedgerOrder[] = results.map((r) => ({
      key: `${r.part.key}#r${round}`,
      round,
      kind: 'food' as const,
      restaurantName:
        r.part.of > 1
          ? `${r.part.restaurant.name} (${r.part.index}/${r.part.of})`
          : r.part.restaurant.name,
      orderId: r.orderId,
      error: r.error,
      toPay: priced.find((p) => p.part.key === r.part.key)?.bill.toPay ?? 0,
    }));
    if (instamart) {
      ledgerOrders.push({
        key: `instamart#r${round}`,
        round,
        kind: 'instamart' as const,
        restaurantName: 'Instamart supplies',
        orderId: instamart.orderId,
        error: instamart.error,
        toPay: addonTotal,
      });
    }
    const roundSpend: Record<string, number> = {};
    for (const l of allLines) {
      roundSpend[l.pickedBy.id] = (roundSpend[l.pickedBy.id] ?? 0) + l.dish.price * l.qty;
    }
    recordRound(ledgerOrders, roundSpend);
    // Consume the guests' pending picks so a new round doesn't re-place them.
    commitPlaced();

    const anyPlaced = results.some((r) => r.orderId) || !!instamart?.orderId;
    if (anyPlaced) setTimeout(() => nav('/event'), 2600);
  }

  const onCouponApplied = (partKey: string) => (code: string, cart: Cart) => {
    setCouponBy((m) => ({ ...m, [partKey]: code }));
    setPriced((list) =>
      list.map((p) =>
        p.part.key === partKey
          ? { ...p, bill: cart.bill, itemCount: cart.itemCount, overCap: cart.bill.toPay >= SWIGGY_CAP }
          : p,
      ),
    );
  };

  const grandTotal = priced.reduce((s, p) => s + p.bill.toPay, 0);
  const totalSaved = priced.reduce(
    (s, p) => s + p.bill.couponDiscount + (p.bill.deliveryCharge === 0 ? p.bill.deliveryChargeStrikeoff : 0),
    0,
  );
  const anyOverCap = priced.some((p) => p.overCap);
  const canPlace =
    !!addressId && priced.length > 0 && !pricing && !anyOverCap && !placing && !placedOrders;

  const couponTarget = useMemo(
    () => priced.find((p) => p.part.key === couponFor),
    [priced, couponFor],
  );

  return (
    <div className="min-h-screen bg-surface-secondary pb-32">
      {/* ══ Hero ══ */}
      <div className="bg-gradient-to-br from-swiggy-orange via-cater-coral to-rose-500 text-white">
        <div className="max-w-5xl mx-auto px-5 pt-8 pb-16">
          <Link
            to="/addons"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/80 hover:text-white transition"
          >
            ← Back to add-ons
          </Link>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/20 backdrop-blur">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-soft" />
                Final step
              </div>
              <h1 className="mt-2.5 text-3xl sm:text-[2.6rem] font-black tracking-tight leading-[1.1]">
                Review &amp; place
              </h1>
              <p className="mt-2 text-[15px] text-white/85 max-w-lg leading-relaxed">
                A Swiggy cart holds one restaurant and caps at ₹1000, so this becomes{' '}
                <strong className="text-white">
                  {parts.length} real order{parts.length === 1 ? '' : 's'}
                </strong>{' '}
                — each priced by Swiggy itself.
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/20 backdrop-blur">
                <IconWallet size={13} /> Paying with Cash on delivery
              </div>
            </div>

            {/* Occasion chip */}
            <div className="flex items-center gap-3 bg-white/15 backdrop-blur rounded-2xl px-4 py-3 shrink-0">
              <span className="w-11 h-11 rounded-xl bg-white/20 grid place-items-center shrink-0">
                <OccasionIcon icon={occasion?.icon} size={24} className="text-white" />
              </span>
              <div className="text-sm">
                <div className="font-bold leading-tight">{eventTitle}</div>
                <div className="text-white/75 text-[12px] flex items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <IconCalendar size={11} /> {date}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <IconClock size={11} /> {time}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <HeroStat icon={<IconStore size={17} />} label="Restaurants" value={restaurantsInCart.length} />
            <HeroStat icon={<IconCart size={17} />} label="Items" value={totalItems} />
            <HeroStat icon={<IconBolt size={17} />} label="Instamart add-ons" value={allAddons.length} />
            <HeroStat icon={<IconUsers size={17} />} label="Guests" value={groupSize} />
          </div>
        </div>
      </div>

      {/* ══ Body — pulled up over the hero ══ */}
      <div className="max-w-5xl mx-auto px-5 -mt-9">
        {/* Address strip */}
        <div className="card p-3.5 flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-orange-50 text-swiggy-orange grid place-items-center shrink-0">
            <IconMapPin size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-ink-tertiary">
              Delivering to
            </div>
            <div className="text-sm font-semibold text-ink-primary truncate">
              {address ? `${address.label} · ${address.display}` : 'No address selected'}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_370px] gap-6 items-start mt-6">
          {/* ── Left column ── */}
          <div className="space-y-6 min-w-0">
            <section>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-black text-lg tracking-tight text-ink-primary">
                    Your Swiggy orders
                  </h2>
                  <p className="text-[12px] text-ink-tertiary">
                    Priced live by Swiggy — tap a coupon to save more
                  </p>
                </div>
                {pricing && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-tertiary shrink-0">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-line-default border-t-swiggy-orange animate-spin-slow" />
                    Pricing…
                  </span>
                )}
              </div>

              {priceError && (
                <div className="card p-4 border-swiggy-red/40 mb-3">
                  <div className="text-sm font-semibold text-swiggy-red">{priceError}</div>
                  <button onClick={() => void priceOrder()} className="btn-ghost text-sm mt-2">
                    Try again
                  </button>
                </div>
              )}

              {pricing && priced.length === 0 && <PricingSkeleton n={restaurantsInCart.length || 2} />}

              {!pricing && !priceError && priced.length === 0 && (
                <div className="card p-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-surface-secondary text-ink-tertiary grid place-items-center mx-auto">
                    <IconCart size={22} />
                  </div>
                  <p className="mt-3 font-bold text-ink-primary">Nothing in the cart yet</p>
                  <Link
                    to="/group"
                    className="inline-flex items-center gap-1 text-sm font-bold text-swiggy-orange mt-1 hover:underline"
                  >
                    Pick some food <IconArrowRight size={14} />
                  </Link>
                </div>
              )}

              <div className="space-y-3">
                {priced.map((p) => (
                  <OrderCard
                    key={p.part.key}
                    p={p}
                    couponCode={couponBy[p.part.key] ?? p.bill.couponApplied}
                    onCoupon={() => setCouponFor(p.part.key)}
                  />
                ))}
              </div>
            </section>

            {/* Synced delivery — optional */}
            {restaurantsInCart.length > 0 && (
              <section>
                <div className="card p-4 flex items-start gap-3">
                  <span
                    className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 transition ${
                      syncedDelivery
                        ? 'bg-orange-50 text-swiggy-orange'
                        : 'bg-surface-secondary text-ink-tertiary'
                    }`}
                  >
                    <IconTruck size={19} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-ink-primary">Synced delivery</div>
                    <p className="text-[12px] text-ink-secondary leading-relaxed mt-0.5">
                      {syncedDelivery ? (
                        maxHoldMin > 0 ? (
                          <>
                            Slowest kitchen is ordered first; quicker ones are held back up to{' '}
                            <strong>{maxHoldMin} min</strong> so everything arrives together.{' '}
                            <span className="text-amber-700 font-semibold">
                              Keep this tab open while they wait.
                            </span>
                          </>
                        ) : (
                          'All your restaurants have the same ETA — nothing needs holding back.'
                        )
                      ) : (
                        'Off — all orders are placed immediately. Food arrives whenever each kitchen is done.'
                      )}
                    </p>
                  </div>
                  <Toggle
                    on={syncedDelivery}
                    onChange={setSyncedDelivery}
                    label="Toggle synced delivery"
                  />
                </div>

                {syncedDelivery && (
                  <div className="mt-3">
                    <Timeline
                      restaurants={restaurantsInCart}
                      hasInstamart={allAddons.length > 0}
                      partyTime={time}
                    />
                  </div>
                )}
              </section>
            )}

            {/* Group readiness */}
            <section>
              <h2 className="font-black text-lg tracking-tight text-ink-primary mb-3">
                Group readiness
              </h2>
              <div className="card p-4">
                <div className="divide-y divide-line-subtle">
                  {members.map((m) => {
                    const status = m.isHost ? 'ready' : (m.status ?? 'invited');
                    const meta: Record<string, { label: string; dot: string; cls: string }> = {
                      invited: { label: 'Invite sent', dot: 'bg-ink-disabled', cls: 'text-ink-tertiary' },
                      joined: { label: 'Opened', dot: 'bg-blue-500', cls: 'text-blue-600' },
                      picking: { label: 'Picking…', dot: 'bg-amber-500', cls: 'text-amber-600' },
                      ready: { label: 'Ready', dot: 'bg-swiggy-green', cls: 'text-swiggy-green' },
                    };
                    const sm = meta[status];
                    return (
                      <div key={m.id} className="flex items-center gap-3 py-2.5">
                        <div
                          className={`${m.color} w-8 h-8 rounded-full grid place-items-center text-white text-xs font-bold ring-2 ring-white shadow-card shrink-0`}
                        >
                          {m.initials}
                        </div>
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-ink-primary truncate">
                            {m.name}
                          </span>
                          {m.isHost && <span className="chip chip-orange shrink-0">Host</span>}
                        </div>
                        <span
                          className={`text-xs font-bold inline-flex items-center gap-1.5 shrink-0 ${sm.cls}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} /> {sm.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          {/* ── Bill rail ── */}
          <aside className="lg:sticky lg:top-24 space-y-3">
            {totalSaved > 0 && (
              <div className="rounded-2xl bg-green-50 border border-green-200 p-3.5 flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-swiggy-green text-white grid place-items-center shrink-0">
                  <IconTag size={17} />
                </span>
                <div className="text-sm">
                  <div className="font-black text-swiggy-green leading-tight">
                    You saved ₹{Math.round(totalSaved)}
                  </div>
                  <div className="text-[11px] text-green-700/70">Coupons + free delivery</div>
                </div>
              </div>
            )}
            {/* Test mode — mock placement so the flow can be rehearsed safely */}
            <div className={`card p-3.5 ${testMode ? 'border-blue-200 bg-blue-50/50' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black text-ink-primary flex items-center gap-1.5">
                    Test mode
                    {testMode && <span className="chip bg-blue-100 text-blue-700 text-[10px]">ON</span>}
                  </div>
                  <p className="text-[11px] text-ink-secondary leading-snug mt-0.5">
                    {testMode
                      ? 'No real order is placed and nothing is charged — everything else runs for real.'
                      : 'Rehearse the whole flow without placing a real, paid Swiggy order.'}
                  </p>
                </div>
                <Toggle on={testMode} onChange={toggleTestMode} label="Toggle test mode" />
              </div>
            </div>

            <BillSplit bills={priced.map((p) => p.bill)} />
          </aside>
        </div>
      </div>

      {/* ══ Sticky CTA ══ */}
      <div className="fixed inset-x-0 bottom-0 sticky-blur border-t border-line-default z-20">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-3">
          <div className="hidden sm:block shrink-0">
            <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-ink-tertiary">
              Total
            </div>
            <div className="text-xl font-black tabular-nums text-ink-primary leading-tight">
              ₹{grandTotal}
            </div>
          </div>
          <button
            onClick={() => setConfirming(true)}
            disabled={!canPlace}
            className="btn-primary flex-1 disabled:opacity-50 disabled:saturate-50"
          >
            <IconSparkles size={18} />
            <span className="truncate">
              {pricing
                ? 'Pricing with Swiggy…'
                : anyOverCap
                  ? 'Over Swiggy’s ₹1000 cap'
                  : `Place ${priced.length || ''} ${testMode ? 'test' : 'real'} order${priced.length === 1 ? '' : 's'}`}
            </span>
            <span className="sm:hidden opacity-90 tabular-nums">₹{grandTotal}</span>
          </button>
        </div>
      </div>

      {/* Coupon sheet — one restaurant at a time (Swiggy's cart is single-restaurant) */}
      {couponTarget && addressId && (
        <CouponSheet
          open
          addressId={addressId}
          restaurantId={couponTarget.part.restaurant.id}
          restaurantName={
            couponTarget.part.of > 1
              ? `${couponTarget.part.restaurant.name} · order ${couponTarget.part.index} of ${couponTarget.part.of}`
              : couponTarget.part.restaurant.name
          }
          items={couponTarget.part.items}
          appliedCode={couponBy[couponTarget.part.key] ?? couponTarget.bill.couponApplied}
          onApplied={onCouponApplied(couponTarget.part.key)}
          onClose={() => setCouponFor(null)}
        />
      )}

      {/* The gate before real money moves */}
      <RealOrderWarning
        open={confirming}
        lines={[
          ...priced.map((p) => ({
            id: p.part.key,
            label:
              p.part.of > 1
                ? `${p.part.restaurant.name} (${p.part.index}/${p.part.of})`
                : p.part.restaurant.name,
            sublabel: `${p.itemCount} item${p.itemCount === 1 ? '' : 's'}`,
            amount: p.bill.toPay,
          })),
          ...(allAddons.length > 0
            ? [
                {
                  id: 'instamart',
                  label: 'Instamart supplies',
                  sublabel: `${addonCount} item${addonCount === 1 ? '' : 's'} · one order`,
                  amount: addonTotal,
                },
              ]
            : []),
        ]}
        total={grandTotal + (allAddons.length > 0 ? addonTotal : 0)}
        addressLabel={address?.label}
        busy={placing}
        testMode={testMode}
        confirmLabel={testMode ? 'Yes, place test orders' : undefined}
        note={
          syncedDelivery && maxHoldMin > 0
            ? `Synced delivery: the quicker kitchens are held back up to ${maxHoldMin} min so everything arrives together. Keep this tab open — or turn sync off to place all ${priced.length} now.`
            : undefined
        }
        onConfirm={() => void placeForReal()}
        onCancel={() => setConfirming(false)}
      />

      {(placing || placedOrders) && (
        <PlacingOverlay
          placing={placing}
          results={placedOrders}
          count={priced.length}
          hasAddons={allAddons.length > 0}
          instamart={instamartResult}
          holding={holding}
          onSkipWait={() => {
            skipWaitRef.current = true;
          }}
        />
      )}

    </div>
  );
}

/* ────────────────────────── pieces ────────────────────────── */

function HeroStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white/15 backdrop-blur rounded-2xl px-3.5 py-3 flex items-center gap-3">
      <span className="w-9 h-9 rounded-xl bg-white/20 grid place-items-center shrink-0 text-white">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-xl font-black tabular-nums leading-none">{value}</div>
        <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-white/70 mt-1 truncate">
          {label}
        </div>
      </div>
    </div>
  );
}

function OrderCard({
  p,
  couponCode,
  onCoupon,
}: {
  p: Priced;
  couponCode?: string;
  onCoupon: () => void;
}) {
  const r = p.part.restaurant;
  const bill = p.bill;
  const split = p.part.of > 1;
  return (
    <div className="card overflow-hidden">
      <div className="p-4 flex items-start gap-3">
        <FoodImage src={r.imageUrl} alt={r.name} className="w-14 h-14 rounded-xl shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-bold text-ink-primary truncate flex items-center gap-1.5">
                <span className="truncate">{r.name}</span>
                {split && (
                  <span className="chip chip-orange shrink-0 text-[10px]">
                    Order {p.part.index}/{p.part.of}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-ink-tertiary truncate">
                {p.itemCount} item{p.itemCount === 1 ? '' : 's'}
                {r.etaMin > 0 && ` · ${r.etaMin} min`}
                {r.areaName && ` · ${r.areaName}`}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-black text-lg tabular-nums text-ink-primary leading-none">
                ₹{bill.toPay}
              </div>
              <div className="text-[10px] text-ink-tertiary mt-0.5">to pay</div>
            </div>
          </div>

          {/* Real Swiggy bill breakdown */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Items" value={`₹${bill.itemTotal}`} />
            <MiniStat
              label="Delivery"
              value={bill.deliveryCharge === 0 ? 'FREE' : `₹${bill.deliveryCharge}`}
              tone={bill.deliveryCharge === 0 ? 'green' : undefined}
            />
            <MiniStat label="Taxes" value={`₹${Math.round(bill.taxesAndCharges)}`} />
          </div>
        </div>
      </div>

      {/* Coupon row */}
      <button
        onClick={onCoupon}
        className={`w-full flex items-center gap-2.5 px-4 py-3 border-t transition text-left ${
          couponCode
            ? 'border-green-100 bg-green-50/60 hover:bg-green-50'
            : 'border-line-subtle hover:bg-surface-secondary'
        }`}
      >
        <span
          className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${
            couponCode ? 'bg-swiggy-green text-white' : 'bg-orange-50 text-swiggy-orange'
          }`}
        >
          {couponCode ? <IconCheck size={15} /> : <IconTag size={15} />}
        </span>
        <span className="flex-1 min-w-0">
          {couponCode ? (
            <>
              <span className="block text-sm font-bold text-swiggy-green truncate">
                {couponCode} applied
                {bill.couponDiscount > 0 && ` · saved ₹${bill.couponDiscount}`}
              </span>
              <span className="block text-[11px] text-green-700/70">Tap to change coupon</span>
            </>
          ) : (
            <>
              <span className="block text-sm font-bold text-ink-primary">Apply a coupon</span>
              <span className="block text-[11px] text-ink-tertiary">
                See Swiggy offers for this basket
              </span>
            </>
          )}
        </span>
        <IconArrowRight size={16} className="text-ink-tertiary shrink-0" />
      </button>

      {p.overCap && (
        <div className="px-4 py-2.5 bg-red-50 border-t border-red-100 text-[12px] font-semibold text-swiggy-red">
          ₹{bill.toPay} still exceeds Swiggy's ₹{SWIGGY_CAP} per-order limit even on its own — this
          single dish can't be ordered through Swiggy. Remove it to continue.
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'green' }) {
  return (
    <div className="bg-surface-secondary rounded-lg py-1.5">
      <div
        className={`text-[13px] font-bold tabular-nums ${
          tone === 'green' ? 'text-swiggy-green' : 'text-ink-primary'
        }`}
      >
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wider font-bold text-ink-tertiary">{label}</div>
    </div>
  );
}

function PricingSkeleton({ n }: { n: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: Math.min(n, 3) }).map((_, i) => (
        <div key={i} className="card p-4 animate-pulse">
          <div className="flex gap-3">
            <div className="w-14 h-14 rounded-xl bg-surface-tertiary shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 bg-surface-tertiary rounded" />
              <div className="h-3 w-1/3 bg-surface-tertiary rounded" />
              <div className="h-8 bg-surface-tertiary rounded mt-2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PlacingOverlay({
  placing,
  results,
  count,
  hasAddons,
  instamart,
  holding,
  onSkipWait,
}: {
  placing: boolean;
  results: PlacedOrder[] | null;
  count: number;
  hasAddons: boolean;
  instamart: { orderId?: string; error?: string } | null;
  holding: { name: string; until: number } | null;
  onSkipWait: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-ink-primary/60 backdrop-blur-sm z-50 grid place-items-center px-5 animate-fade-in">
      <div className="relative bg-white rounded-3xl max-w-sm w-full shadow-floating animate-pop overflow-hidden">
        <div className="relative bg-gradient-to-br from-swiggy-orange to-cater-coral px-6 pt-8 pb-7 text-center overflow-hidden">
          {!placing &&
            CONFETTI.map((c, i) => (
              <span
                key={i}
                className="confetti-piece"
                style={{ left: c.left, top: c.top, animationDelay: c.delay }}
              >
                {c.emoji}
              </span>
            ))}
          <div className="relative w-20 h-20 mx-auto grid place-items-center">
            <span className="absolute inset-0 rounded-full bg-white/25 animate-pulse-ring" />
            <span className="relative w-20 h-20 rounded-full bg-white grid place-items-center text-swiggy-orange shadow-glow animate-float">
              <IconGift size={38} />
            </span>
          </div>
          <h2 className="relative font-black text-2xl mt-4 tracking-tight text-white">
            {placing ? 'Placing on Swiggy…' : "You're all set!"}
          </h2>
          <p className="relative text-[13px] text-white/85 mt-1.5 leading-relaxed">
            {placing
              ? 'One restaurant at a time — please don’t close this tab.'
              : 'Your orders are live on Swiggy.'}
          </p>
        </div>

        <div className="p-5 space-y-2.5">
          {holding && (
            <HoldCountdown until={holding.until} name={holding.name} onSkip={onSkipWait} />
          )}

          {placing && !holding && (
            <div className="flex items-center justify-center gap-2 text-[12px] font-semibold text-ink-tertiary py-2">
              <span className="w-4 h-4 rounded-full border-2 border-line-default border-t-swiggy-orange animate-spin-slow" />
              Placing {count} order{count === 1 ? '' : 's'}…
            </div>
          )}

          {results?.map((o) => (
            <div key={o.part.key} className="flex items-center gap-3">
              <span
                className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${
                  o.orderId ? 'bg-orange-50 text-swiggy-orange' : 'bg-red-50 text-swiggy-red'
                }`}
              >
                {o.orderId ? <IconStore size={17} /> : <IconBolt size={17} />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-ink-primary leading-tight truncate">
                  {o.part.restaurant.name}
                  {o.part.of > 1 && (
                    <span className="text-ink-tertiary font-semibold">
                      {' '}({o.part.index}/{o.part.of})
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-ink-tertiary leading-tight mt-0.5 truncate">
                  {o.orderId ? `Order ${o.orderId}` : o.error}
                </div>
              </div>
              {o.orderId ? (
                <span className="w-5 h-5 rounded-full bg-swiggy-green grid place-items-center text-white shrink-0">
                  <IconCheck size={12} />
                </span>
              ) : (
                <span className="text-[11px] font-bold text-swiggy-red shrink-0">Failed</span>
              )}
            </div>
          ))}

          {hasAddons && (
            <div className="flex items-center gap-3 pt-1">
              <span
                className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${
                  instamart?.error ? 'bg-red-50 text-swiggy-red' : 'bg-purple-50 text-swiggy-mart'
                }`}
              >
                <IconTruck size={17} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-ink-primary leading-tight">
                  Instamart supplies
                </div>
                <div className="text-[12px] text-ink-tertiary leading-tight mt-0.5 truncate">
                  {placing && !instamart
                    ? 'Placing…'
                    : instamart?.orderId
                      ? `Order ${instamart.orderId}`
                      : instamart?.error ?? 'One order, arrives ~15 min before the food'}
                </div>
              </div>
              {instamart?.orderId ? (
                <span className="w-5 h-5 rounded-full bg-swiggy-green grid place-items-center text-white shrink-0">
                  <IconCheck size={12} />
                </span>
              ) : instamart?.error ? (
                <span className="text-[11px] font-bold text-swiggy-red shrink-0">Failed</span>
              ) : null}
            </div>
          )}

          {results?.some((o) => o.orderId) && (
            <div className="pt-3 flex items-center justify-center gap-2 text-[12px] font-semibold text-ink-tertiary">
              <span className="w-4 h-4 rounded-full border-2 border-line-default border-t-swiggy-orange animate-spin-slow" />
              Opening your event…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Sleep until `dueAt`, but let the user skip the wait (they may not want to keep
 * the tab open for 30 minutes). Polls in 1s steps so the countdown can tick.
 */
async function waitUntil(dueAt: number, skipRef: { current: boolean }) {
  while (Date.now() < dueAt && !skipRef.current) {
    await new Promise((r) => setTimeout(r, 1000));
  }
  skipRef.current = false;
}

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
        on ? 'bg-swiggy-orange' : 'bg-line-default'
      }`}
    >
      <span
        className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all ${
          on ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  );
}

/** Live countdown while a staggered order is held back. */
function HoldCountdown({ until, name, onSkip }: { until: number; name: string; onSkip: () => void }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const left = Math.max(0, until - Date.now());
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);

  return (
    <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-center">
      <div className="text-[11px] uppercase tracking-[0.12em] font-bold text-amber-700">
        Holding back for synced arrival
      </div>
      <div className="text-3xl font-black tabular-nums text-amber-900 mt-1">
        {mm}:{String(ss).padStart(2, '0')}
      </div>
      <p className="text-[12px] text-amber-800 mt-1 leading-snug">
        <strong>{name}</strong> is a quicker kitchen, so we're waiting before ordering it. Keep this
        tab open.
      </p>
      <button
        onClick={onSkip}
        className="mt-2.5 text-[12px] font-bold text-amber-900 underline hover:no-underline"
      >
        Skip the wait — order now
      </button>
    </div>
  );
}

const CONFETTI = [
  { emoji: '🎉', left: '10%', top: '60%', delay: '0s' },
  { emoji: '✨', left: '30%', top: '70%', delay: '0.15s' },
  { emoji: '🎊', left: '60%', top: '65%', delay: '0.3s' },
  { emoji: '🥳', left: '80%', top: '70%', delay: '0.45s' },
  { emoji: '🍕', left: '20%', top: '75%', delay: '0.6s' },
  { emoji: '🥤', left: '70%', top: '78%', delay: '0.75s' },
  { emoji: '⭐', left: '45%', top: '72%', delay: '0.2s' },
  { emoji: '🎈', left: '55%', top: '80%', delay: '0.5s' },
];
