import { Link, useNavigate } from 'react-router-dom';
import { useCelebration } from '../state/CelebrationContext';
import { MemberAvatar } from '../components/MemberAvatar';
import { OccasionIcon } from '../components/OccasionIcon';
import {
  IconStore, IconPlus, IconArrowRight, IconReceipt,
  IconUsers, IconCalendar, IconClock, IconBolt, IconGift,
} from '../components/icons/Icons';

/**
 * The event as an OPEN TAB — a Splitwise-style running ledger.
 *
 * After each round of orders is placed it lands here, where the host can either
 * add ANOTHER order to the same event (a fresh round, same guests) or settle the
 * whole thing up at once. The event stays open until the host chooses to settle.
 */
export default function EventSummary() {
  const nav = useNavigate();
  const {
    occasion, eventTitle, date, time, members, groupSize,
    ledger, round, eventTotal, startNewRound,
  } = useCelebration();

  const placed = ledger.filter((o) => o.orderId);
  const failed = ledger.filter((o) => !o.orderId);

  // Group the placed orders by the round they went out in.
  const rounds = Array.from(new Set(ledger.map((o) => o.round))).sort((a, b) => a - b);

  const onAddAnother = () => {
    startNewRound();
    nav('/group');
  };

  if (ledger.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-orange-50 text-swiggy-orange grid place-items-center mx-auto">
          <IconReceipt size={26} />
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-tight text-ink-primary">No orders yet</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Your event's tab is empty. Start a round and it'll show up here.
        </p>
        <button onClick={() => nav('/create')} className="btn-primary mt-6">
          Plan the celebration <IconArrowRight size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-8 pb-40">
      {/* Header */}
      <header className="reveal">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-green-50 text-swiggy-green">
            <span className="w-1.5 h-1.5 rounded-full bg-swiggy-green animate-pulse-soft" /> Tab open
          </span>
          <div className="section-title">Your event</div>
        </div>
        <h1 className="mt-2 text-3xl sm:text-[2.4rem] font-black tracking-tight text-ink-primary leading-[1.1] flex items-center gap-2.5">
          <OccasionIcon icon={occasion?.icon} size={30} className="text-swiggy-orange shrink-0" />
          <span>{eventTitle}</span>
        </h1>
        <p className="mt-2 text-[13px] text-ink-tertiary flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1"><IconCalendar size={13} /> {date}</span>
          <span className="inline-flex items-center gap-1"><IconClock size={13} /> {time}</span>
          <span className="inline-flex items-center gap-1"><IconUsers size={13} /> {groupSize}</span>
          <span className="inline-flex items-center gap-1"><IconStore size={13} /> {placed.length} order{placed.length === 1 ? '' : 's'}</span>
        </p>
      </header>

      {/* Running total */}
      <div className="card p-5 mt-6 reveal bg-gradient-to-br from-white to-orange-50/40" style={{ animationDelay: '60ms' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-ink-tertiary">
              Running total
            </div>
            <div className="text-4xl font-black tabular-nums text-ink-primary mt-1">₹{eventTotal}</div>
            <div className="text-[12px] text-ink-tertiary mt-1">
              across {placed.length} order{placed.length === 1 ? '' : 's'} · {rounds.length} round
              {rounds.length === 1 ? '' : 's'}
            </div>
          </div>
          <div className="flex -space-x-2">
            {members.slice(0, 5).map((m) => (
              <MemberAvatar key={m.id} m={m} size={34} />
            ))}
            {members.length > 5 && (
              <span className="w-[34px] h-[34px] rounded-full bg-surface-tertiary text-ink-tertiary text-[11px] font-bold grid place-items-center ring-2 ring-white">
                +{members.length - 5}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Orders, grouped by round */}
      <div className="mt-6 space-y-5">
        {rounds.map((r) => {
          const orders = ledger.filter((o) => o.round === r);
          const roundTotal = orders.reduce((s, o) => s + (o.orderId ? o.toPay : 0), 0);
          return (
            <section key={r} className="reveal">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-black tracking-tight text-ink-primary">
                  Round {r}
                  {r === round && <span className="chip chip-orange ml-2 text-[10px]">latest</span>}
                </h2>
                <span className="text-[12px] font-bold text-ink-secondary tabular-nums">₹{roundTotal}</span>
              </div>
              <div className="space-y-2">
                {orders.map((o) => {
                  const inner = (
                    <>
                      <span
                        className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${
                          o.orderId ? 'bg-orange-50 text-swiggy-orange' : 'bg-red-50 text-swiggy-red'
                        }`}
                      >
                        {o.orderId ? <IconStore size={17} /> : <IconBolt size={17} />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-ink-primary truncate">{o.restaurantName}</div>
                        <div className="text-[11px] text-ink-tertiary truncate">
                          {o.orderId ? `Order ${o.orderId}` : o.error ?? 'Failed'}
                        </div>
                      </div>
                      {o.orderId ? (
                        <span className="font-black tabular-nums text-ink-primary">₹{o.toPay}</span>
                      ) : (
                        <span className="text-[11px] font-bold text-swiggy-red">Failed</span>
                      )}
                      {o.orderId && (
                        <span className="text-swiggy-orange shrink-0 inline-flex items-center gap-0.5 text-[11px] font-bold">
                          Track <IconArrowRight size={13} />
                        </span>
                      )}
                    </>
                  );
                  return o.orderId ? (
                    <Link
                      key={o.key}
                      to={`/orders/${o.orderId}`}
                      className="card p-3.5 flex items-center gap-3 hover:border-orange-200 transition"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div key={o.key} className="card p-3.5 flex items-center gap-3">
                      {inner}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {failed.length > 0 && (
        <p className="text-[12px] text-ink-tertiary mt-4 leading-snug">
          {failed.length} order{failed.length === 1 ? '' : 's'} didn't go through and aren't counted
          in the total. Orders can't be cancelled from CaterKart — use the Swiggy app.
        </p>
      )}

      {/* Sticky actions */}
      <div className="fixed inset-x-0 bottom-0 sticky-blur border-t border-line-default z-20">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center gap-2.5">
          <button
            onClick={() => nav(placed[0]?.orderId ? `/orders/${placed[0].orderId}` : '/orders')}
            disabled={placed.length === 0}
            className="btn-ghost text-sm shrink-0 disabled:opacity-50"
          >
            Track
          </button>
          <button onClick={onAddAnother} className="btn-secondary text-sm flex-1 justify-center">
            <IconPlus size={17} /> Add another order
          </button>
          <button
            onClick={() => nav('/settle')}
            disabled={placed.length === 0}
            className="btn-primary flex-1 justify-center disabled:opacity-50"
          >
            <IconGift size={17} /> Settle up <IconArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
