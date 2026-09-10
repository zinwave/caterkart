import { DietaryPref } from '../data/mock';

// Swiggy-style dietary mark: a bordered square with a dot (veg/jain/vegan)
// or a small triangle (non-veg) — replaces the 🟢🔴🟡🌱 emojis app-wide.
const DIET_MARK: Record<DietaryPref, { color: string; nonveg?: boolean }> = {
  veg:       { color: 'border-swiggy-green text-swiggy-green' },
  'non-veg': { color: 'border-swiggy-red text-swiggy-red', nonveg: true },
  jain:      { color: 'border-amber-600 text-amber-600' },
  vegan:     { color: 'border-lime-600 text-lime-600' },
};

export const DIET_LABEL: Record<DietaryPref, string> = {
  veg: 'Veg', 'non-veg': 'Non-veg', jain: 'Jain', vegan: 'Vegan',
};

export function DietMark({ d, size = 14 }: { d?: DietaryPref; size?: number }) {
  if (!d) return null;
  const m = DIET_MARK[d];
  const inner = Math.round(size * 0.42);
  return (
    <span
      className={`inline-grid place-items-center border-[1.5px] shrink-0 ${m.color}`}
      style={{ width: size, height: size }}
    >
      {m.nonveg ? (
        <span
          style={{
            width: 0, height: 0,
            borderLeft: `${inner / 2}px solid transparent`,
            borderRight: `${inner / 2}px solid transparent`,
            borderBottom: `${inner}px solid currentColor`,
          }}
        />
      ) : (
        <span className="rounded-full bg-current" style={{ width: inner, height: inner }} />
      )}
    </span>
  );
}
