import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { restaurants as ALL_RESTAURANTS, Dish, Restaurant, Member } from '../data/mock';
import RestaurantCard from '../components/RestaurantCard';
import DishRow from '../components/DishRow';
import FilterBar from '../components/FilterBar';
import {
  applyToDishes, applyToRestaurants, defaultFilters, RestaurantFilters,
} from '../utils/filters';
import { MemberAvatar, MemberStack } from '../components/MemberAvatar';
import { useCelebration } from '../state/CelebrationContext';

export default function GroupCart() {
  const {
    carts, addLine, changeQty,
    members, host, guests,
    foodTotal, restaurantsInCart,
  } = useCelebration();

  const [openRestaurant, setOpenRestaurant] = useState<Restaurant | null>(null);
  const [pendingDish, setPendingDish] = useState<Dish | null>(null);
  const [filters, setFilters] = useState<RestaurantFilters>(defaultFilters);

  const otherRestaurants = ALL_RESTAURANTS.filter(
    (r) => !restaurantsInCart.some((rc) => rc.id === r.id)
  );

  const filteredOthers = useMemo(
    () => applyToRestaurants(otherRestaurants, filters),
    [otherRestaurants, filters]
  );

  const dishMatches = useMemo(() => {
    if (!filters.q.trim()) return new Map<string, string[]>();
    const q = filters.q.trim().toLowerCase();
    const map = new Map<string, string[]>();
    otherRestaurants.forEach((r) => {
      const matches = r.dishes
        .filter((d) => d.name.toLowerCase().includes(q))
        .map((d) => d.name);
      if (matches.length) map.set(r.id, matches);
    });
    return map;
  }, [filters.q, otherRestaurants]);

  const visibleDishes = openRestaurant ? applyToDishes(openRestaurant.dishes, filters) : [];

  const linesByRestaurant = useMemo(() => {
    const map: Record<string, typeof carts> = {};
    carts.forEach((l) => {
      (map[l.restaurantId] = map[l.restaurantId] || []).push(l);
    });
    return map;
  }, [carts]);

  // status counts
  const readyCount = guests.filter((g) => g.status === 'ready').length + 1; // host
  const pickingCount = guests.filter((g) => g.status === 'picking' || g.status === 'joined').length;
  const invitedCount = guests.filter((g) => g.status === 'invited').length;

  if (members.length === 1) {
    // host only — guests not added yet
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <div className="text-5xl mb-3">🚧</div>
        <h1 className="text-xl font-bold">Add some guests first.</h1>
        <p className="text-sm text-neutral-500 mt-2 max-w-sm mx-auto">
          Caterkart works best when there's at least one other person — different cravings is the
          whole point. Head back to add a guest.
        </p>
        <Link to="/create" className="btn-primary mt-5 inline-flex">← Add guests</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-32">
      <div className="text-sm text-neutral-500 reveal">Step 2 of 3</div>
      <h1 className="text-3xl font-black tracking-tight mt-1 reveal" style={{ animationDelay: '40ms' }}>
        Build the <span className="text-shimmer">group cart</span>
      </h1>
      <p className="text-sm text-neutral-600 mt-1.5 reveal" style={{ animationDelay: '90ms' }}>
        Each member picks from any restaurant. Everything arrives synced.
      </p>

      {/* Group ribbon */}
      <div className="card p-3 mt-4 flex items-center gap-3 reveal" style={{ animationDelay: '130ms' }}>
        <MemberStack ms={members} />
        <div className="text-xs text-neutral-600 leading-tight">
          <div>
            <span className="font-semibold text-neutral-800">{members.length} in this celebration</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="text-swiggy-green">🟢 {readyCount} ready</span>
            {pickingCount > 0 && <span className="text-amber-600">⏳ {pickingCount} picking</span>}
            {invitedCount > 0 && <span className="text-neutral-400">✉️ {invitedCount} not opened</span>}
          </div>
        </div>
      </div>

      {/* Carts grouped per restaurant */}
      {restaurantsInCart.length > 0 && (
        <>
          <h2 className="section-title mt-6 mb-3">
            Selected restaurants ({restaurantsInCart.length})
          </h2>

          <div className="space-y-3">
            {restaurantsInCart.map((r) => (
              <div key={r.id} className="card overflow-hidden">
                <div className="px-3 py-3 flex items-center gap-3 border-b border-neutral-100">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-50 to-rose-50 grid place-items-center text-2xl">{r.imageEmoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{r.name}</div>
                    <div className="text-xs text-neutral-500">★ {r.rating} · {r.etaMin} min</div>
                  </div>
                  <button
                    onClick={() => setOpenRestaurant(r)}
                    className="text-xs font-semibold text-swiggy-orange"
                  >
                    + ADD MORE
                  </button>
                </div>
                <div className="divide-y divide-neutral-100">
                  {linesByRestaurant[r.id]?.map((l) => {
                    const idx = carts.indexOf(l);
                    return (
                      <div key={idx} className="px-3 py-2.5 flex items-center gap-3">
                        <span className={`inline-block w-3 h-3 border-[1.5px] ${l.dish.veg ? 'border-swiggy-green' : 'border-swiggy-red'}`}>
                          <span className={`block w-1 h-1 m-[3px] rounded-full ${l.dish.veg ? 'bg-swiggy-green' : 'bg-swiggy-red'}`} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium leading-tight truncate">{l.dish.name}</div>
                          <div className="text-[11px] text-neutral-500 flex items-center gap-1">
                            for <MemberAvatar m={l.pickedBy} size={14} /> {l.pickedBy.name}
                          </div>
                        </div>
                        <div className="flex items-center bg-neutral-100 rounded-md text-sm overflow-hidden">
                          <button onClick={() => changeQty(idx, -1)} className="px-2 py-1">−</button>
                          <span className="px-2 font-semibold">{l.qty}</span>
                          <button onClick={() => changeQty(idx, 1)} className="px-2 py-1">+</button>
                        </div>
                        <div className="w-14 text-right text-sm font-semibold tabular-nums">
                          ₹{l.dish.price * l.qty}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add another restaurant */}
      <h2 className="section-title mt-8 mb-3">
        {restaurantsInCart.length === 0 ? 'Pick your first restaurant' : 'Add another restaurant'}
      </h2>

      <FilterBar filters={filters} setFilters={setFilters} className="mb-4" />

      {filteredOthers.length === 0 ? (
        <div className="card p-8 text-center mt-3">
          <div className="text-5xl mb-2">🔎</div>
          <div className="font-semibold">No restaurants match</div>
          <div className="text-xs text-neutral-500 mt-1 mb-4">
            {otherRestaurants.length === 0
              ? 'You\'ve added every restaurant — go pick some dishes above.'
              : 'Try removing a filter or clearing the search.'}
          </div>
          {otherRestaurants.length > 0 && (
            <button onClick={() => setFilters(defaultFilters())} className="btn-secondary inline-flex">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filteredOthers.map((r) => (
            <RestaurantCard
              key={r.id}
              r={r}
              onClick={() => setOpenRestaurant(r)}
              matchedDishes={dishMatches.get(r.id)}
            />
          ))}
        </div>
      )}

      {restaurantsInCart.length > 0 && (
        <div className="mt-6 card p-3 flex items-center gap-3 bg-orange-50/60 border-orange-200">
          <div className="text-2xl">⏱️</div>
          <div className="text-xs">
            <div className="font-semibold text-neutral-800">Synced delivery is on</div>
            <div className="text-neutral-600">
              We'll stagger placement so dishes from {restaurantsInCart.length} restaurant{restaurantsInCart.length > 1 ? 's' : ''} arrive within ~5 min of each other.
            </div>
          </div>
        </div>
      )}

      {/* Sticky footer */}
      <div className="fixed inset-x-0 bottom-0 sticky-blur border-t border-neutral-200 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-xs text-neutral-500">{carts.reduce((s, l) => s + l.qty, 0)} items · {restaurantsInCart.length} restaurants</div>
            <div className="font-black text-lg tabular-nums">₹{foodTotal}</div>
          </div>
          <Link to="/create" className="btn-ghost text-sm">← Guests</Link>
          <Link
            to="/addons"
            className={`btn-primary ${carts.length === 0 ? 'opacity-50 saturate-50 pointer-events-none' : ''}`}
          >
            Next: Instamart sides →
          </Link>
        </div>
      </div>

      {/* Menu modal */}
      {openRestaurant && (
        <Modal
          title={openRestaurant.name}
          subtitle={`${openRestaurant.cuisines.join(' · ')} · ${openRestaurant.etaMin} min`}
          onClose={() => { setOpenRestaurant(null); setPendingDish(null); }}
        >
          {(filters.vegOnly || filters.bestsellerOnly || filters.q) && (
            <div className="mb-2 text-[11px] text-neutral-500 flex items-center gap-2">
              <span>Filtered by your active filters</span>
              <span className="chip chip-orange">{visibleDishes.length} of {openRestaurant.dishes.length}</span>
            </div>
          )}
          <div className="divide-y divide-neutral-100">
            {visibleDishes.length === 0 ? (
              <div className="py-12 text-center text-sm text-neutral-500">
                No dishes match your filters.
              </div>
            ) : (
              visibleDishes.map((d) => (
                <DishRow
                  key={d.id}
                  dish={d}
                  onAdd={() => setPendingDish(d)}
                />
              ))
            )}
          </div>
        </Modal>
      )}

      {/* Member picker for "who is this for?" */}
      {pendingDish && openRestaurant && (
        <Modal
          title="Who is this for?"
          subtitle={`${pendingDish.name} · ₹${pendingDish.price}`}
          onClose={() => setPendingDish(null)}
        >
          <div className="grid grid-cols-3 gap-3 py-2">
            {members.map((m) => (
              <PickerButton
                key={m.id}
                m={m}
                dishVeg={pendingDish.veg}
                onClick={() => {
                  addLine(pendingDish, openRestaurant.id, m);
                  setPendingDish(null);
                }}
              />
            ))}
          </div>
          <button
            onClick={() => {
              addLine(pendingDish, openRestaurant.id, host);
              setPendingDish(null);
            }}
            className="w-full text-xs text-neutral-500 mt-3 py-2 hover:text-neutral-700"
          >
            Skip · add to host's tab
          </button>
        </Modal>
      )}
    </div>
  );
}

function PickerButton({ m, dishVeg, onClick }: { m: Member; dishVeg: boolean; onClick: () => void }) {
  // warn if dietary mismatch
  const mIsVeg = m.dietary && m.dietary !== 'non-veg';
  const conflict = !dishVeg && mIsVeg;
  return (
    <button
      onClick={onClick}
      className={`relative card p-3 flex flex-col items-center gap-1 hover:shadow-pop active:scale-95 transition ${
        conflict ? 'border-amber-300 bg-amber-50/40' : ''
      }`}
    >
      <MemberAvatar m={m} size={40} />
      <div className="text-xs font-semibold text-center leading-tight">
        {m.name.split(' ')[0]}
        {m.isHost && <span className="block text-[9px] text-swiggy-orange uppercase tracking-wider font-bold">host</span>}
      </div>
      {conflict && (
        <span title="Dietary mismatch" className="absolute -top-1 -right-1 text-amber-600 text-base">⚠️</span>
      )}
    </button>
  );
}

function Modal({
  title, subtitle, onClose, children,
}: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-black/45 grid place-items-end sm:place-items-center animate-fade-in" onClick={onClose}>
      <div
        className="bg-white w-full sm:w-[520px] sm:rounded-2xl rounded-t-3xl max-h-[85vh] overflow-y-auto animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-neutral-100 sticky top-0 sticky-blur flex items-start gap-3">
          <div className="flex-1">
            <div className="font-bold">{title}</div>
            {subtitle && <div className="text-xs text-neutral-500">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="text-2xl leading-none w-8 h-8 grid place-items-center rounded-full hover:bg-neutral-100">×</button>
        </div>
        <div className="px-4 py-2">{children}</div>
      </div>
    </div>
  );
}
