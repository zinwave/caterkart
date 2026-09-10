import { useState } from 'react';
import type { Dish } from '../lib/mcp/types';
import { FoodImage } from './RestaurantCard';
import { IconStar, IconPlus } from './icons/Icons';

type Props = {
  dish: Dish;
  /** How many of this dish the currently-picking member already has. 0 = not in cart. */
  qty: number;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
  /** e.g. restaurant closed on Swiggy — row renders but can't be added to. */
  disabled?: boolean;
};

export default function DishRow({ dish, qty, onAdd, onInc, onDec, disabled = false }: Props) {
  const [bumped, setBumped] = useState(false);
  const available = dish.inStock && !disabled;
  const inCart = qty > 0;

  function bump() {
    setBumped(true);
    setTimeout(() => setBumped(false), 350);
  }

  function handleAdd() {
    if (!available) return;
    bump();
    onAdd();
  }

  function handleInc() {
    if (!available) return;
    bump();
    onInc();
  }

  return (
    <div className={`flex items-start gap-4 py-4 ${dish.inStock ? '' : 'opacity-50'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Veg / non-veg mark */}
          <span
            className={`inline-grid place-items-center w-3.5 h-3.5 border-[1.5px] ${
              dish.veg ? 'border-swiggy-green' : 'border-swiggy-red'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${dish.veg ? 'bg-swiggy-green' : 'bg-swiggy-red'}`}
            />
          </span>
          {dish.bestseller && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
              <IconStar size={10} /> Bestseller
            </span>
          )}
          {dish.rating && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-700">
              <IconStar size={10} /> {dish.rating}
            </span>
          )}
          {inCart && (
            <span className="chip chip-orange text-[10px] py-0.5">
              {qty} in cart
            </span>
          )}
        </div>

        <div className="font-bold text-ink-primary leading-tight mt-1.5">{dish.name}</div>
        <div className="text-sm font-bold text-ink-primary mt-1 tabular-nums">
          ₹{dish.price}
          {inCart && (
            <span className="ml-1.5 text-[11px] font-semibold text-ink-tertiary">
              ₹{dish.price * qty} total
            </span>
          )}
        </div>
        {dish.description && (
          <div className="text-xs text-ink-tertiary mt-1.5 line-clamp-2 leading-relaxed">
            {dish.description}
          </div>
        )}
      </div>

      {/* Image + floating ADD / stepper (Swiggy pattern) */}
      <div className="relative shrink-0 w-24">
        <FoodImage
          src={dish.imageUrl}
          alt={dish.name}
          className={`w-24 h-24 rounded-2xl shadow-card border border-line-subtle transition-transform ${
            bumped ? 'scale-95' : ''
          }`}
        />

        {!dish.inStock ? (
          <button
            disabled
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center px-4 py-1.5 rounded-lg bg-white border border-line-default text-ink-tertiary text-sm font-black uppercase tracking-wide shadow-pop cursor-not-allowed"
          >
            Sold out
          </button>
        ) : inCart ? (
          <div
            className={`absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center rounded-lg bg-white border border-swiggy-green shadow-pop overflow-hidden ${
              bumped ? 'animate-pop' : ''
            }`}
          >
            <button
              onClick={onDec}
              aria-label={`Remove one ${dish.name}`}
              className="px-2.5 py-1.5 text-swiggy-green font-black text-sm leading-none hover:bg-green-50 active:scale-95 transition"
            >
              −
            </button>
            <span className="px-1 min-w-[1.5rem] text-center text-sm font-black text-swiggy-green tabular-nums leading-none">
              {qty}
            </span>
            <button
              onClick={handleInc}
              disabled={disabled}
              aria-label={`Add one more ${dish.name}`}
              className="px-2.5 py-1.5 text-swiggy-green font-black text-sm leading-none hover:bg-green-50 active:scale-95 transition disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
        ) : (
          <button
            onClick={handleAdd}
            disabled={!available}
            className={`absolute -bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-4 py-1.5 rounded-lg bg-white border text-sm font-black uppercase tracking-wide shadow-pop transition-all ${
              available
                ? 'border-swiggy-green text-swiggy-green hover:bg-green-50 active:scale-95'
                : 'border-line-default text-ink-tertiary cursor-not-allowed'
            } ${bumped ? 'animate-pop' : ''}`}
          >
            Add <IconPlus size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
