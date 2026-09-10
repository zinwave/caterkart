import { useState, ComponentType } from 'react';
import { RestaurantFilters, SortKey } from '../utils/filters';
import { IconSearch, IconClose, IconCheck, IconLock, IconStar, IconSparkles, IconClock, IconWallet } from './icons/Icons';

type IconType = ComponentType<{ size?: number; className?: string }>;

type Props = {
  filters: RestaurantFilters;
  setFilters: (next: RestaurantFilters) => void;
  vegLocked?: boolean;          // when invitee is veg
  vegLockedReason?: string;     // tooltip-like helper text
  className?: string;
  /**
   * Cuisine chips. Swiggy has hundreds of free-form cuisines rather than the old
   * fixed 6-value union, so callers derive these from whatever came back —
   * `cuisinesOf(restaurants)` in utils/filters.
   */
  cuisineOptions?: string[];
};

const SORT_LABELS: Record<SortKey, { label: string; icon: IconType }> = {
  relevance:    { label: 'Relevance',     icon: IconSparkles },
  rating:       { label: 'Rating',        icon: IconStar },
  eta:          { label: 'Delivery time', icon: IconClock },
  'price-asc':  { label: 'Price: low',    icon: IconWallet },
  'price-desc': { label: 'Price: high',   icon: IconWallet },
};

export default function FilterBar({
  filters, setFilters, vegLocked, vegLockedReason, className = '', cuisineOptions = [],
}: Props) {
  const [sortOpen, setSortOpen] = useState(false);

  function patch(p: Partial<RestaurantFilters>) {
    setFilters({ ...filters, ...p });
  }
  function toggleCuisine(c: string) {
    const next = new Set(filters.cuisines);
    next.has(c) ? next.delete(c) : next.add(c);
    patch({ cuisines: next });
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Search bar — Swiggy style rounded with shadow */}
      <div className="relative">
        <input
          value={filters.q}
          onChange={(e) => patch({ q: e.target.value })}
          placeholder="Search restaurants or dishes…"
          className="w-full bg-white rounded-xl pl-11 pr-10 py-3 text-sm shadow-card border border-line-subtle outline-none focus:border-swiggy-orange focus:ring-2 focus:ring-orange-100 transition placeholder:text-ink-tertiary"
        />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-tertiary"><IconSearch size={16} /></span>
        {filters.q && (
          <button
            onClick={() => patch({ q: '' })}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center rounded-full bg-surface-tertiary text-ink-tertiary hover:bg-surface-tertiary text-xs"
            aria-label="Clear search"
          >
            <IconClose size={14} />
          </button>
        )}
      </div>

      {/* Filter chips row */}
      <div className="relative">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
          {/* Sort chip */}
          <div className="relative">
            <button
              onClick={() => setSortOpen((s) => !s)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border-2 text-sm font-semibold transition active:scale-95 ${
                filters.sort !== 'relevance'
                  ? 'bg-swiggy-dark text-white border-swiggy-dark'
                  : 'bg-white text-ink-secondary border-line-default hover:border-line-default'
              }`}
            >
              <span>⇅</span>
              {filters.sort === 'relevance' ? 'Sort' : SORT_LABELS[filters.sort].label}
              <span className="text-xs opacity-60">▾</span>
            </button>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setSortOpen(false)} />
                <div className="absolute z-40 left-0 mt-2 bg-white rounded-xl shadow-pop border border-line-subtle py-1 w-52 animate-fade-in-down">
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => {
                    const Icon = SORT_LABELS[k].icon;
                    return (
                    <button
                      key={k}
                      onClick={() => { patch({ sort: k }); setSortOpen(false); }}
                      className={`w-full text-left px-3.5 py-2 text-sm flex items-center gap-2 hover:bg-orange-50 ${
                        filters.sort === k ? 'text-swiggy-orange font-semibold bg-orange-50/50' : 'text-ink-secondary'
                      }`}
                    >
                      <Icon size={14} />
                      {SORT_LABELS[k].label}
                      {filters.sort === k && <span className="ml-auto text-swiggy-orange"><IconCheck size={14} /></span>}
                    </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Pure Veg toggle */}
          <button
            onClick={() => !vegLocked && patch({ vegOnly: !filters.vegOnly })}
            disabled={vegLocked}
            title={vegLocked ? vegLockedReason : undefined}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border-2 text-sm font-semibold transition active:scale-95 ${
              filters.vegOnly
                ? 'bg-green-50 text-green-700 border-green-500'
                : 'bg-white text-ink-secondary border-line-default hover:border-line-default'
            } ${vegLocked ? 'cursor-not-allowed opacity-90' : ''}`}
          >
            <span className="inline-block w-3.5 h-3.5 border-[1.5px] border-green-600 grid place-items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
            </span>
            Pure Veg
            {vegLocked && <IconLock size={12} />}
          </button>

          {/* Bestseller */}
          <button
            onClick={() => patch({ bestsellerOnly: !filters.bestsellerOnly })}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border-2 text-sm font-semibold transition active:scale-95 ${
              filters.bestsellerOnly
                ? 'bg-amber-50 text-amber-700 border-amber-500'
                : 'bg-white text-ink-secondary border-line-default hover:border-line-default'
            }`}
          >
            <IconStar size={14} /> Bestseller
          </button>

          {/* Cuisine chips */}
          {cuisineOptions.map((c) => {
            const active = filters.cuisines.has(c);
            return (
              <button
                key={c}
                onClick={() => toggleCuisine(c)}
                className={`shrink-0 inline-flex items-center gap-1 px-3.5 py-2 rounded-full border-2 text-sm font-semibold transition active:scale-95 ${
                  active
                    ? 'bg-swiggy-orange text-white border-swiggy-orange'
                    : 'bg-white text-ink-secondary border-line-default hover:border-line-default'
                }`}
              >
                {c}
                {active && <span className="ml-0.5 opacity-90"><IconClose size={12} /></span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active filter summary */}
      {(filters.cuisines.size > 0 || filters.bestsellerOnly || filters.vegOnly || filters.q) && (
        <div className="text-[11px] text-ink-tertiary flex items-center gap-2 animate-fade-in">
          <span>Filters active:</span>
          <button
            onClick={() => setFilters({ ...filters, q: '', cuisines: new Set(), bestsellerOnly: false, vegOnly: vegLocked ? filters.vegOnly : false, sort: 'relevance' })}
            className="text-swiggy-orange font-semibold hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
