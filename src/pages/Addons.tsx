import { useState } from 'react';
import { Link } from 'react-router-dom';
import AddonCard from '../components/AddonCard';
import { FoodImage } from '../components/RestaurantCard';
import { useCelebration } from '../state/CelebrationContext';
import { useSwiggy } from '../state/SwiggyContext';
import { useProducts, useOccasionEssentials } from '../hooks/useSwiggyData';
import type { Product } from '../lib/mcp/types';
import {
  IconSearch, IconClose, IconBolt, IconArrowRight, IconCart, IconUsers, IconUser,
  IconRefresh, IconAlertTriangle, IconMapPin,
} from '../components/icons/Icons';
import { DietMark } from '../components/DietMark';
import { OccasionIcon } from '../components/OccasionIcon';

export default function Addons() {
  const {
    cuisinesInCart, groupSize, foodTotal,
    addonSelections, guestAddons, addAddon, setAddonQty, addonTotal, addonCount,
    vegCount, nonVegCount, kidCount, occasion, occasions,
  } = useCelebration();

  const { addressId, address } = useSwiggy();

  const [q, setQ] = useState('');
  const searching = q.trim().length > 0;

  // Empty query → the user's real "go-to" reorders. Typed query → Instamart search.
  const { data: products, loading, error, reload } = useProducts(q);

  // Occasion-specific shelf (e.g. House Party → chips, drinks, ice, plates).
  // Always recommend for an event type; when none is selected (or the chosen
  // type has no curated list), default to House Party so the shelf is never empty.
  const houseParty = occasions.find((o) => o.id === 'house-party') ?? null;
  const recoOccasion = occasion?.essentials?.length ? occasion : houseParty;
  const essentialTerms = recoOccasion?.essentials ?? [];
  const essentials = useOccasionEssentials(searching ? [] : essentialTerms);
  const showEssentials = !searching && essentialTerms.length > 0;

  // 0 when the product isn't in the basket yet.
  const qtyOf = (p: Product) => addonSelections.find((l) => l.product.id === p.id)?.qty ?? 0;

  const cuisineList = Array.from(cuisinesInCart).join(', ');

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 pb-32">
      {/* Header */}
      <div className="reveal">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="section-title">Step 3 of 3</div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-swiggy-mart/10 text-swiggy-mart">
            <IconBolt size={12} /> 15-min delivery · Instamart
          </span>
        </div>
        <h1 className="mt-2.5 text-3xl sm:text-4xl font-black tracking-tight text-ink-primary">
          Add <span className="text-swiggy-mart">Instamart</span> to the table
        </h1>
        <p className="mt-2 text-[15px] text-ink-secondary max-w-xl">
          Groceries and sides that arrive <b className="text-ink-primary">before</b> the food — so the
          table's set and the drinks are cold when everyone walks in.
        </p>
      </div>

      {/* Instamart hero */}
      <InstamartHero
        cuisineList={cuisineList}
        groupSize={groupSize}
        vegCount={vegCount}
        nonVegCount={nonVegCount}
        kidCount={kidCount}
        address={address?.display ?? null}
      />

      {/* Search */}
      <div className="mt-5 reveal" style={{ animationDelay: '110ms' }}>
        <div className="relative">
          <IconSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-tertiary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            disabled={!addressId}
            placeholder="Search all of Instamart — 'milk', 'beer', 'plates'…"
            className="w-full bg-white rounded-xl pl-11 pr-10 py-3 text-sm shadow-card border border-line-subtle outline-none focus:border-swiggy-mart focus:ring-2 focus:ring-purple-100 transition placeholder:text-ink-tertiary disabled:bg-surface-tertiary disabled:cursor-not-allowed"
          />
          {q && (
            <button
              onClick={() => setQ('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center rounded-full bg-surface-tertiary text-ink-tertiary hover:bg-surface-secondary transition"
              aria-label="Clear search"
            >
              <IconClose size={13} />
            </button>
          )}
        </div>
        {searching && !loading && !error && addressId && (
          <div className="mt-2 text-[11px] text-ink-tertiary flex items-center gap-2">
            <span>Live Instamart results for "{q}"</span>
            <span className="chip chip-purple">{products.length} result{products.length === 1 ? '' : 's'}</span>
          </div>
        )}
      </div>

      {/* Instamart items guests added on their own devices — read-only here. */}
      {guestAddons.length > 0 && (
        <div className="card p-4 mt-6 border-purple-200 bg-purple-50/40">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-swiggy-mart">
            <IconUsers size={13} /> Added by your guests
          </div>
          <div className="mt-2.5 space-y-2">
            {guestAddons.map((l) => (
              <div key={l.product.id} className="flex items-center gap-2.5 text-sm">
                <FoodImage src={l.product.imageUrl} alt="" className="w-8 h-8 rounded-lg shrink-0" />
                <span className="flex-1 min-w-0 truncate text-ink-primary font-medium">
                  {l.product.name}
                </span>
                <span className="text-ink-tertiary tabular-nums shrink-0">× {l.qty}</span>
                <span className="w-14 text-right font-bold text-ink-primary tabular-nums shrink-0">
                  ₹{l.product.price * l.qty}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ink-tertiary mt-2.5 leading-snug">
            These join your Instamart order automatically. Add your own picks below.
          </p>
        </div>
      )}

      {/* Body */}
      <div className="mt-7 space-y-8">
        {!addressId ? (
          <NoAddressState />
        ) : searching ? (
          <Section
            icon={<IconSearch size={18} />}
            title={`Instamart results for "${q}"`}
            subtitle="Live from Instamart — prices and stock are real."
          >
            <Shelf
              loading={loading}
              error={error}
              products={products}
              onRetry={reload}
              empty={<EmptyState query={q} onClear={() => setQ('')} />}
              qtyOf={qtyOf}
              onAdd={addAddon}
              onSetQty={setAddonQty}
            />
          </Section>
        ) : (
          <>
            {/* Occasion essentials — curated for the event, live Instamart prices. */}
            {showEssentials && (
              <Section
                icon={<OccasionIcon icon={recoOccasion?.icon} size={18} />}
                title={`${recoOccasion?.name} essentials`}
                subtitle={
                  occasion?.essentials?.length
                    ? 'Hand-picked for your event — real Instamart prices, one tap to add.'
                    : 'Popular party picks — real Instamart prices, one tap to add.'
                }
              >
                <Shelf
                  loading={essentials.loading}
                  error={essentials.error}
                  products={essentials.data}
                  onRetry={essentials.reload}
                  empty={<NoGoToState />}
                  qtyOf={qtyOf}
                  onAdd={addAddon}
                  onSetQty={setAddonQty}
                />
              </Section>
            )}

            {/* The guest's own Instamart reorders. */}
            <Section
              icon={<IconRefresh size={18} />}
              title="Your usuals from Instamart"
              subtitle="The items you actually reorder, straight from your Instamart history."
            >
              <Shelf
                loading={loading}
                error={error}
                products={products}
                onRetry={reload}
                empty={<NoGoToState />}
                qtyOf={qtyOf}
                onAdd={addAddon}
                onSetQty={setAddonQty}
              />
            </Section>
          </>
        )}
      </div>

      <p className="text-[11px] text-ink-tertiary text-center mt-8 max-w-md mx-auto">
        Everything here is live Instamart stock for your address — pick what matters, skip the rest.
      </p>

      {/* Sticky footer */}
      <div className="fixed inset-x-0 bottom-0 sticky-blur border-t border-line-default z-20">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-ink-tertiary truncate">
              Food ₹{foodTotal} · <span className="text-swiggy-mart font-semibold">Instamart ₹{addonTotal}</span>
              {addonCount > 0 && ` · ${addonCount} add-on${addonCount === 1 ? '' : 's'}`}
            </div>
            <div className="font-black text-lg text-ink-primary tabular-nums leading-tight">₹{foodTotal + addonTotal}</div>
          </div>
          <Link to="/group" className="btn-ghost text-sm">← Menu</Link>
          <Link to="/confirm" className="btn-primary">
            Review &amp; place <IconArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Presentational sub-components (DRY / single-responsibility) ───────────────

function InstamartHero({
  cuisineList, groupSize, vegCount, nonVegCount, kidCount, address,
}: {
  cuisineList: string; groupSize: number; vegCount: number; nonVegCount: number; kidCount: number;
  address: string | null;
}) {
  return (
    <div className="mt-6 card p-4 sm:p-5 border-purple-200 bg-gradient-to-br from-purple-50/70 via-white to-pink-50/50 reveal" style={{ animationDelay: '80ms' }}>
      <div className="flex gap-3.5">
        <div className="relative w-11 h-11 rounded-xl bg-swiggy-mart grid place-items-center text-white shrink-0 shadow-pop">
          <span className="absolute inset-0 rounded-xl bg-swiggy-mart/40 animate-pulse-ring" />
          <IconBolt size={20} className="relative" />
        </div>
        <div className="text-sm text-ink-secondary leading-relaxed">
          <b className="text-ink-primary">Instamart arrives ~15 min before your food.</b> Set the table,
          chill the drinks, lay out the plates — guests walk in, food shows up.
        </div>
      </div>
      <div className="mt-3.5 pt-3.5 border-t border-purple-100 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-ink-secondary">
        <span className="font-semibold text-ink-tertiary">Your party</span>
        {cuisineList && <span className="chip chip-purple">{cuisineList}</span>}
        <span className="chip inline-flex items-center gap-1"><IconUsers size={13} /> {groupSize}</span>
        {vegCount > 0 && <span className="chip chip-green inline-flex items-center gap-1"><DietMark d="veg" size={13} /> {vegCount} veg</span>}
        {nonVegCount > 0 && <span className="chip chip-coral inline-flex items-center gap-1"><DietMark d="non-veg" size={13} /> {nonVegCount} non-veg</span>}
        {kidCount > 0 && <span className="chip inline-flex items-center gap-1" style={{ background: '#FFF7ED', color: '#B45309' }}><IconUser size={13} /> {kidCount} kid{kidCount > 1 ? 's' : ''}</span>}
        {address && <span className="chip inline-flex items-center gap-1 max-w-[220px]"><IconMapPin size={13} /> <span className="truncate">{address}</span></span>}
      </div>
    </div>
  );
}

/** Loading / error / empty / grid — shared by the search, essentials and usuals shelves. */
function Shelf({
  loading, error, products, onRetry, empty, qtyOf, onAdd, onSetQty,
}: {
  loading: boolean;
  error: string | null;
  products: Product[];
  onRetry: () => void;
  empty: React.ReactNode;
  qtyOf: (p: Product) => number;
  onAdd: (p: Product) => void;
  onSetQty: (id: string, qty: number) => void;
}) {
  if (loading) return <SkeletonGrid />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (products.length === 0) return <>{empty}</>;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in">
      {products.map((p) => (
        <AddonCard
          key={p.id}
          p={p}
          qty={qtyOf(p)}
          onAdd={() => onAdd(p)}
          onSetQty={(qty) => onSetQty(p.id, qty)}
        />
      ))}
    </div>
  );
}

function Section({
  icon, title, subtitle, children,
}: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="reveal">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 grid place-items-center text-swiggy-mart shrink-0">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="font-black tracking-tight text-ink-primary leading-tight truncate">{title}</div>
          <div className="text-xs text-ink-tertiary mt-0.5">{subtitle}</div>
        </div>
      </div>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card p-3.5 flex gap-3 items-start animate-pulse">
          <div className="w-14 h-14 rounded-xl bg-surface-tertiary shrink-0" />
          <div className="flex-1 min-w-0 space-y-2 py-0.5">
            <div className="h-3.5 rounded bg-surface-tertiary w-4/5" />
            <div className="h-2.5 rounded bg-surface-tertiary w-2/5" />
            <div className="h-3 rounded bg-surface-tertiary w-1/3" />
          </div>
          <div className="w-16 h-8 rounded-lg bg-surface-tertiary shrink-0" />
        </div>
      ))}
    </div>
  );
}

function StateCard({
  icon, title, body, action,
}: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="card p-10 text-center">
      <div className="w-14 h-14 rounded-2xl bg-purple-50 grid place-items-center text-swiggy-mart mx-auto mb-3">
        {icon}
      </div>
      <div className="font-bold text-ink-primary">{title}</div>
      <div className="text-xs text-ink-tertiary mt-1 mb-4 max-w-sm mx-auto">{body}</div>
      {action}
    </div>
  );
}

function EmptyState({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <StateCard
      icon={<IconCart size={24} />}
      title={`Instamart has nothing for "${query}"`}
      body="Try a different word, or clear the search to see the items you usually reorder."
      action={<button onClick={onClear} className="btn-secondary inline-flex">Clear search</button>}
    />
  );
}

function NoGoToState() {
  return (
    <StateCard
      icon={<IconCart size={24} />}
      title="No Instamart reorders yet"
      body="We show your go-to items here once you've ordered from Instamart. For now, search for what you need — ice, plates, cold drinks."
    />
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <StateCard
      icon={<IconAlertTriangle size={24} />}
      title="Couldn't reach Instamart"
      body={message}
      action={
        <button onClick={onRetry} className="btn-secondary inline-flex items-center gap-1.5">
          <IconRefresh size={15} /> Try again
        </button>
      }
    />
  );
}

function NoAddressState() {
  return (
    <StateCard
      icon={<IconMapPin size={24} />}
      title="Pick a delivery address first"
      body="Instamart stock and prices depend on where you are. Choose an address from the header and we'll load what's available near you."
    />
  );
}
