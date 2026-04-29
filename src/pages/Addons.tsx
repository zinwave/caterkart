import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AddonCard from '../components/AddonCard';
import { addonCatalog, AddonCategory, suggestAddons } from '../data/mock';
import { useCelebration } from '../state/CelebrationContext';

const CATEGORY_META: Record<AddonCategory, { title: string; emoji: string; subtitle: string }> = {
  'cuisine-pair': {
    title: 'Goes perfectly with what you ordered',
    emoji: '🎯',
    subtitle: 'Hand-picked for the cuisines in your cart',
  },
  essentials: {
    title: 'Hosting essentials',
    emoji: '🏠',
    subtitle: 'The stuff hosts always forget — ice, plates, tissues',
  },
  drinks: {
    title: 'Drinks for the group',
    emoji: '🥤',
    subtitle: 'Quantities scaled to your group size',
  },
  'after-meal': {
    title: 'For after the meal',
    emoji: '🍦',
    subtitle: 'Dessert, mints & post-dinner essentials',
  },
  kids: {
    title: 'For the kids',
    emoji: '🧒',
    subtitle: 'Kid-friendly snacks and juices',
  },
  pantry: {
    title: 'Restock your pantry while we\'re at it',
    emoji: '🪄',
    subtitle: 'Based on your usual reorder pattern',
  },
};

export default function Addons() {
  const {
    cuisinesInCart, groupSize, foodTotal,
    addonSelections, toggleAddon, addonTotal,
    vegCount, nonVegCount, kidCount,
  } = useCelebration();

  const [q, setQ] = useState('');
  const searching = q.trim().length > 0;

  const suggestions = useMemo(
    () => suggestAddons({ cuisines: cuisinesInCart, groupSize, vegCount, nonVegCount, kidCount }),
    [cuisinesInCart, groupSize, vegCount, nonVegCount, kidCount]
  );

  // when searching, expand to the full Instamart catalogue
  const searchResults = useMemo(() => {
    if (!searching) return [];
    const lc = q.trim().toLowerCase();
    return addonCatalog.filter(
      (a) =>
        a.name.toLowerCase().includes(lc) ||
        a.reason.toLowerCase().includes(lc) ||
        a.category.toLowerCase().includes(lc)
    );
  }, [q, searching]);

  const grouped = useMemo(() => {
    const map = new Map<AddonCategory, typeof suggestions>();
    suggestions.forEach((a) => {
      if (!map.has(a.category)) map.set(a.category, []);
      map.get(a.category)!.push(a);
    });
    return map;
  }, [suggestions]);

  const cuisineList = Array.from(cuisinesInCart).join(', ');

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-32">
      <div className="text-sm text-neutral-500 reveal">Step 3 of 3</div>
      <h1 className="text-3xl font-black tracking-tight mt-1 reveal" style={{ animationDelay: '40ms' }}>
        Smart <span className="text-shimmer">Instamart</span> add-ons
      </h1>

      {/* Search bar */}
      <div className="relative mt-4 reveal" style={{ animationDelay: '70ms' }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Instamart catalogue (e.g. 'milk', 'beer', 'plates')…"
          className="w-full bg-white rounded-xl pl-11 pr-10 py-3 text-sm shadow-card border border-neutral-100 outline-none focus:border-swiggy-mart focus:ring-2 focus:ring-purple-100 transition placeholder:text-neutral-400"
        />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 text-base">🛒</span>
        {q && (
          <button
            onClick={() => setQ('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 text-xs"
          >×</button>
        )}
      </div>
      {searching && (
        <div className="mt-2 text-[11px] text-neutral-500 flex items-center gap-2">
          <span>Showing all Instamart items matching "{q}"</span>
          <span className="chip chip-purple">{searchResults.length} result{searchResults.length === 1 ? '' : 's'}</span>
        </div>
      )}

      {/* Why this works callout */}
      <div className="mt-4 card p-4 border-purple-200 bg-gradient-to-br from-purple-50/60 via-white to-pink-50/40 reveal" style={{ animationDelay: '90ms' }}>
        <div className="flex gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-purple-100 grid place-items-center text-2xl shrink-0">
            <span className="absolute inset-0 rounded-xl bg-purple-300/40 animate-pulse-ring" />
            <span className="relative">⚡</span>
          </div>
          <div className="text-sm text-neutral-700">
            <b>Instamart arrives ~15 min before your food.</b> Set the table, chill the
            drinks, lay out the plates — guests walk in, food shows up.
          </div>
        </div>
        <div className="mt-3 text-xs text-neutral-600 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>Suggestions tuned for:</span>
          {cuisineList && <span className="chip chip-orange">{cuisineList}</span>}
          <span className="chip">👥 {groupSize}</span>
          {vegCount > 0 && <span className="chip chip-green">🟢 {vegCount} veg</span>}
          {nonVegCount > 0 && <span className="chip chip-coral">🔴 {nonVegCount} non-veg</span>}
          {kidCount > 0 && <span className="chip" style={{ background: '#FFF7ED', color: '#B45309' }}>🧒 {kidCount} kid{kidCount > 1 ? 's' : ''}</span>}
        </div>
      </div>

      {searching ? (
        // ============ Search results (full catalogue) ============
        <div className="mt-6 animate-fade-in">
          {searchResults.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-5xl mb-2">🔎</div>
              <div className="font-semibold">Nothing matches "{q}"</div>
              <div className="text-xs text-neutral-500 mt-1 mb-4">
                Try a different word or clear the search to see suggestions.
              </div>
              <button onClick={() => setQ('')} className="btn-secondary inline-flex">Clear search</button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {searchResults.map((a) => (
                <AddonCard
                  key={a.id}
                  a={a}
                  selected={addonSelections.some((x) => x.id === a.id)}
                  onToggle={() => toggleAddon(a)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        // ============ Curated categorized suggestions ============
        <div className="mt-6 space-y-7">
          {(Object.keys(CATEGORY_META) as AddonCategory[]).map((cat) => {
            const items = grouped.get(cat);
            if (!items || items.length === 0) return null;
            const meta = CATEGORY_META[cat];
            return (
              <section key={cat} className="reveal" style={{ animationDelay: `${150}ms` }}>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl">{meta.emoji}</span>
                  <div>
                    <div className="font-bold">{meta.title}</div>
                    <div className="text-xs text-neutral-500">{meta.subtitle}</div>
                  </div>
                </div>
                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  {items.map((a) => (
                    <AddonCard
                      key={a.id}
                      a={a}
                      selected={addonSelections.some((x) => x.id === a.id)}
                      onToggle={() => toggleAddon(a)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-neutral-500 text-center mt-8">
        We suggest no more than 6–8 items. Long lists cause indecision — pick what
        matters, skip the rest.
      </p>

      {/* Sticky footer */}
      <div className="fixed inset-x-0 bottom-0 sticky-blur border-t border-neutral-200 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-xs text-neutral-500">
              Food ₹{foodTotal} · Instamart ₹{addonTotal}
              {addonSelections.length > 0 && ` · ${addonSelections.length} add-ons`}
            </div>
            <div className="font-black text-lg tabular-nums">₹{foodTotal + addonTotal}</div>
          </div>
          <Link to="/group" className="btn-ghost">← Back</Link>
          <Link to="/confirm" className="btn-primary">
            Review &amp; place →
          </Link>
        </div>
      </div>
    </div>
  );
}
