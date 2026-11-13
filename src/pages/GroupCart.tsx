import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Member } from '../data/mock';
import type { Dish, Menu, Restaurant } from '../lib/mcp/types';
import RestaurantCard, { FoodImage } from '../components/RestaurantCard';
import DishRow from '../components/DishRow';
import FilterBar from '../components/FilterBar';
import {
  applyToDishes, applyToRestaurants, defaultFilters, RestaurantFilters,
} from '../utils/filters';
import { MemberAvatar, MemberStack } from '../components/MemberAvatar';
import { useCelebration } from '../state/CelebrationContext';
import { useSwiggy } from '../state/SwiggyContext';
import { useMenu, useRestaurants } from '../hooks/useSwiggyData';
import {
  IconArrowRight, IconPlus, IconClose, IconStore, IconClock, IconStar,
  IconTruck, IconSparkles, IconCart, IconSearch, IconAlertTriangle,
  IconMapPin, IconRefresh, IconCheck,
  SwiggyMark,
} from '../components/icons/Icons';
import { AFTER_CART, SHOW_INSTAMART_STEP } from '../config/features';

const SWIGGY_ORDER_CAP = 1000;

export default function GroupCart() {
  const {
    carts, allLines, addLine, changeQty,
    members, host, guests,
    foodTotal, restaurantsInCart,
  } = useCelebration();

  const { connected, addressId, address, connect } = useSwiggy();

  const [openRestaurant, setOpenRestaurant] = useState<Restaurant | null>(null);
  const [filters, setFilters] = useState<RestaurantFilters>(defaultFilters);

  /** Who the next dish gets attributed to. Defaults to the host. */
  const [pickingId, setPickingId] = useState<string>(host.id);
  const picking = useMemo(
    () => members.find((m) => m.id === pickingId) ?? host,
    [members, pickingId, host],
  );

  // Swiggy searches server-side — the query goes to it, not to a local array.
  const {
    data: searchResults, loading: loadingRestaurants, error: restaurantsError, reload: reloadRestaurants,
  } = useRestaurants(filters.q);

  // Menus are a separate per-restaurant call — nothing to read off the restaurant.
  const menu = useMenu(openRestaurant?.id ?? null);

  const otherRestaurants = useMemo(
    () => searchResults.filter((r) => !restaurantsInCart.some((rc) => rc.id === r.id)),
    [searchResults, restaurantsInCart]
  );

  const filteredOthers = useMemo(
    () => applyToRestaurants(otherRestaurants, filters),
    [otherRestaurants, filters]
  );

  // Group EVERY line — the host's own picks AND every guest's picks that have
  // synced from the backend — so guests' restaurants show their items, not ₹0.
  const linesByRestaurant = useMemo(() => {
    const map: Record<string, typeof allLines> = {};
    allLines.forEach((l) => {
      (map[l.restaurantId] = map[l.restaurantId] || []).push(l);
    });
    return map;
  }, [allLines]);

  const subtotalFor = (rid: string) =>
    (linesByRestaurant[rid] ?? []).reduce((s, l) => s + l.dish.price * l.qty, 0);

  const itemCountFor = (rid: string) =>
    (linesByRestaurant[rid] ?? []).reduce((s, l) => s + l.qty, 0);

  /**
   * The context mutates cart lines BY INDEX, so every stepper action first has to
   * resolve (dish, member, restaurant) → index into `carts`.
   */
  const lineIndexOf = useCallback(
    (dishId: string, memberId: string, restaurantId: string) =>
      carts.findIndex(
        (l) => l.dish.id === dishId && l.pickedBy.id === memberId && l.restaurantId === restaurantId,
      ),
    [carts],
  );

  /** Qty of a dish for the member currently picking, in the open restaurant. */
  const qtyFor = useCallback(
    (dish: Dish) => {
      if (!openRestaurant) return 0;
      const i = lineIndexOf(dish.id, picking.id, openRestaurant.id);
      return i >= 0 ? carts[i].qty : 0;
    },
    [carts, lineIndexOf, openRestaurant, picking.id],
  );

  const addDish = useCallback(
    (dish: Dish) => {
      if (!openRestaurant || !openRestaurant.isOpen || !dish.inStock) return;
      addLine(dish, openRestaurant, picking);
    },
    [addLine, openRestaurant, picking],
  );

  const incDish = useCallback(
    (dish: Dish) => {
      if (!openRestaurant) return;
      const i = lineIndexOf(dish.id, picking.id, openRestaurant.id);
      if (i >= 0) changeQty(i, 1);
      else addDish(dish);
    },
    [addDish, changeQty, lineIndexOf, openRestaurant, picking.id],
  );

  const decDish = useCallback(
    (dish: Dish) => {
      if (!openRestaurant) return;
      const i = lineIndexOf(dish.id, picking.id, openRestaurant.id);
      if (i >= 0) changeQty(i, -1); // context drops the line when it hits 0
    },
    [changeQty, lineIndexOf, openRestaurant, picking.id],
  );

  // status counts
  const readyCount = guests.filter((g) => g.status === 'ready').length + 1; // host
  const pickingCount = guests.filter((g) => g.status === 'picking' || g.status === 'joined').length;
  const invitedCount = guests.filter((g) => g.status === 'invited').length;

  const totalItems = allLines.reduce((s, l) => s + l.qty, 0);

  function openMenu(r: Restaurant) {
    if (!r.isOpen) return; // Swiggy would refuse the order anyway
    setOpenRestaurant(r);
  }

  if (members.length === 1) {
    // host only — guests not added yet
    return (
      <div className="max-w-5xl mx-auto px-5 py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-surface-secondary grid place-items-center text-ink-tertiary mx-auto mb-3">
          <IconAlertTriangle size={24} />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-ink-primary">Add some guests first</h1>
        <p className="text-sm text-ink-secondary mt-2 max-w-sm mx-auto leading-relaxed">
          CaterKart works best when there's at least one other person — different cravings is the
          whole point. Head back to add a guest.
        </p>
        <Link to="/create" className="btn-primary mt-6 inline-flex">← Add guests</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 pb-32">
      {/* Header */}
      <div className="reveal">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="section-title">Step 2 of 3</div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white border border-line-subtle text-ink-secondary shadow-card">
            <span className="w-1.5 h-1.5 rounded-full bg-swiggy-green animate-pulse-soft" />
            Live menu · powered by <SwiggyMark size={13} className="align-middle" />
          </span>
        </div>
        <h1 className="mt-2.5 text-3xl sm:text-4xl font-black tracking-tight text-ink-primary">
          Build the <span className="text-swiggy-orange">group cart</span>
        </h1>
        <p className="mt-2 text-[15px] text-ink-secondary max-w-xl">
          Everyone picks from any restaurant. CaterKart places each one on Swiggy and staggers them
          so the whole spread lands together.
        </p>
        {address && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-tertiary">
            <IconMapPin size={13} /> Delivering to <span className="text-ink-secondary">{address.label}</span>
            <span className="text-line-default">·</span>
            <span className="truncate max-w-[16rem]">{address.display}</span>
          </div>
        )}
      </div>

      {/* Group ribbon */}
      <div className="card p-3.5 mt-6 flex items-center gap-3 reveal" style={{ animationDelay: '80ms' }}>
        <MemberStack ms={members} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-ink-primary">{members.length} in this celebration</div>
          <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] font-semibold">
            <span className="inline-flex items-center gap-1 text-swiggy-green"><Dot className="bg-swiggy-green" /> {readyCount} ready</span>
            {pickingCount > 0 && <span className="inline-flex items-center gap-1 text-amber-600"><Dot className="bg-amber-500" /> {pickingCount} picking</span>}
            {invitedCount > 0 && <span className="inline-flex items-center gap-1 text-ink-tertiary"><Dot className="bg-ink-disabled" /> {invitedCount} not opened</span>}
          </div>
        </div>
      </div>

      {/* Who's picking — every dish added from a menu lands on this member's tab */}
      <div className="card p-3.5 mt-3 reveal" style={{ animationDelay: '120ms' }}>
        <div className="text-[11px] uppercase tracking-[0.14em] font-bold text-ink-tertiary mb-2">
          Picking for
        </div>
        <MemberPicker members={members} selectedId={picking.id} onSelect={setPickingId} />
      </div>

      {/* Carts grouped per restaurant */}
      {restaurantsInCart.length > 0 && (
        <div className="mt-8">
          <div className="section-title mb-3">Your picks · {restaurantsInCart.length} restaurant{restaurantsInCart.length > 1 ? 's' : ''}</div>

          <div className="space-y-3">
            {restaurantsInCart.map((r) => {
              const sub = subtotalFor(r.id);
              const willSplit = sub > SWIGGY_ORDER_CAP;
              return (
                <div key={r.id} className="card overflow-hidden">
                  {/* Restaurant header */}
                  <div className="px-4 py-3 flex items-center gap-3 border-b border-line-subtle bg-surface-secondary/50">
                    <FoodImage
                      src={r.imageUrl}
                      alt={r.name}
                      className="w-11 h-11 rounded-xl shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-ink-primary truncate">{r.name}</div>
                      <div className="text-[12px] text-ink-tertiary flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center gap-1">
                          <IconStar size={12} className="text-swiggy-green" /> {r.rating != null ? r.rating.toFixed(1) : 'New'}
                        </span>
                        <span className="text-line-default">·</span>
                        <span className="inline-flex items-center gap-1"><IconClock size={12} /> {r.etaMin} min</span>
                      </div>
                    </div>
                    <button
                      onClick={() => openMenu(r)}
                      disabled={!r.isOpen}
                      className="inline-flex items-center gap-1 text-xs font-bold text-swiggy-orange hover:bg-orange-50 px-2.5 py-1.5 rounded-lg transition disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                    >
                      <IconPlus size={14} /> {r.isOpen ? 'Add more' : 'Closed'}
                    </button>
                  </div>

                  {/* Lines */}
                  <div className="divide-y divide-line-subtle">
                    {linesByRestaurant[r.id]?.map((l, li) => {
                      // Only the host's OWN lines live in `carts` and are editable;
                      // guest picks are backend-owned, so they render read-only.
                      const idx = carts.indexOf(l);
                      const editable = idx >= 0;
                      return (
                        <div
                          key={`${l.dish.id}-${l.pickedBy.id}-${li}`}
                          className="px-4 py-2.5 flex items-center gap-3"
                        >
                          <VegDot veg={l.dish.veg} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-ink-primary leading-tight truncate">{l.dish.name}</div>
                            <div className="text-[11px] text-ink-tertiary flex items-center gap-1 mt-0.5">
                              for <MemberAvatar m={l.pickedBy} size={14} /> {l.pickedBy.name.split(' ')[0]}
                              {!editable && (
                                <span className="ml-1 text-[9px] uppercase tracking-wide font-bold text-ink-tertiary bg-surface-secondary px-1.5 py-0.5 rounded">
                                  guest
                                </span>
                              )}
                            </div>
                          </div>
                          {editable ? (
                            <QtyStepper qty={l.qty} onDec={() => changeQty(idx, -1)} onInc={() => changeQty(idx, 1)} />
                          ) : (
                            <span className="text-sm font-bold text-ink-secondary tabular-nums px-2 shrink-0">
                              × {l.qty}
                            </span>
                          )}
                          <div className="w-16 text-right text-sm font-bold text-ink-primary tabular-nums">₹{l.dish.price * l.qty}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Per-restaurant footer */}
                  <div className="px-4 py-2.5 border-t border-line-subtle flex items-center justify-between text-[12px]">
                    <span className="text-ink-tertiary inline-flex items-center gap-1.5">
                      <IconStore size={13} />
                      {willSplit
                        ? <>Placed as <b className="text-ink-secondary">2 Swiggy orders</b> (₹1,000 cap)</>
                        : <>Placed as <b className="text-ink-secondary">1 Swiggy order</b></>}
                    </span>
                    <span className="font-bold text-ink-secondary tabular-nums">Subtotal ₹{sub}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add another restaurant */}
      <div className="mt-9">
        <div className="section-title mb-3">
          {restaurantsInCart.length === 0 ? 'Pick your first restaurant' : 'Add another restaurant'}
        </div>

        {!addressId ? (
          <AddressGate connected={connected} onConnect={() => void connect()} />
        ) : (
          <>
            <FilterBar filters={filters} setFilters={setFilters} className="mb-4" />

            {restaurantsError ? (
              <ErrorPanel message={restaurantsError} onRetry={reloadRestaurants} />
            ) : loadingRestaurants && filteredOthers.length === 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[0, 1, 2, 3, 4, 5].map((i) => <RestaurantSkeleton key={i} />)}
              </div>
            ) : filteredOthers.length === 0 ? (
              <div className="card p-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-surface-secondary grid place-items-center text-ink-tertiary mx-auto mb-3">
                  <IconSearch size={24} />
                </div>
                <div className="font-bold text-ink-primary">No restaurants match</div>
                <div className="text-xs text-ink-tertiary mt-1 mb-4">
                  {searchResults.length > 0 && otherRestaurants.length === 0
                    ? "You've added every restaurant Swiggy returned — go pick some dishes above."
                    : 'Swiggy found nothing nearby for this search. Try another dish, or clear the filters.'}
                </div>
                <button onClick={() => setFilters(defaultFilters())} className="btn-secondary inline-flex">
                  Clear filters
                </button>
              </div>
            ) : (
              <div className={loadingRestaurants ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredOthers.map((r) => (
                    <RestaurantCard key={r.id} r={r} onClick={() => openMenu(r)} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Orchestration note (MCP) */}
      {restaurantsInCart.length > 0 && (
        <div className="mt-6 card p-4 flex items-start gap-3 bg-gradient-to-br from-orange-50/70 to-white border-orange-200">
          <div className="w-10 h-10 rounded-xl bg-white grid place-items-center text-swiggy-orange shrink-0 shadow-card">
            <IconTruck size={20} />
          </div>
          <div className="text-[13px]">
            <div className="font-bold text-ink-primary flex items-center gap-1.5">
              Synced delivery is on <IconSparkles size={14} className="text-swiggy-orange" />
            </div>
            <div className="text-ink-secondary leading-relaxed mt-0.5">
              We stagger placement across {restaurantsInCart.length} restaurant{restaurantsInCart.length > 1 ? 's' : ''} on Swiggy so everything
              arrives within ~5 min of each other. Any order over ₹1,000 is split and reconciled automatically —
              you never see the seam.
            </div>
          </div>
        </div>
      )}

      {/* Sticky footer */}
      <div className="fixed inset-x-0 bottom-0 sticky-blur border-t border-line-default z-20">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-ink-tertiary inline-flex items-center gap-1.5">
              <IconCart size={13} /> {totalItems} item{totalItems === 1 ? '' : 's'} · {restaurantsInCart.length} restaurant{restaurantsInCart.length === 1 ? '' : 's'}
            </div>
            <div className="font-black text-lg text-ink-primary tabular-nums leading-tight">₹{foodTotal}</div>
          </div>
          <Link to="/create" className="btn-ghost text-sm">← Guests</Link>
          <Link
            to={AFTER_CART}
            className={`btn-primary ${carts.length === 0 ? 'opacity-50 saturate-50 pointer-events-none' : ''}`}
          >
            {SHOW_INSTAMART_STEP ? 'Instamart sides' : 'Review order'} <IconArrowRight size={18} />
          </Link>
        </div>
      </div>

      {/* Menu sheet */}
      {openRestaurant && (
        <MenuSheet
          restaurant={openRestaurant}
          menu={menu.data}
          loading={menu.loading}
          error={menu.error}
          onRetry={menu.reload}
          members={members}
          picking={picking}
          onPick={setPickingId}
          qtyFor={qtyFor}
          onAdd={addDish}
          onInc={incDish}
          onDec={decDish}
          items={itemCountFor(openRestaurant.id)}
          subtotal={subtotalFor(openRestaurant.id)}
          onClose={() => setOpenRestaurant(null)}
        />
      )}
    </div>
  );
}

function Dot({ className = '' }: { className?: string }) {
  return <span className={`w-1.5 h-1.5 rounded-full ${className}`} />;
}

function VegDot({ veg }: { veg: boolean }) {
  return (
    <span className={`inline-grid place-items-center w-3.5 h-3.5 border-[1.5px] shrink-0 ${veg ? 'border-swiggy-green' : 'border-swiggy-red'}`}>
      <span className={`block w-1.5 h-1.5 rounded-full ${veg ? 'bg-swiggy-green' : 'bg-swiggy-red'}`} />
    </span>
  );
}

function QtyStepper({ qty, onDec, onInc }: { qty: number; onDec: () => void; onInc: () => void }) {
  return (
    <div className="flex items-center bg-white border border-line-default rounded-lg text-sm overflow-hidden shadow-card">
      <button onClick={onDec} className="px-2.5 py-1 text-swiggy-orange font-bold hover:bg-orange-50 transition">−</button>
      <span className="px-1.5 font-bold text-ink-primary tabular-nums min-w-[1.5rem] text-center">{qty}</span>
      <button onClick={onInc} className="px-2.5 py-1 text-swiggy-orange font-bold hover:bg-orange-50 transition">+</button>
    </div>
  );
}

const isVegLike = (m: Member) => m.dietary === 'veg' || m.dietary === 'jain' || m.dietary === 'vegan';

/** Horizontal member chips — whoever is selected owns the next dish added. */
function MemberPicker({
  members, selectedId, onSelect, compact = false,
}: {
  members: Member[]; selectedId: string; onSelect: (id: string) => void; compact?: boolean;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar">
      {members.map((m) => {
        const active = m.id === selectedId;
        return (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            aria-pressed={active}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border-2 font-semibold transition active:scale-95 ${
              compact ? 'px-2.5 py-1 text-[12px]' : 'px-3 py-1.5 text-sm'
            } ${
              active
                ? 'bg-orange-50 border-swiggy-orange text-swiggy-orange'
                : 'bg-white border-line-default text-ink-secondary hover:border-line-default'
            }`}
          >
            <MemberAvatar m={m} size={compact ? 16 : 20} />
            <span className="whitespace-nowrap">{m.name.split(' ')[0]}</span>
            {m.isHost && !compact && (
              <span className="text-[9px] uppercase tracking-wider font-bold text-ink-tertiary">host</span>
            )}
            {active && <IconCheck size={compact ? 11 : 13} />}
          </button>
        );
      })}
    </div>
  );
}

/** Swiggy needs a delivery address before it will return anything at all. */
function AddressGate({ connected, onConnect }: { connected: boolean | null; onConnect: () => void }) {
  return (
    <div className="card p-10 text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface-secondary grid place-items-center text-ink-tertiary mx-auto mb-3">
        <IconMapPin size={24} />
      </div>
      <div className="font-bold text-ink-primary">
        {connected ? 'Pick a delivery address' : 'Connect your Swiggy account'}
      </div>
      <div className="text-xs text-ink-tertiary mt-1 mb-4 max-w-sm mx-auto leading-relaxed">
        {connected
          ? 'Swiggy needs to know where the food is going before it can show you restaurants. Choose an address from the picker in the header.'
          : 'CaterKart orders through your own Swiggy account — connect it to see real restaurants, menus and prices near you.'}
      </div>
      {!connected && (
        <button onClick={onConnect} className="btn-primary inline-flex">
          Connect Swiggy <IconArrowRight size={18} />
        </button>
      )}
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card p-10 text-center border-red-200 bg-red-50/40">
      <div className="w-14 h-14 rounded-2xl bg-white grid place-items-center text-swiggy-red mx-auto mb-3 shadow-card">
        <IconAlertTriangle size={24} />
      </div>
      <div className="font-bold text-ink-primary">Swiggy didn't answer</div>
      <div className="text-xs text-ink-tertiary mt-1 mb-4 max-w-sm mx-auto leading-relaxed">{message}</div>
      <button onClick={onRetry} className="btn-secondary inline-flex">
        <IconRefresh size={16} /> Try again
      </button>
    </div>
  );
}

function RestaurantSkeleton() {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="aspect-[16/10] bg-surface-secondary" />
      <div className="p-3 space-y-2">
        <div className="h-3.5 w-2/3 rounded bg-surface-secondary" />
        <div className="h-3 w-1/2 rounded bg-surface-secondary" />
        <div className="h-3 w-1/3 rounded bg-surface-secondary" />
      </div>
    </div>
  );
}

function DishSkeleton() {
  return (
    <div className="flex items-start gap-4 py-4 animate-pulse">
      <div className="flex-1 space-y-2">
        <div className="h-3 w-20 rounded bg-surface-secondary" />
        <div className="h-4 w-2/3 rounded bg-surface-secondary" />
        <div className="h-3 w-14 rounded bg-surface-secondary" />
        <div className="h-3 w-4/5 rounded bg-surface-secondary" />
      </div>
      <div className="w-24 h-24 rounded-2xl bg-surface-secondary shrink-0" />
    </div>
  );
}

/**
 * The restaurant menu sheet: full-screen on mobile, centered dialog on desktop.
 *
 * Everything above the dish list is sticky — restaurant identity, who's picking,
 * search-within-menu, veg/bestseller filters and the category jump rail — and the
 * running cart for THIS restaurant is pinned to the bottom.
 *
 * Menu filters are local to the sheet on purpose: the page-level FilterBar query
 * goes to Swiggy's restaurant search, so reusing it here would have made typing a
 * restaurant name silently empty the menu.
 */
function MenuSheet({
  restaurant, menu, loading, error, onRetry,
  members, picking, onPick,
  qtyFor, onAdd, onInc, onDec,
  items, subtotal, onClose,
}: {
  restaurant: Restaurant;
  menu: Menu | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  members: Member[];
  picking: Member;
  onPick: (id: string) => void;
  qtyFor: (d: Dish) => number;
  onAdd: (d: Dish) => void;
  onInc: (d: Dish) => void;
  onDec: (d: Dish) => void;
  items: number;
  subtotal: number;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [bestsellerOnly, setBestsellerOnly] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const canAdd = restaurant.isOpen;

  // Esc closes, and the page behind shouldn't scroll while the sheet is up.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const menuFilters: RestaurantFilters = useMemo(
    () => ({ q, vegOnly, bestsellerOnly, cuisines: new Set<string>(), sort: 'relevance' }),
    [q, vegOnly, bestsellerOnly],
  );

  const sections = useMemo(() => {
    if (!menu) return [];
    return menu.categories
      .map((c) => ({ title: c.title, items: applyToDishes(c.items, menuFilters) }))
      .filter((c) => c.items.length > 0);
  }, [menu, menuFilters]);

  const total = menu ? menu.categories.reduce((s, c) => s + c.items.length, 0) : 0;
  const shown = sections.reduce((s, c) => s + c.items.length, 0);
  const isFiltered = vegOnly || bestsellerOnly || !!q.trim();

  function jumpTo(title: string) {
    const el = sectionRefs.current[title];
    const box = scrollRef.current;
    if (!el || !box) return;
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    box.scrollTo({ top: Math.max(0, top - 4), behavior: 'smooth' });
    setActiveCat(title);
  }

  /** Highlight the category whose header is currently at the top of the list. */
  function onScroll() {
    const box = scrollRef.current;
    if (!box) return;
    const boxTop = box.getBoundingClientRect().top;
    let current: string | null = sections[0]?.title ?? null;
    for (const s of sections) {
      const el = sectionRefs.current[s.title];
      if (!el) continue;
      if (el.getBoundingClientRect().top - boxTop <= 48) current = s.title;
    }
    setActiveCat(current);
  }

  const overCap = subtotal > SWIGGY_ORDER_CAP;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/45 flex items-end sm:items-center sm:justify-center animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${restaurant.name} menu`}
    >
      <div
        className="bg-white w-full h-[92vh] sm:h-auto sm:max-h-[86vh] sm:w-[620px] rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden animate-fade-in-up shadow-floating"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ---------- Sticky header ---------- */}
        <div className="shrink-0 border-b border-line-subtle">
          {/* grab handle (mobile) */}
          <div className="sm:hidden pt-2 pb-1 grid place-items-center">
            <span className="w-10 h-1 rounded-full bg-line-default" />
          </div>

          <div className="px-4 pt-2.5 pb-3 flex items-center gap-3">
            <FoodImage src={restaurant.imageUrl} alt={restaurant.name} className="w-11 h-11 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-ink-primary truncate">{restaurant.name}</div>
              <div className="text-[12px] text-ink-tertiary flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1">
                  <IconStar size={12} className="text-swiggy-green" />
                  {restaurant.rating != null ? restaurant.rating.toFixed(1) : 'New'}
                </span>
                <span className="text-line-default">·</span>
                <span className="inline-flex items-center gap-1"><IconClock size={12} /> {restaurant.etaRange || `${restaurant.etaMin} min`}</span>
                {restaurant.cuisines.length > 0 && (
                  <>
                    <span className="text-line-default hidden sm:inline">·</span>
                    <span className="truncate hidden sm:inline">{restaurant.cuisines.join(', ')}</span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close menu"
              className="w-9 h-9 grid place-items-center rounded-full text-ink-tertiary hover:bg-surface-secondary hover:text-ink-primary transition shrink-0"
            >
              <IconClose size={18} />
            </button>
          </div>

          {!canAdd && (
            <div className="mx-4 mb-3 rounded-xl bg-surface-secondary px-3 py-2 text-[12px] font-semibold text-ink-secondary flex items-center gap-2">
              <IconClock size={14} /> This restaurant is currently closed on Swiggy.
            </div>
          )}

          {/* Who's picking */}
          <div className="px-4 pb-2.5 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-ink-tertiary shrink-0">
              For
            </span>
            <div className="min-w-0 flex-1">
              <MemberPicker members={members} selectedId={picking.id} onSelect={onPick} compact />
            </div>
          </div>

          {isVegLike(picking) && !vegOnly && (
            <div className="mx-4 mb-2.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5 text-[11px] font-semibold text-amber-700 flex items-center gap-2">
              <IconAlertTriangle size={13} />
              {picking.name.split(' ')[0]} is {picking.dietary}.
              <button onClick={() => setVegOnly(true)} className="underline underline-offset-2 hover:text-amber-800">
                Show veg only
              </button>
            </div>
          )}

          {/* Search within menu + filters */}
          <div className="px-4 pb-2.5">
            <div className="relative">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Search in ${restaurant.name}…`}
                className="w-full bg-white rounded-xl pl-10 pr-9 py-2.5 text-sm shadow-card border border-line-subtle outline-none focus:border-swiggy-orange focus:ring-2 focus:ring-orange-100 transition placeholder:text-ink-tertiary"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-tertiary"><IconSearch size={15} /></span>
              {q && (
                <button
                  onClick={() => setQ('')}
                  aria-label="Clear menu search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center rounded-full bg-surface-tertiary text-ink-tertiary"
                >
                  <IconClose size={13} />
                </button>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar mt-2.5">
              <button
                onClick={() => setVegOnly((v) => !v)}
                aria-pressed={vegOnly}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-[12px] font-semibold transition active:scale-95 ${
                  vegOnly ? 'bg-green-50 text-green-700 border-green-500' : 'bg-white text-ink-secondary border-line-default'
                }`}
              >
                <span className="inline-grid place-items-center w-3 h-3 border-[1.5px] border-green-600">
                  <span className="w-1 h-1 rounded-full bg-green-600" />
                </span>
                Pure Veg
              </button>
              <button
                onClick={() => setBestsellerOnly((v) => !v)}
                aria-pressed={bestsellerOnly}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-[12px] font-semibold transition active:scale-95 ${
                  bestsellerOnly ? 'bg-amber-50 text-amber-700 border-amber-500' : 'bg-white text-ink-secondary border-line-default'
                }`}
              >
                <IconStar size={12} /> Bestseller
              </button>
              {isFiltered && (
                <button
                  onClick={() => { setQ(''); setVegOnly(false); setBestsellerOnly(false); }}
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold text-swiggy-orange hover:bg-orange-50 transition"
                >
                  <IconClose size={12} /> Clear
                </button>
              )}
              {isFiltered && shown > 0 && (
                <span className="shrink-0 self-center chip chip-orange">{shown} of {total}</span>
              )}
            </div>
          </div>

          {/* Category jump rail */}
          {sections.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-2.5">
              {sections.map((c) => (
                <button
                  key={c.title}
                  onClick={() => jumpTo(c.title)}
                  className={`shrink-0 px-3 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap transition ${
                    activeCat === c.title
                      ? 'bg-swiggy-dark text-white'
                      : 'bg-surface-secondary text-ink-secondary hover:bg-surface-tertiary'
                  }`}
                >
                  {c.title}
                  <span className="ml-1 opacity-60 tabular-nums">{c.items.length}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ---------- Scrollable menu ---------- */}
        <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="divide-y divide-line-subtle">
              {[0, 1, 2, 3, 4].map((i) => <DishSkeleton key={i} />)}
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-surface-secondary grid place-items-center text-swiggy-red mx-auto mb-3">
                <IconAlertTriangle size={22} />
              </div>
              <div className="font-bold text-ink-primary text-sm">Couldn't load this menu</div>
              <div className="text-xs text-ink-tertiary mt-1 mb-4 max-w-xs mx-auto leading-relaxed">{error}</div>
              <button onClick={onRetry} className="btn-secondary inline-flex">
                <IconRefresh size={16} /> Try again
              </button>
            </div>
          ) : !menu || total === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-surface-secondary grid place-items-center text-ink-tertiary mx-auto mb-3">
                <IconStore size={22} />
              </div>
              <div className="font-bold text-ink-primary text-sm">No menu right now</div>
              <div className="text-xs text-ink-tertiary mt-1 max-w-xs mx-auto leading-relaxed">
                Swiggy isn't serving a menu for {restaurant.name} at the moment. Try again in a bit.
              </div>
            </div>
          ) : shown === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-surface-secondary grid place-items-center text-ink-tertiary mx-auto mb-3">
                <IconSearch size={22} />
              </div>
              <div className="font-bold text-ink-primary text-sm">No dishes match</div>
              <div className="text-xs text-ink-tertiary mt-1 mb-4 max-w-xs mx-auto leading-relaxed">
                None of the {total} dishes here match {q.trim() ? `“${q.trim()}”` : 'these filters'}.
              </div>
              <button
                onClick={() => { setQ(''); setVegOnly(false); setBestsellerOnly(false); }}
                className="btn-secondary inline-flex"
              >
                Clear filters
              </button>
            </div>
          ) : (
            sections.map((c) => (
              <div
                key={c.title}
                ref={(el) => { sectionRefs.current[c.title] = el; }}
                className="mt-2 first:mt-0"
              >
                {/* sticky category header — sticks to the top of the scroll box */}
                <div className="flex items-center gap-2 py-2 sticky top-0 bg-white/95 backdrop-blur z-[1]">
                  {/recommend|bestseller/i.test(c.title) && <IconStar size={14} className="text-amber-500" />}
                  <span className="text-[13px] font-black tracking-tight text-ink-primary">{c.title}</span>
                  <span className="text-[11px] font-bold text-ink-tertiary tabular-nums">{c.items.length}</span>
                  <span className="flex-1 h-px bg-line-subtle" />
                </div>
                <div className="divide-y divide-line-subtle">
                  {c.items.map((d) => (
                    <DishRow
                      key={d.id}
                      dish={d}
                      qty={qtyFor(d)}
                      onAdd={() => onAdd(d)}
                      onInc={() => onInc(d)}
                      onDec={() => onDec(d)}
                      disabled={!canAdd}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ---------- Running cart bar ---------- */}
        <div className="shrink-0 border-t border-line-default sticky-blur">
          {overCap && (
            <div className="px-4 py-1.5 bg-amber-50 border-b border-amber-200 text-[11px] font-semibold text-amber-700 flex items-center gap-1.5">
              <IconAlertTriangle size={13} />
              Over Swiggy's ₹{SWIGGY_ORDER_CAP.toLocaleString('en-IN')} cap — we'll split this into 2 orders automatically.
            </div>
          )}
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-ink-tertiary inline-flex items-center gap-1.5">
                <IconCart size={12} /> from {restaurant.name}
              </div>
              <div className="font-black text-ink-primary tabular-nums leading-tight">
                {items === 0
                  ? <span className="text-sm font-bold text-ink-tertiary">No items yet</span>
                  : <>{items} item{items === 1 ? '' : 's'} · ₹{subtotal}</>}
              </div>
            </div>
            <button onClick={onClose} className="btn-primary">
              Done <IconCheck size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
