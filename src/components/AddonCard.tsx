import type { SVGProps } from 'react';
import type { Product } from '../lib/mcp/types';
import { FoodImage } from './RestaurantCard';
import { IconPlus, IconCheck } from './icons/Icons';

/** Local minus glyph — the shared Icons set has IconPlus but no IconMinus. */
const IconMinus = ({ size = 20, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    <path d="M5 12h14" />
  </svg>
);

/** Add button / stepper share one footprint so the card never jumps on add. */
const CONTROL = 'shrink-0 h-8 inline-flex items-center justify-center rounded-lg text-sm font-bold transition';

/**
 * Instamart add-on card — purple "mart" accent, shared card system.
 *
 * Everything here is real Swiggy data: the product photo, the pack size, the
 * live price and MRP. There is no "why we picked this" line because Instamart
 * doesn't give us one, and we don't invent copy.
 *
 * Quantities: at qty 0 the footer is an "Add" button; once in the basket it
 * becomes a compact (− qty +) stepper. Decrementing from 1 removes the line.
 */
export default function AddonCard({
  p,
  qty,
  onAdd,
  onSetQty,
}: {
  p: Product;
  qty: number;
  onAdd: () => void;
  onSetQty: (qty: number) => void;
}) {
  const soldOut = !p.inStock;
  const inBasket = qty > 0;
  const discounted = p.mrp > p.price;
  const off = discounted ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;

  // The card itself is only a click target for the first add. Once the stepper
  // is showing, clicking the card must not nuke the line — the buttons own it.
  const cardIsButton = !soldOut && !inBasket;

  return (
    <div
      role={cardIsButton ? 'button' : undefined}
      tabIndex={cardIsButton ? 0 : undefined}
      aria-disabled={soldOut}
      onClick={cardIsButton ? onAdd : undefined}
      onKeyDown={
        cardIsButton
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onAdd();
              }
            }
          : undefined
      }
      className={`group card p-3.5 flex gap-3 items-start transition ${
        soldOut
          ? 'opacity-60 cursor-not-allowed'
          : inBasket
            ? 'border-swiggy-mart ring-1 ring-swiggy-mart bg-purple-50/40'
            : 'hover:border-purple-200 hover:shadow-floating cursor-pointer'
      }`}
    >
      <div className="relative w-14 h-14 shrink-0">
        <FoodImage
          src={p.imageUrl}
          alt={p.name}
          className={`w-14 h-14 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 ${soldOut ? 'grayscale' : ''}`}
        />
        {inBasket && !soldOut && (
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-swiggy-mart text-white grid place-items-center ring-2 ring-white animate-pop">
            <IconCheck size={12} />
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-bold text-ink-primary leading-tight line-clamp-2">{p.name}</div>
        <div className="text-xs text-ink-tertiary mt-0.5 truncate">
          {p.brand ? `${p.brand} · ${p.unit}` : p.unit}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-ink-secondary text-sm tabular-nums">₹{p.price}</span>
          {discounted && (
            <>
              <span className="text-[11px] text-ink-tertiary line-through tabular-nums">₹{p.mrp}</span>
              <span className="chip chip-purple text-[10px] px-1.5 py-0.5">{off}% off</span>
            </>
          )}
        </div>
      </div>

      {soldOut ? (
        <span className={`${CONTROL} px-3 bg-surface-tertiary text-ink-tertiary text-xs`}>
          Sold out
        </span>
      ) : inBasket ? (
        <div
          className={`${CONTROL} px-1 gap-0.5 bg-swiggy-mart text-white shadow-pop`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onSetQty(qty - 1)}
            aria-label={qty === 1 ? `Remove ${p.name}` : `Decrease ${p.name} quantity`}
            className="w-6 h-6 grid place-items-center rounded-md hover:bg-white/20 active:scale-90 transition"
          >
            <IconMinus size={14} />
          </button>
          <span
            aria-live="polite"
            className="min-w-[1.25rem] text-center tabular-nums text-sm font-bold"
          >
            {qty}
          </span>
          <button
            type="button"
            onClick={() => onSetQty(qty + 1)}
            aria-label={`Increase ${p.name} quantity`}
            className="w-6 h-6 grid place-items-center rounded-md hover:bg-white/20 active:scale-90 transition"
          >
            <IconPlus size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          aria-label={`Add ${p.name}`}
          className={`${CONTROL} px-3 gap-1 bg-white border border-swiggy-mart text-swiggy-mart group-hover:bg-purple-50`}
        >
          Add <IconPlus size={14} />
        </button>
      )}
    </div>
  );
}
