import { useMemo, useState } from 'react';
import { useCorporate } from '../state/CorporateContext';
import type { CatalogueDish, CatalogueRestaurant, OrderLine } from '../lib/workTypes';
import { inr } from '../lib/format';
import { IconPlus, IconChevronDown, IconStar } from './icons/Icons';
import { FoodImage } from './RestaurantCard';

// =====================================================
// Single-person dish picker, gated by cost-centre policy.
// Reused by the employee join page and the organizer's
// own picks. Owns only the tray for `employeeId`.
// =====================================================
export default function DishPicker({
  employeeId, vegOnly, perHeadCap, lines, onChange,
}: {
  employeeId: string;
  vegOnly: boolean;
  perHeadCap: number;
  lines: OrderLine[];
  onChange: (lines: OrderLine[]) => void;
}) {
  const { catalogue } = useCorporate();
  const [openR, setOpenR] = useState<string | null>(null);

  const total = useMemo(() => lines.reduce((s, l) => s + l.price * l.qty, 0), [lines]);
  const remaining = perHeadCap - total;
  const over = total > perHeadCap;
  const pct = perHeadCap > 0 ? Math.min(100, (total / perHeadCap) * 100) : 0;

  const qtyOf = (dishId: string) => lines.find((l) => l.dishId === dishId)?.qty ?? 0;

  function add(dish: CatalogueDish, r: CatalogueRestaurant) {
    const i = lines.findIndex((l) => l.dishId === dish.id);
    if (i >= 0) {
      const next = [...lines];
      next[i] = { ...next[i], qty: next[i].qty + 1 };
      onChange(next);
    } else {
      onChange([...lines, {
        employeeId, restaurantId: r.id, restaurantName: r.name,
        dishId: dish.id, dishName: dish.name, qty: 1, price: dish.price,
      }]);
    }
  }
  function change(dishId: string, delta: number) {
    onChange(lines.map((l) => (l.dishId === dishId ? { ...l, qty: l.qty + delta } : l)).filter((l) => l.qty > 0));
  }

  return (
    <div>
      {/* Cap meter */}
      <div className="sticky top-16 z-10 -mx-1 mb-3">
        <div className={`rounded-xl px-4 py-2.5 border flex items-center gap-3 sticky-blur ${over ? 'border-swiggy-red' : 'border-line-default'}`}>
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-ink-secondary">Your budget</span>
              <span className={`font-bold ${over ? 'text-swiggy-red' : 'text-ink-primary'}`}>
                {inr(total)} / {inr(perHeadCap)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-tertiary overflow-hidden">
              <div className={`h-full rounded-full transition-all ${over ? 'bg-swiggy-red' : pct > 80 ? 'bg-warning' : 'bg-swiggy-green'}`} style={{ width: `${Math.max(pct, 3)}%` }} />
            </div>
          </div>
          <div className={`text-xs font-bold whitespace-nowrap ${over ? 'text-swiggy-red' : 'text-swiggy-green'}`}>
            {over ? `${inr(-remaining)} over` : `${inr(remaining)} left`}
          </div>
        </div>
      </div>

      {/* Restaurants */}
      <div className="space-y-2">
        {catalogue.map((r) => {
          const open = openR === r.id;
          return (
            <div key={r.id} className="border border-line-subtle rounded-xl overflow-hidden bg-white">
              <button
                onClick={() => setOpenR(open ? null : r.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-secondary transition"
              >
                <FoodImage src={r.imageUrl} alt={r.name} className="w-10 h-10 rounded-lg shrink-0" />
                <div className="flex-1 text-left min-w-0">
                  <div className="font-bold text-sm text-ink-primary truncate">{r.name}</div>
                  <div className="text-[11px] text-ink-tertiary flex items-center gap-1.5">
                    <IconStar size={11} className="text-swiggy-green" /> {r.rating ?? 'New'} · {r.etaMin} min · {r.cuisines.join(', ')}
                  </div>
                </div>
                <IconChevronDown size={16} className={`text-ink-tertiary transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
              {open && (
                <div className="divide-y divide-line-subtle border-t border-line-subtle">
                  {r.dishes.map((d) => {
                    const blocked = vegOnly && !d.veg;
                    const q = qtyOf(d.id);
                    return (
                      <div key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                        <span className={`w-4 h-4 rounded-sm border grid place-items-center shrink-0 ${d.veg ? 'border-swiggy-green' : 'border-swiggy-red'}`}>
                          <span className={`w-2 h-2 rounded-full ${d.veg ? 'bg-swiggy-green' : 'bg-swiggy-red'}`} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-ink-primary flex items-center gap-1.5">
                            {d.name}
                            {d.bestseller && <span className="chip chip-orange text-[9px] py-0 inline-flex items-center gap-0.5"><IconStar size={9} /> Bestseller</span>}
                          </div>
                          <div className="text-xs text-ink-secondary">{inr(d.price)}</div>
                        </div>
                        {blocked ? (
                          <span className="text-[10px] font-bold text-swiggy-red bg-rose-50 px-2 py-1 rounded-lg">Veg-only team</span>
                        ) : q > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => change(d.id, -1)} className="w-7 h-7 rounded-lg bg-surface-tertiary text-ink-secondary font-bold">−</button>
                            <span className="text-sm font-bold w-5 text-center">{q}</span>
                            <button onClick={() => add(d, r)} className="w-7 h-7 rounded-lg bg-swiggy-orange text-white font-bold">+</button>
                          </div>
                        ) : (
                          <button onClick={() => add(d, r)} className="wbtn-soft text-xs py-1.5 px-3">
                            <IconPlus size={14} /> Add
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
