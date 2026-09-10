import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Cart, CartItemInput, Coupon } from '../lib/mcp/types';
import { IconCheck, IconClose, IconSparkles, IconTag } from './icons/Icons';

/**
 * Pick a Swiggy coupon for ONE restaurant.
 *
 * Swiggy's cart is single-restaurant and coupons apply to whatever is in it, so
 * opening this sheet first loads that restaurant's items into the cart, then
 * asks Swiggy which coupons are valid for that exact basket ("Add ₹610 more to
 * avail this offer" is a real answer). Applying returns the re-priced bill.
 */
export default function CouponSheet({
  open,
  addressId,
  restaurantId,
  restaurantName,
  items,
  appliedCode,
  onApplied,
  onClose,
}: {
  open: boolean;
  addressId: string;
  restaurantId: string;
  restaurantName: string;
  /** this restaurant's lines, so we can rebuild the cart before asking */
  items: CartItemInput[];
  appliedCode?: string;
  /** hands back the freshly-priced cart so the caller can update its bill */
  onApplied: (code: string, cart: Cart) => void;
  onClose: () => void;
}) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError(null);
    // The cart must hold THIS restaurant before Swiggy can judge its coupons.
    api.swiggy
      .setCart(addressId, restaurantId, items)
      .then(() => api.swiggy.coupons(addressId, restaurantId))
      .then((c) => alive && setCoupons(c))
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('[caterkart] coupons load failed:', e);
        if (alive) setError("Couldn't load coupons right now — try again.");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, addressId, restaurantId, items]);

  if (!open) return null;

  async function apply(code: string) {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setApplying(clean);
    setError(null);
    try {
      // Make sure the cart still holds this restaurant, then apply.
      await api.swiggy.setCart(addressId, restaurantId, items);
      const cart = await api.swiggy.applyCoupon(addressId, clean);
      onApplied(clean, cart);
      onClose();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[caterkart] coupon apply failed:', e);
      setError("That coupon isn't available for this order.");
    } finally {
      setApplying(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-ink-primary/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-floating animate-pop max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-line-subtle">
          <span className="w-10 h-10 rounded-xl bg-orange-50 text-swiggy-orange grid place-items-center shrink-0">
            <IconTag size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-lg tracking-tight text-ink-primary leading-tight">
              Coupons
            </h3>
            <p className="text-[12px] text-ink-tertiary truncate">{restaurantName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg grid place-items-center text-ink-tertiary hover:bg-surface-secondary transition shrink-0"
            aria-label="Close"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {/* Manual entry */}
          <div className="flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && apply(manual)}
              placeholder="Enter coupon code"
              className="flex-1 rounded-xl border border-line-default bg-white px-3.5 py-2.5 text-sm font-semibold tracking-wide uppercase outline-none focus:ring-2 focus:ring-orange-100 focus:border-swiggy-orange transition"
            />
            <button
              onClick={() => apply(manual)}
              disabled={!manual.trim() || !!applying}
              className="btn-primary px-5 disabled:opacity-40"
            >
              {applying === manual.trim().toUpperCase() ? '…' : 'Apply'}
            </button>
          </div>

          {error && (
            <div className="mt-3 text-[12px] font-semibold text-swiggy-red bg-red-50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Swiggy's own list */}
          <div className="mt-5">
            <div className="text-[11px] uppercase tracking-[0.12em] font-bold text-ink-tertiary mb-2">
              Available on this order
            </div>

            {loading && <CouponSkeleton />}

            {!loading && coupons.length === 0 && (
              <p className="text-sm text-ink-tertiary py-3">
                Swiggy has no coupons for this basket right now.
              </p>
            )}

            <div className="space-y-2">
              {coupons.map((c) => {
                const active = c.code === appliedCode;
                return (
                  <div
                    key={c.code}
                    className={`rounded-2xl border p-3.5 transition ${
                      active
                        ? 'border-swiggy-green bg-green-50/50'
                        : c.applicable
                          ? 'border-line-default hover:border-swiggy-orange'
                          : 'border-line-subtle bg-surface-secondary opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-black tracking-wide text-ink-primary">{c.code}</span>
                      {c.best && c.applicable && (
                        <span className="chip chip-orange inline-flex items-center gap-1 text-[10px]">
                          <IconSparkles size={10} /> Best
                        </span>
                      )}
                      {active && (
                        <span className="chip chip-green inline-flex items-center gap-1 text-[10px]">
                          <IconCheck size={10} /> Applied
                        </span>
                      )}
                      <span className="flex-1" />
                      {c.applicable && !active && (
                        <button
                          onClick={() => apply(c.code)}
                          disabled={!!applying}
                          className="text-xs font-black uppercase tracking-wide text-swiggy-orange hover:underline disabled:opacity-40"
                        >
                          {applying === c.code ? 'Applying…' : 'Apply'}
                        </button>
                      )}
                    </div>
                    <p
                      className={`text-[12px] mt-1 ${
                        c.applicable ? 'text-swiggy-green font-semibold' : 'text-ink-tertiary'
                      }`}
                    >
                      {c.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function CouponSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-2xl border border-line-subtle p-3.5 animate-pulse">
          <div className="h-4 w-24 bg-surface-tertiary rounded" />
          <div className="h-3 w-40 bg-surface-tertiary rounded mt-2" />
        </div>
      ))}
    </div>
  );
}
