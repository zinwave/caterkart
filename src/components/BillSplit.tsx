import { useMemo } from 'react';
import { useCelebration } from '../state/CelebrationContext';
import type { Bill } from '../lib/mcp/types';
import { IconWallet, IconTag } from './icons/Icons';

/**
 * Bill summary.
 *
 * `bills` are the REAL Swiggy bills — one per restaurant, priced by Swiggy
 * itself (item total, delivery, taxes, coupon, to-pay). We never invent
 * delivery/platform/tax numbers.
 *
 * Splitting the bill happens LATER, on the Settle up page — not here — so this
 * only shows what's owed and how it's paid.
 */
export default function BillSplit({ bills = [] }: { bills?: Bill[] }) {
  const { foodTotal, addonTotal, groupSize } = useCelebration();

  const priced = bills.length > 0;

  const totals = useMemo(() => {
    if (!priced) {
      return { itemTotal: foodTotal, delivery: 0, taxes: 0, discount: 0, grand: foodTotal + addonTotal };
    }
    const sum = (f: (b: Bill) => number) => bills.reduce((s, b) => s + f(b), 0);
    return {
      itemTotal: sum((b) => b.itemTotal),
      delivery: sum((b) => b.deliveryCharge),
      taxes: sum((b) => b.taxesAndCharges),
      discount: sum((b) => b.couponDiscount),
      // Swiggy's own "to pay", plus the Instamart add-ons (priced separately).
      grand: sum((b) => b.toPay) + addonTotal,
    };
  }, [priced, bills, foodTotal, addonTotal]);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Bill summary</div>
        <span className="chip chip-green">{groupSize} people</span>
      </div>

      <dl className="text-sm mt-3 space-y-1.5 text-ink-secondary">
        <Row k="Food (across restaurants)" v={`₹${totals.itemTotal}`} />
        <Row k="Instamart add-ons" v={`₹${addonTotal}`} faded={addonTotal === 0} />
        {priced ? (
          <>
            <Row
              k="Delivery"
              v={totals.delivery === 0 ? 'FREE' : `₹${totals.delivery}`}
              faded={totals.delivery === 0}
            />
            <Row k="Taxes & charges" v={`₹${Math.round(totals.taxes)}`} />
            {totals.discount > 0 && <Row k="Coupon discount" v={`−₹${totals.discount}`} />}
          </>
        ) : (
          <div className="text-[11px] text-ink-tertiary italic pt-1">
            Delivery and taxes are set by Swiggy — priced when you review the order.
          </div>
        )}
      </dl>

      <div className="mt-3 pt-3 border-t border-line-subtle flex items-center justify-between">
        <div className="font-bold">{priced ? 'Total' : 'Subtotal'}</div>
        <div className="font-bold text-lg tabular-nums">₹{totals.grand}</div>
      </div>

      {/* Payment */}
      <div className="mt-3 pt-3 border-t border-line-subtle flex items-center justify-between text-sm">
        <span className="text-ink-secondary inline-flex items-center gap-1.5">
          <IconWallet size={14} className="text-ink-tertiary" /> Payment
        </span>
        <span className="font-bold text-ink-primary">Cash on delivery</span>
      </div>

      {/* Splitting happens on the Settle up page */}
      <div className="mt-3 rounded-xl bg-surface-secondary px-3 py-2.5 text-[11px] text-ink-tertiary leading-snug flex items-start gap-2">
        <IconTag size={13} className="text-swiggy-orange shrink-0 mt-0.5" />
        <span>
          Split with everyone on the <b className="text-ink-secondary">Settle up</b> page after the
          order is placed.
        </span>
      </div>
    </div>
  );
}

function Row({ k, v, faded }: { k: string; v: string; faded?: boolean }) {
  return (
    <div className={`flex justify-between ${faded ? 'opacity-50' : ''}`}>
      <dt>{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}
