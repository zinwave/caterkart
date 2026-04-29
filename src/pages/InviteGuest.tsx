import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCelebration, CartLine } from '../state/CelebrationContext';
import { restaurants as ALL_RESTAURANTS, DietaryPref, Dish, Member, Restaurant } from '../data/mock';
import { MemberAvatar } from '../components/MemberAvatar';
import { DietChip } from '../components/AddGuestModal';
import RestaurantCard from '../components/RestaurantCard';
import DishRow from '../components/DishRow';
import FilterBar from '../components/FilterBar';
import {
  applyToDishes, applyToRestaurants, defaultFilters, RestaurantFilters,
} from '../utils/filters';

type Step = 'landing' | 'rsvp' | 'menu' | 'thanks';

export default function InviteGuest() {
  const { token = '' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();

  const {
    occasion, time, address, host,
    guests, addLine, carts,
    updateGuest, setGuestStatus,
  } = useCelebration();

  const guestId = params.get('as');
  const guest = useMemo(() => guests.find((g) => g.id === guestId), [guests, guestId]);

  const [step, setStep] = useState<Step>(guest ? 'landing' : 'landing');

  // RSVP form state — pre-fills from existing guest
  const [name, setName] = useState(guest?.name ?? '');
  const [dietary, setDietary] = useState<DietaryPref>(guest?.dietary ?? 'non-veg');
  const [bringingKids, setBringingKids] = useState(0);
  const [openRestaurant, setOpenRestaurant] = useState<typeof ALL_RESTAURANTS[number] | null>(null);

  // Mark "joined" once they land
  useEffect(() => {
    if (guest && guest.status === 'invited') setGuestStatus(guest.id, 'joined');
  }, [guest?.id]);

  if (!guest) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="text-5xl mb-3">🤔</div>
        <h1 className="text-xl font-bold">This invite link is invalid.</h1>
        <p className="text-sm text-neutral-500 mt-2">
          Ask the host to resend you the link, or open it from the host's "Preview as guest" menu.
        </p>
        <Link to="/" className="btn-secondary mt-5 inline-flex">Go home</Link>
      </div>
    );
  }

  const myLines = carts.filter((l) => l.pickedBy.id === guest.id);
  const myTotal = myLines.reduce((s, l) => s + l.dish.price * l.qty, 0);

  // ============ Step screens ============
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Mock phone status bar */}
      <div className="bg-black text-white text-[10px] flex items-center justify-between px-4 py-1.5 sm:hidden">
        <span>9:41</span>
        <span className="font-semibold">📱 swiggy.app</span>
        <span>🔋 92%</span>
      </div>

      {step === 'landing' && (
        <Landing
          occasion={occasion}
          host={host}
          time={time}
          address={address}
          guest={guest}
          token={token}
          onContinue={() => setStep('rsvp')}
        />
      )}

      {step === 'rsvp' && (
        <Rsvp
          name={name} setName={setName}
          dietary={dietary} setDietary={setDietary}
          bringingKids={bringingKids} setBringingKids={setBringingKids}
          isKid={!!guest.isKid}
          onConfirm={() => {
            updateGuest(guest.id, {
              name: name || guest.name,
              dietary,
            });
            setGuestStatus(guest.id, 'picking');
            setStep('menu');
          }}
          onBack={() => setStep('landing')}
        />
      )}

      {step === 'menu' && (
        <MenuPicker
          guestName={guest.name}
          guest={guest}
          openRestaurant={openRestaurant}
          setOpenRestaurant={setOpenRestaurant}
          myLines={myLines}
          myTotal={myTotal}
          onAdd={(dish, restaurantId) => addLine(dish, restaurantId, guest)}
          onSubmit={() => {
            setGuestStatus(guest.id, 'ready');
            setStep('thanks');
          }}
        />
      )}

      {step === 'thanks' && (
        <Thanks
          guestName={guest.name}
          itemsCount={myLines.reduce((s, l) => s + l.qty, 0)}
          onBackToHost={() => nav('/confirm')}
        />
      )}
    </div>
  );
}

