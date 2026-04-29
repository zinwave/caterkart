import { Cuisine, Dish, Restaurant } from '../data/mock';

export type SortKey = 'relevance' | 'rating' | 'eta' | 'price-asc' | 'price-desc';

export type RestaurantFilters = {
  q: string;
  vegOnly: boolean;
  bestsellerOnly: boolean;
  cuisines: Set<Cuisine>;
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

export function priceForTwo(r: Restaurant): number {
  if (r.dishes.length === 0) return 0;
  const avg = r.dishes.reduce((s, d) => s + d.price, 0) / r.dishes.length;
  return Math.round((avg * 2) / 10) * 10;
}

export function minDishPrice(r: Restaurant): number {
  return Math.min(...r.dishes.map((d) => d.price));
}

export function applyToRestaurants(
  source: Restaurant[],
  f: RestaurantFilters
): Restaurant[] {
  let out = source;

  if (f.cuisines.size > 0) {
    out = out.filter((r) => r.cuisines.some((c) => f.cuisines.has(c)));
  }
  if (f.vegOnly) {
    out = out.filter((r) => r.dishes.some((d) => d.veg));
  }
  if (f.bestsellerOnly) {
    out = out.filter((r) => r.dishes.some((d) => d.bestseller));
  }
  if (f.q.trim()) {
    const q = f.q.trim().toLowerCase();
    out = out.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.cuisines.some((c) => c.toLowerCase().includes(q)) ||
        r.dishes.some((d) => d.name.toLowerCase().includes(q))
    );
  }

  switch (f.sort) {
    case 'rating':
      out = [...out].sort((a, b) => b.rating - a.rating);
      break;
    case 'eta':
      out = [...out].sort((a, b) => a.etaMin - b.etaMin);
      break;
    case 'price-asc':
      out = [...out].sort((a, b) => minDishPrice(a) - minDishPrice(b));
      break;
    case 'price-desc':
      out = [...out].sort((a, b) => minDishPrice(b) - minDishPrice(a));
      break;
    case 'relevance':
    default:
      // keep source order
      break;
  }

  return out;
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

export const ALL_CUISINES: Cuisine[] = [
  'Biryani', 'Pizza', 'Chinese', 'South Indian', 'Burgers', 'Desserts',
];
