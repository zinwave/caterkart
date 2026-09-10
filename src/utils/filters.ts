import type { Dish, Restaurant } from '../lib/mcp/types';

export type SortKey = 'relevance' | 'rating' | 'eta' | 'price-asc' | 'price-desc';

export type RestaurantFilters = {
  q: string;
  vegOnly: boolean;
  bestsellerOnly: boolean;
  /** Cuisines are free-form strings now — Swiggy has hundreds, not a fixed union. */
  cuisines: Set<string>;
  sort: SortKey;
};

export const defaultFilters = (): RestaurantFilters => ({
  q: '',
  vegOnly: false,
  bestsellerOnly: false,
  cuisines: new Set(),
  sort: 'relevance',
});

export function isFiltersActive(f: RestaurantFilters): number {
  let n = 0;
  if (f.q.trim()) n++;
  if (f.vegOnly) n++;
  if (f.bestsellerOnly) n++;
  if (f.cuisines.size > 0) n++;
  if (f.sort !== 'relevance') n++;
  return n;
}

/**
 * Restaurant-level filtering.
 *
 * NOTE: menus are NOT available here. Swiggy returns restaurants and menus from
 * separate calls, so we cannot filter restaurants by their dishes the way the
 * old mock did (it embedded `dishes` on every restaurant). Veg/bestseller
 * therefore filter DISHES inside an open menu, and the search box is handed to
 * Swiggy's own search rather than being applied client-side.
 */
export function applyToRestaurants(source: Restaurant[], f: RestaurantFilters): Restaurant[] {
  let out = source;

  if (f.cuisines.size > 0) {
    out = out.filter((r) => r.cuisines.some((c) => f.cuisines.has(c)));
  }

  switch (f.sort) {
    case 'rating':
      out = [...out].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
    case 'eta':
      out = [...out].sort((a, b) => a.etaMin - b.etaMin);
      break;
    case 'price-asc':
      out = [...out].sort((a, b) => costOf(a) - costOf(b));
      break;
    case 'price-desc':
      out = [...out].sort((a, b) => costOf(b) - costOf(a));
      break;
    case 'relevance':
    default:
      // Swiggy already ranked these — keep its order.
      break;
  }

  return out;
}

/** "₹500 for two" → 500, for sorting only. */
function costOf(r: Restaurant): number {
  const n = Number((r.costForTwo || '').replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : Number.MAX_SAFE_INTEGER;
}

export function applyToDishes(dishes: Dish[], f: RestaurantFilters): Dish[] {
  let out = dishes;
  if (f.vegOnly) out = out.filter((d) => d.veg);
  if (f.bestsellerOnly) out = out.filter((d) => d.bestseller);
  if (f.q.trim()) {
    const q = f.q.trim().toLowerCase();
    out = out.filter((d) => d.name.toLowerCase().includes(q));
  }
  return out;
}

/** Derive the cuisine chips from whatever Swiggy actually returned. */
export function cuisinesOf(restaurants: Restaurant[]): string[] {
  const counts = new Map<string, number>();
  restaurants.forEach((r) => r.cuisines.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1)));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([c]) => c);
}