// =====================================================
// 1. Landing — friend introduces themselves
// =====================================================
function Landing({
  occasion, host, time, address, guest, token, onContinue,
}: any) {
  return (
    <div className="relative">
      {/* Hero card */}
      <div className="bg-mesh-warm bg-[length:200%_200%] animate-gradient-shift text-white px-5 py-10 relative overflow-hidden">
        <div className="absolute -top-20 -right-10 w-72 h-72 rounded-full bg-white/15 blur-3xl pointer-events-none" />
        <div className="relative max-w-md mx-auto">
          <div className="flex items-center gap-2 chip bg-white/15 backdrop-blur text-white border border-white/25">
            🎉 You're invited
          </div>
          <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight">
            <MemberAvatar m={host} size={36} />
            <span className="block mt-2">
              <b>{host.name.replace(/\(.*\)/, '').trim()}</b> invited you to{' '}
              <span className="underline decoration-white/60 decoration-4 underline-offset-2">
                {occasion?.name ?? 'a celebration'} {occasion?.emoji}
              </span>
            </span>
          </h1>
          <div className="mt-5 grid gap-2.5 text-sm text-white/95">
            <Detail emoji="🕗" label="Tonight" value={time} />
            <Detail emoji="📍" label="At" value={address} />
            <Detail emoji="👥" label="Hosted by" value={host.name} />
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 -mt-6 relative">
        <div className="card p-4 animate-fade-in-up">
          <div className="text-xs uppercase tracking-wide font-semibold text-neutral-500">Hi, {guest.name.split(' ')[0]} 👋</div>
          <p className="text-sm mt-1 leading-relaxed">
            Tap in to <b>RSVP</b>, set your dietary preference, and pick exactly what you want to
            eat. Everyone's order arrives synced — within ~5 min of each other.
          </p>
          <button onClick={onContinue} className="btn-primary w-full mt-4">
            RSVP &amp; pick your dishes →
          </button>
          <div className="text-[11px] text-center text-neutral-500 mt-2">
            Powered by caterkart · invite #{token}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat emoji="🍱" label="Multi-restaurant" />
          <Stat emoji="⏱️" label="Synced delivery" />
          <Stat emoji="💸" label="Easy split" />
        </div>
      </div>

      <footer className="max-w-md mx-auto px-5 py-8 text-center text-xs text-neutral-400">
        Not interested? Just close this tab — we won't bug {guest.name.split(' ')[0]}.
      </footer>
    </div>
  );
}

