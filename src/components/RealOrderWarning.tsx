import { IconBolt, IconCheck, IconStore, IconMapPin, IconWallet, IconTruck } from './icons/Icons';

export type OrderPreviewLine = { id: string; label: string; sublabel?: string; amount?: number };

/**
 * The last thing standing between a click and a REAL, paid Swiggy order.
 *
 * There is no Swiggy sandbox: `place_food_order` / `checkout` act on the user's
 * live account and spend real money (COD in v1). It is also NOT idempotent, so a
 * double-fire can double-charge. Every code path that can place an order must go
 * through this modal first — do not add a placement button without one.
 */
export default function RealOrderWarning({
  open,
  lines,
  total,
  addressLabel,
  paymentNote = 'Cash on delivery',
  busy = false,
  confirmLabel,
  note,
  testMode = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  /** one row per real Swiggy order that will be placed */
  lines: OrderPreviewLine[];
  total: number;
  addressLabel?: string;
  paymentNote?: string;
  busy?: boolean;
  confirmLabel?: string;
  /** extra caveat, e.g. "orders are staggered over 30 min — keep this tab open" */
  note?: string;
  /** When on, placement is MOCKED — no real order, nothing charged. */
  testMode?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const n = lines.length;
  const plural = n === 1 ? '' : 's';

  return (
    <div
      className="fixed inset-0 bg-ink-primary/60 backdrop-blur-sm z-[60] grid place-items-center px-5 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="real-order-title"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-floating animate-pop overflow-hidden flex flex-col max-h-[90vh]">
        {/* Banner — blue for test, red for a real paid order */}
        <div
          className={`px-6 py-5 border-b shrink-0 ${
            testMode ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'
          }`}
        >
          <div className="flex items-start gap-3.5">
            <span
              className={`w-11 h-11 rounded-2xl text-white grid place-items-center shrink-0 shadow-pop ${
                testMode ? 'bg-blue-500' : 'bg-swiggy-red'
              }`}
            >
              <IconBolt size={22} />
            </span>
            <div className="min-w-0">
              <div
                className={`text-[10px] uppercase tracking-[0.14em] font-black ${
                  testMode ? 'text-blue-600' : 'text-swiggy-red'
                }`}
              >
                {testMode ? 'Test mode' : 'Real, paid order'}
              </div>
              <h2 id="real-order-title" className="font-black text-xl mt-0.5 tracking-tight text-ink-primary">
                Place {n} {testMode ? 'test' : 'real'} order{plural}?
              </h2>
            </div>
          </div>
          <p className="text-[13px] text-ink-secondary mt-2.5 leading-relaxed">
            {testMode ? (
              <>
                Runs the full flow but <strong>does not place a real Swiggy order</strong> — nothing
                is cooked and nothing is charged. Order ids are fake (TEST-…).
              </>
            ) : (
              <>
                This places <strong>genuine, paid Swiggy order{plural}</strong>. Food will actually be
                cooked and delivered, and you will be charged.
              </>
            )}
          </p>
        </div>

        {/* Body — scrolls if there are many orders */}
        <div className="p-5 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-ink-tertiary mb-2">
            {n} order{plural} · one Swiggy checkout each
          </div>

          <div className="space-y-2">
            {lines.map((l) => {
              const isMart = l.id === 'instamart';
              return (
                <div
                  key={l.id}
                  className="flex items-center gap-3 rounded-xl border border-line-subtle px-3 py-2.5"
                >
                  <span
                    className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${
                      isMart ? 'bg-purple-50 text-swiggy-mart' : 'bg-orange-50 text-swiggy-orange'
                    }`}
                  >
                    {isMart ? <IconBolt size={17} /> : <IconStore size={17} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink-primary text-sm leading-snug">
                      {l.label}
                    </span>
                    {l.sublabel && (
                      <span className="block text-[11px] text-ink-tertiary mt-0.5">{l.sublabel}</span>
                    )}
                  </span>
                  {l.amount != null && (
                    <span className="font-bold tabular-nums shrink-0 text-sm text-ink-primary">
                      ₹{l.amount}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Total + details */}
          <div className="mt-4 rounded-2xl bg-surface-secondary p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-ink-secondary">
                {testMode ? 'Total (not charged)' : 'Total to pay'}
              </span>
              <span className="text-2xl font-black tabular-nums text-ink-primary">₹{total}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-line-subtle space-y-2 text-[13px]">
              {addressLabel && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-ink-secondary inline-flex items-center gap-1.5">
                    <IconMapPin size={14} className="text-ink-tertiary" /> Delivering to
                  </span>
                  <span className="font-semibold text-ink-primary truncate max-w-[55%] text-right">
                    {addressLabel}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="text-ink-secondary inline-flex items-center gap-1.5">
                  <IconWallet size={14} className="text-ink-tertiary" /> Payment
                </span>
                <span className="font-semibold text-ink-primary">{paymentNote}</span>
              </div>
            </div>
          </div>

          {note && (
            <div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 text-[12px] text-amber-800 leading-snug flex items-start gap-2">
              <IconTruck size={15} className="shrink-0 mt-0.5" />
              <span>{note}</span>
            </div>
          )}

          <p className="mt-3 text-[11px] text-ink-tertiary leading-snug">
            Orders can't be cancelled from CaterKart — use the Swiggy app.
            {n > 1 && ' Each restaurant is placed as its own order.'}
          </p>
        </div>

        {/* Actions — pinned */}
        <div className="p-5 pt-3 border-t border-line-subtle shrink-0 flex gap-2">
          <button onClick={onCancel} disabled={busy} className="btn-ghost flex-1 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy} className="btn-primary flex-1 disabled:opacity-60">
            {busy ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin-slow" />
                Placing…
              </>
            ) : (
              <>
                <IconCheck size={16} />
                {confirmLabel ?? 'Yes, order for real'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