function Detail({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg">{emoji}</span>
      <span className="text-white/70 text-xs uppercase tracking-wide">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function Stat({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-xl">{emoji}</div>
      <div className="text-[10px] uppercase font-semibold tracking-wide text-neutral-500 mt-1">{label}</div>
    </div>
  );
}

// =====================================================
// 2. RSVP — confirm name, dietary, kids
// =====================================================
function Rsvp({
  name, setName, dietary, setDietary, bringingKids, setBringingKids, isKid,
  onConfirm, onBack,
}: any) {
  return (
    <div className="max-w-md mx-auto px-5 py-7">
      <button onClick={onBack} className="text-sm text-neutral-500 mb-3">← back</button>
      <h1 className="text-2xl font-black tracking-tight">Quick RSVP</h1>
      <p className="text-sm text-neutral-600 mt-1">Takes 20 seconds. The host needs this for ordering.</p>

      <div className="mt-5 space-y-3">
        <Field label="Your name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-transparent outline-none text-sm py-1"
          />
        </Field>

        <div>
          <div className="text-[11px] uppercase tracking-wide font-semibold text-neutral-500 mb-1.5">
            Dietary preference
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['veg', 'non-veg', 'jain', 'vegan'] as DietaryPref[]).map((d) => (
              <button
                key={d}
                onClick={() => setDietary(d)}
                className={`px-3 py-2.5 rounded-lg font-bold border-2 transition flex items-center justify-center gap-2 text-sm ${
                  dietary === d
                    ? 'border-swiggy-orange bg-orange-50 text-swiggy-orange'
                    : 'border-neutral-200 bg-white text-neutral-700'
                }`}
              >
                <DietChip d={d} />
              </button>
            ))}
          </div>
        </div>

        {!isKid && (
          <div className="card p-3">
            <div className="text-sm font-semibold flex items-center gap-2">
              🧒 Bringing kids?
            </div>
            <div className="text-[11px] text-neutral-500 mt-0.5">We'll add kid-friendly snacks &amp; juices to the Instamart cart.</div>
            <div className="flex items-center gap-2 mt-2">
              <button onClick={() => setBringingKids(Math.max(0, bringingKids - 1))} className="w-8 h-8 rounded-md bg-neutral-100">−</button>
              <span className="font-bold w-6 text-center">{bringingKids}</span>
              <button onClick={() => setBringingKids(bringingKids + 1)} className="w-8 h-8 rounded-md bg-neutral-100">+</button>
              <span className="text-xs text-neutral-500 ml-2">{bringingKids === 0 ? 'No kids' : `${bringingKids} kid${bringingKids > 1 ? 's' : ''}`}</span>
            </div>
          </div>
        )}
      </div>

      <button onClick={onConfirm} className="btn-primary w-full mt-6">
        Confirm &amp; pick dishes →
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card p-3">
      <div className="text-[11px] text-neutral-500 font-semibold uppercase tracking-wide">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

// =====================================================
// 3. Menu picker (guest's own picks)
// =====================================================
function MenuPicker({
  guestName, guest, openRestaurant, setOpenRestaurant, myLines, myTotal, onAdd, onSubmit,
}: {
  guestName: string;
  guest: Member;
  openRestaurant: Restaurant | null;
  setOpenRestaurant: (r: Restaurant | null) => void;
  myLines: CartLine[];
  myTotal: number;
  onAdd: (dish: Dish, restaurantId: string) => void;
  onSubmit: () => void;
}) {
  const isVeg = !!guest.dietary && guest.dietary !== 'non-veg';

  // veg-locked filters: invitee with veg dietary always sees veg only
  const [filters, setFilters] = useState<RestaurantFilters>(() => ({
    ...defaultFilters(),
    vegOnly: isVeg,
  }));

  const filteredRestaurants = useMemo(
    () => applyToRestaurants(ALL_RESTAURANTS, filters),
    [filters]
  );

  const matchesByRestaurant = useMemo(() => {
    if (!filters.q.trim()) return new Map<string, string[]>();
    const q = filters.q.trim().toLowerCase();
    const map = new Map<string, string[]>();
    ALL_RESTAURANTS.forEach((r) => {
      const matches = r.dishes
        .filter((d) => d.name.toLowerCase().includes(q))
        .map((d) => d.name);
      if (matches.length) map.set(r.id, matches);
    });
    return map;
  }, [filters.q]);

  const visibleDishes = openRestaurant ? applyToDishes(openRestaurant.dishes, filters) : [];

  return (
    <div className="max-w-md mx-auto pb-32">
      <div className="px-5 pt-6">
        <h1 className="text-2xl font-black tracking-tight">
          Your picks, <span className="text-shimmer">{guestName.split(' ')[0]}</span>
        </h1>
        <p className="text-sm text-neutral-600 mt-1">
          Pick any number of dishes from any restaurant. The host pays first; UPI link comes after.
        </p>
      </div>

      {/* Filters */}
      <div className="px-5 mt-5">
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          vegLocked={isVeg}
          vegLockedReason="Locked because you marked yourself vegetarian"
        />
      </div>

      {/* My picks summary */}
      {myLines.length > 0 && (
        <div className="px-5 mt-4">
          <div className="card p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Your picks ({myLines.length})</div>
            <div className="space-y-1.5 mt-2">
              {myLines.map((l, i) => (
                <div key={i} className="flex items-center text-sm">
                  <span className="w-6">{l.dish.imageEmoji}</span>
                  <span className="flex-1 truncate">{l.dish.name} × {l.qty}</span>
                  <span className="font-semibold tabular-nums">₹{l.dish.price * l.qty}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="px-5 mt-5">
        <h2 className="section-title">
          {filteredRestaurants.length} restaurant{filteredRestaurants.length === 1 ? '' : 's'}
        </h2>
        {filteredRestaurants.length === 0 ? (
          <EmptyResults onClear={() => setFilters({ ...defaultFilters(), vegOnly: isVeg })} />
        ) : (
          <div className="grid gap-3 mt-3">
            {filteredRestaurants.map((r) => (
              <RestaurantCard
                key={r.id}
                r={r}
                onClick={() => setOpenRestaurant(r)}
                matchedDishes={matchesByRestaurant.get(r.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* dish modal */}
      {openRestaurant && (
        <div className="fixed inset-0 z-40 bg-black/45 grid place-items-end animate-fade-in" onClick={() => setOpenRestaurant(null)}>
          <div className="bg-white w-full rounded-t-3xl max-h-[85vh] overflow-y-auto animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-neutral-100 sticky top-0 sticky-blur flex items-start gap-3 z-10">
              <div className="w-11 h-11 rounded-xl bg-orange-50 grid place-items-center text-2xl">{openRestaurant.imageEmoji}</div>
              <div className="flex-1">
                <div className="font-bold">{openRestaurant.name}</div>
                <div className="text-xs text-neutral-500">{openRestaurant.cuisines.join(' · ')} · {openRestaurant.etaMin} min</div>
              </div>
              <button onClick={() => setOpenRestaurant(null)} className="text-2xl leading-none w-8 h-8 grid place-items-center rounded-full hover:bg-neutral-100">×</button>
            </div>
            {(filters.vegOnly || filters.bestsellerOnly || filters.q) && (
              <div className="mx-4 mt-3 mb-1 text-[11px] text-neutral-500 flex items-center gap-2">
                <span>Showing dishes matching active filters</span>
                <span className="chip chip-orange">{visibleDishes.length} of {openRestaurant.dishes.length}</span>
              </div>
            )}
            <div className="px-4 divide-y divide-neutral-100">
              {visibleDishes.length === 0 ? (
                <div className="py-12 text-center text-sm text-neutral-500">
                  No dishes match your filters.
                </div>
              ) : (
                visibleDishes.map((d) => (
                  <DishRow
                    key={d.id}
                    dish={d}
                    onAdd={() => onAdd(d, openRestaurant.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* sticky footer */}
      <div className="fixed inset-x-0 bottom-0 sticky-blur border-t border-neutral-200 z-30">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-xs text-neutral-500">{myLines.reduce((s, l) => s + l.qty, 0)} items</div>
            <div className="font-black text-lg tabular-nums">₹{myTotal}</div>
          </div>
          <button
            disabled={myLines.length === 0}
            onClick={onSubmit}
            className="btn-primary disabled:opacity-50 disabled:saturate-50"
          >
            I'm done · submit
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="card p-8 text-center mt-3 animate-fade-in">
      <div className="text-5xl mb-2">🔎</div>
      <div className="font-semibold">No restaurants match</div>
      <div className="text-xs text-neutral-500 mt-1 mb-4">
        Try removing a filter or clearing the search.
      </div>
      <button onClick={onClear} className="btn-secondary inline-flex">Clear filters</button>
    </div>
  );
}

// =====================================================
// 4. Thanks screen
// =====================================================
function Thanks({ guestName, itemsCount, onBackToHost }: {
  guestName: string; itemsCount: number; onBackToHost: () => void;
}) {
  return (
    <div className="max-w-md mx-auto px-5 py-12 text-center animate-fade-in">
      <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-swiggy-orange to-cater-coral grid place-items-center text-5xl shadow-glow animate-float">
        🎉
      </div>
      <h1 className="text-2xl font-black tracking-tight mt-5">Thanks, {guestName.split(' ')[0]}!</h1>
      <p className="text-sm text-neutral-600 mt-2 leading-relaxed">
        Your <b>{itemsCount} pick{itemsCount === 1 ? '' : 's'}</b> are locked in.<br />
        The host will see you as <b className="text-swiggy-green">✓ Ready</b> and place the
        celebration order shortly.
      </p>

      <div className="mt-6 card p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">What happens next</div>
        <ul className="text-sm space-y-2 mt-2 text-left">
          <li className="flex gap-2.5">
            <span>1️⃣</span><span>Host gets a 📲 ping that you're ready.</span>
          </li>
          <li className="flex gap-2.5">
            <span>2️⃣</span><span>Once everyone's in, host places the synced order.</span>
          </li>
          <li className="flex gap-2.5">
            <span>3️⃣</span><span>You get a UPI split link &amp; tracking on the day.</span>
          </li>
        </ul>
      </div>

      <button onClick={onBackToHost} className="btn-secondary mt-6">
        ← Back to host view (demo)
      </button>
      <div className="mt-3 text-[11px] text-neutral-400">
        In the real app, you'd just close the tab. This button is for the mock walkthrough.
      </div>
    </div>
  );
}
