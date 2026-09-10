import { useEffect, useMemo, useState } from 'react';
import type { ComponentType, SVGProps } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useOrders } from '../hooks/useSwiggyData';
import { useSwiggy } from '../state/SwiggyContext';
import { useCelebration } from '../state/CelebrationContext';
import { api, ApiError } from '../lib/api';
import type { TrackingState, OrderSummary } from '../lib/mcp/types';
import { parseItems, statusKind } from './Orders';
import {
  IconMapPin, IconClock, IconPhone, IconTruck, IconCheck, IconReceipt,
  IconClose, IconHelp, IconArrowRight, IconStore, IconChef, IconSearch, IconRefresh,
} from '../components/icons/Icons';

type IconType = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

/**
 * Swiggy's tracking endpoint asks callers not to poll faster than every 10s.
 * 12s keeps us clear of that floor even if a request is slow to come back.
 */
const POLL_MS = 12_000;

type Stage = 'PLACED' | 'PREPARING' | 'PICKED_UP' | 'DELIVERED';

const STAGES: Stage[] = ['PLACED', 'PREPARING', 'PICKED_UP', 'DELIVERED'];

const STAGE_META: Record<Stage | 'CANCELLED', { label: string; short: string; Icon: IconType; subtitle: string }> = {
  PLACED:    { label: 'Order placed', short: 'Placed',    Icon: IconReceipt, subtitle: 'Restaurant confirmed your order' },
  PREPARING: { label: 'Preparing',    short: 'Cooking',   Icon: IconChef,    subtitle: 'Kitchen is on it' },
  PICKED_UP: { label: 'On the way',   short: 'Pickup',    Icon: IconTruck,   subtitle: 'Rider picked up the food' },
  DELIVERED: { label: 'Delivered',    short: 'Arrived',   Icon: IconCheck,   subtitle: 'Enjoy your celebration!' },
  CANCELLED: { label: 'Cancelled',    short: 'Cancelled', Icon: IconClose,   subtitle: 'This order was cancelled' },
};

/** Where an order sits when we have no live tracking (past orders, or first paint). */
const KIND_TO_STAGE: Record<ReturnType<typeof statusKind>, Stage | 'CANCELLED'> = {
  placed: 'PLACED',
  preparing: 'PREPARING',
  'on-the-way': 'PICKED_UP',
  delivered: 'DELIVERED',
  cancelled: 'CANCELLED',
};

/** Live tracking for an active order. Terminal states stop the loop; so does unmount. */
function useTracking(orderId: string, active: boolean) {
  const [state, setState] = useState<TrackingState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active || !orderId) {
      setState(null);
      return;
    }
    let alive = true;
    let timer: number | undefined;

    // Self-scheduling rather than setInterval: a slow response can never stack
    // requests, and a terminal status simply doesn't schedule the next tick.
    const tick = async () => {
      try {
        const t = await api.swiggy.track(orderId);
        if (!alive) return;
        setState(t);
        setError(null);
        if (t.status === 'DELIVERED' || t.status === 'CANCELLED') return;
      } catch (e) {
        if (!alive) return;
        setError(
          e instanceof ApiError && e.needsSwiggyAuth
            ? 'Your Swiggy session expired — reconnect to keep tracking.'
            : e instanceof Error
              ? e.message
              : 'Tracking is unavailable right now',
        );
      }
      if (alive) timer = window.setTimeout(tick, POLL_MS);
    };

    void tick();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [orderId, active]);

  return { state, error };
}

export default function OrderDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { address } = useSwiggy();
  const { ledger } = useCelebration();
  const { data: orders, loading, error, reload } = useOrders();

  // Test orders (TEST-…) aren't on the real Swiggy account, so fall back to the
  // event tab and synthesize an order so the tracking page still renders.
  const order = useMemo<OrderSummary | undefined>(() => {
    const real = orders.find((o) => o.orderId === id);
    if (real) return real;
    const lo = ledger.find((o) => o.orderId === id);
    if (!lo?.orderId) return undefined;
    return {
      orderId: lo.orderId,
      restaurantName: lo.restaurantName,
      total: lo.toPay,
      status: 'Order placed',
      itemsSummary: '',
      orderedTime: 'Just now',
      isActive: true,
    };
  }, [orders, ledger, id]);
  const { state: tracking, error: trackError } = useTracking(id, order?.isActive ?? false);

  if (loading && !order) {
    return (
      <div className="max-w-5xl mx-auto px-5 py-16 text-center">
        <span className="inline-block w-8 h-8 rounded-full border-2 border-line-default border-t-swiggy-orange animate-spin-slow" />
        <div className="text-sm text-ink-tertiary mt-3">Loading your order…</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-5xl mx-auto px-5 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-secondary grid place-items-center text-ink-tertiary mx-auto mb-3">
          <IconSearch size={28} />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-ink-primary">Order not found</h1>
        <p className="text-sm text-ink-tertiary mt-1.5 max-w-sm mx-auto">
          {error ?? "We couldn't find this order on your Swiggy account for the selected address."}
        </p>
        <div className="flex items-center justify-center gap-2 mt-5">
          <button onClick={reload} className="btn-secondary inline-flex"><IconRefresh size={15} /> Retry</button>
          <Link to="/orders" className="btn-secondary inline-flex">← Back to orders</Link>
        </div>
      </div>
    );
  }

  // Live tracking wins; otherwise fall back to the status Swiggy put on the order.
  const stage: Stage | 'CANCELLED' = tracking ? tracking.status : KIND_TO_STAGE[statusKind(order)];
  const cancelled = stage === 'CANCELLED';
  const delivered = stage === 'DELIVERED';
  const currentStageIdx = cancelled ? -1 : STAGES.indexOf(stage);
  const StageIcon = STAGE_META[stage].Icon;

  const etaMinutes =
    tracking && 'etaMinutes' in tracking ? tracking.etaMinutes : null;
  const rider = tracking?.status === 'PICKED_UP' ? tracking.rider : undefined;
  const deliveredAt = tracking?.status === 'DELIVERED' ? tracking.deliveredAt : null;
  const cancelReason = tracking?.status === 'CANCELLED' ? tracking.reason : null;

  const items = parseItems(order.itemsSummary);
  // Rider progress along the tracking map (fraction 0→1 by stage).
  const routeProgress = cancelled ? 0 : ([0.12, 0.4, 0.72, 1][currentStageIdx] ?? 0.12);

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 pb-12">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => nav('/orders')} className="btn-ghost text-sm -ml-3">← Orders</button>
        <span className="text-[11px] text-ink-tertiary font-mono">{order.orderId}</span>
      </div>

      {/* Header */}
      <div className="reveal mt-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="section-title">Order details</div>
          {order.isActive && !cancelled && !delivered && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white border border-line-subtle text-ink-secondary shadow-card">
              <span className="w-1.5 h-1.5 rounded-full bg-swiggy-orange animate-pulse-soft" /> Live · on Swiggy
            </span>
          )}
        </div>
        <h1 className="mt-2.5 text-3xl sm:text-4xl font-black tracking-tight text-ink-primary flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-50 to-rose-50 grid place-items-center text-swiggy-orange shrink-0">
            <IconStore size={20} />
          </span>
          <span className="min-w-0 truncate">{order.restaurantName}</span>
        </h1>
        <div className="text-[13px] text-ink-tertiary mt-1.5">
          {order.orderedTime}
          {order.areaName && <> · {order.areaName}</>}
        </div>
      </div>

      {/* Status */}
      <section className="card p-5 mt-6 reveal" style={{ animationDelay: '60ms' }}>
        {cancelled ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-red-50 text-swiggy-red grid place-items-center mx-auto">
              <IconClose size={24} />
            </div>
            <div className="font-bold text-ink-primary mt-2">Order cancelled</div>
            {cancelReason && <div className="text-xs text-ink-tertiary mt-1">{cancelReason}</div>}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${delivered ? 'bg-swiggy-green text-white' : 'bg-orange-50 text-swiggy-orange'}`}>
                  <StageIcon size={18} />
                </span>
                <div className="min-w-0">
                  <div className={`font-bold ${delivered ? 'text-swiggy-green' : 'text-ink-primary'}`}>
                    {STAGE_META[stage].label}
                  </div>
                  <div className="text-xs text-ink-tertiary mt-0.5">
                    {delivered && deliveredAt ? `Delivered at ${deliveredAt}` : STAGE_META[stage].subtitle}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                {delivered ? (
                  <span className="chip chip-green"><IconCheck size={12} /> Delivered</span>
                ) : etaMinutes !== null ? (
                  <>
                    <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-ink-tertiary">ETA</div>
                    <div className="font-black text-swiggy-orange tabular-nums">
                      {etaMinutes > 0 ? `${etaMinutes} min` : 'Any moment'}
                    </div>
                  </>
                ) : order.isActive ? (
                  <div className="text-[11px] text-ink-tertiary">Fetching ETA…</div>
                ) : null}
              </div>
            </div>

            {/* Timeline track */}
            <div className="relative mt-6">
              <div className="absolute top-3 left-3 right-3 h-1 bg-surface-tertiary rounded-full" />
              <div
                className={`absolute top-3 left-3 h-1 rounded-full transition-all duration-1000 bg-gradient-to-r ${delivered ? 'from-swiggy-green to-emerald-400' : 'from-swiggy-orange to-cater-coral'}`}
                style={{ width: `${(Math.max(currentStageIdx, 0) / (STAGES.length - 1)) * 100}%`, maxWidth: 'calc(100% - 1.5rem)' }}
              />
              <div className="relative grid grid-cols-4">
                {STAGES.map((s, i) => {
                  const done = i < currentStageIdx || (delivered && i === currentStageIdx);
                  const cur = i === currentStageIdx && !delivered;
                  const NodeIcon = STAGE_META[s].Icon;
                  return (
                    <div key={s} className="flex flex-col items-center gap-1.5 z-10">
                      <div className={`w-7 h-7 rounded-full grid place-items-center transition ${
                        done ? 'bg-swiggy-green text-white'
                          : cur ? 'bg-swiggy-orange text-white ring-4 ring-orange-100'
                          : 'bg-surface-tertiary text-ink-disabled'
                      }`}>
                        {done ? <IconCheck size={13} /> : <NodeIcon size={13} className={cur ? '' : 'opacity-40'} />}
                      </div>
                      <div className={`text-[10px] uppercase tracking-[0.1em] font-bold ${
                        done ? 'text-swiggy-green' : cur ? 'text-swiggy-orange' : 'text-ink-disabled'
                      }`}>
                        {STAGE_META[s].short}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rider — only ever what Swiggy actually gives us on PICKED_UP */}
            {rider && (
              <div className="mt-6 pt-5 border-t border-line-subtle flex items-center gap-3">
                <div className="w-12 h-12 rounded-full grid place-items-center shrink-0 bg-gradient-to-br from-blue-100 to-blue-50 text-swiggy-mart">
                  <IconTruck size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-ink-tertiary">Your rider</div>
                  <div className="font-bold text-sm text-ink-primary leading-tight">{rider.name}</div>
                </div>
                <a href={`tel:${rider.phone}`} className="btn-secondary text-xs"><IconPhone size={14} /> Call</a>
              </div>
            )}

            {trackError && (
              <div className="mt-4 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                {trackError} · retrying every {POLL_MS / 1000}s
              </div>
            )}
          </>
        )}
      </section>

      {/* Two-column: details + rail */}
      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start mt-8">
        {/* Left: delivery + items */}
        <div className="space-y-8 min-w-0">
          <section className="reveal" style={{ animationDelay: '100ms' }}>
            <div className="section-title mb-3">Delivery details</div>
            <div className="card p-4">
              <div className="relative h-40 rounded-xl overflow-hidden mb-4 border border-line-subtle bg-surface-secondary">
                {/* street grid */}
                <div className="absolute inset-0 opacity-60" style={{
                  backgroundImage: 'linear-gradient(0deg, transparent 94%, rgba(10,37,64,0.055) 94%), linear-gradient(90deg, transparent 94%, rgba(10,37,64,0.055) 94%)',
                  backgroundSize: '26px 26px',
                }} />
                {/* soft park / water */}
                <div className="absolute -left-6 -bottom-8 w-32 h-32 rounded-full bg-emerald-100/60 blur-2xl" />
                <div className="absolute right-6 -top-6 w-24 h-24 rounded-full bg-blue-100/60 blur-2xl" />

                {/* route */}
                <svg viewBox="0 0 400 160" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                  <path d="M 48 128 C 150 70, 250 118, 352 40" fill="none" stroke={delivered ? '#1BA672' : '#FF5200'} strokeWidth="3" strokeLinecap="round" opacity="0.22" />
                  <path
                    d="M 48 128 C 150 70, 250 118, 352 40" fill="none"
                    stroke={delivered ? '#1BA672' : '#FF5200'} strokeWidth="3" strokeLinecap="round"
                    pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - routeProgress)}
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                  />
                </svg>

                {/* origin (restaurant) */}
                <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: '12%', top: '80%' }}>
                  <span className="block w-3 h-3 rounded-full bg-white border-2 border-ink-primary" />
                </div>
                {/* destination (home) */}
                <div className="absolute -translate-x-1/2 -translate-y-full text-center" style={{ left: '88%', top: '26%' }}>
                  <IconMapPin size={26} className={`${delivered ? 'text-swiggy-green' : 'text-swiggy-orange'} drop-shadow-md mx-auto`} />
                  {!delivered && <span className="block w-2.5 h-2.5 rounded-full bg-swiggy-orange ring-4 ring-orange-200/60 animate-pulse-soft mx-auto -mt-1" />}
                </div>
                {/* rider position — a read-out of the tracking stage, not a GPS fix */}
                {!cancelled && (
                  <div
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${12 + routeProgress * 76}%`, top: `${80 - routeProgress * 54}%`, transition: 'left 1s ease, top 1s ease' }}
                  >
                    <span className={`grid place-items-center w-8 h-8 rounded-full bg-white shadow-pop ${delivered ? 'text-swiggy-green' : 'text-swiggy-mart'}`}>
                      <IconTruck size={16} />
                    </span>
                  </div>
                )}

                {/* overlay chips */}
                <div className="absolute top-2.5 left-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/90 backdrop-blur border border-line-subtle shadow-card text-ink-secondary">
                    {delivered
                      ? <><IconCheck size={12} className="text-swiggy-green" /> Delivered</>
                      : cancelled
                        ? <><IconClose size={12} className="text-swiggy-red" /> Cancelled</>
                        : <><span className="w-1.5 h-1.5 rounded-full bg-swiggy-orange animate-pulse-soft" /> Live tracking</>}
                  </span>
                </div>
                {!delivered && !cancelled && etaMinutes !== null && (
                  <div className="absolute top-2.5 right-2.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-ink-primary text-white shadow-pop tabular-nums">
                      <IconClock size={12} /> {etaMinutes > 0 ? `${etaMinutes} min` : 'Any moment'}
                    </span>
                  </div>
                )}
              </div>

              <div className="divide-y divide-line-subtle">
                <Row icon={<IconStore size={16} />} label="Restaurant" value={order.restaurantName} />
                {order.areaName && <Row icon={<IconMapPin size={16} />} label="Area" value={order.areaName} />}
                {address && <Row icon={<IconMapPin size={16} />} label="Delivering to" value={`${address.label} — ${address.display}`} />}
                <Row icon={<IconClock size={16} />} label="Ordered" value={order.orderedTime} />
                <Row
                  icon={<IconReceipt size={16} />}
                  label="Status"
                  value={order.deliveryStatus ? `${order.status} · ${order.deliveryStatus}` : order.status}
                />
              </div>
            </div>
          </section>

          <section className="reveal" style={{ animationDelay: '140ms' }}>
            <div className="section-title mb-3">Items ordered</div>
            <div className="card overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-3 border-b border-line-subtle bg-surface-secondary/50">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-50 to-rose-50 grid place-items-center text-swiggy-orange shrink-0">
                  <IconStore size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-ink-primary truncate">{order.restaurantName}</div>
                  {order.areaName && <div className="text-xs text-ink-tertiary truncate">{order.areaName}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] uppercase font-bold text-ink-tertiary tracking-[0.1em]">Total</div>
                  <div className="font-bold text-ink-primary tabular-nums">₹{order.total}</div>
                </div>
              </div>
              {items.length > 0 ? (
                <div className="divide-y divide-line-subtle">
                  {items.map((it, i) => (
                    <div key={`${it.name}-${i}`} className="px-4 py-2.5 flex items-center gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-line-default shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-ink-primary leading-tight truncate">{it.name}</div>
                      </div>
                      <span className="text-xs text-ink-tertiary tabular-nums">× {it.qty}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-5 text-sm text-ink-tertiary">
                  Swiggy didn't return an item breakdown for this order.
                </div>
              )}
            </div>
            <p className="text-[11px] text-ink-tertiary mt-2">
              Swiggy's order history returns item names and quantities only — per-item pricing
              isn't part of the payload.
            </p>
          </section>
        </div>

        {/* Right rail: total + actions */}
        <aside className="space-y-6 lg:sticky lg:top-24 reveal" style={{ animationDelay: '180ms' }}>
          <section>
            <div className="section-title mb-3">Bill summary</div>
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div className="font-bold text-ink-primary">Order total</div>
                <div className="font-black text-xl text-ink-primary tabular-nums">₹{order.total}</div>
              </div>
              <div className="mt-2 text-[11px] text-ink-tertiary">
                The amount Swiggy charged for this order, inclusive of delivery, fees and taxes.
              </div>
              {!order.isActive && (
                <div className="mt-3 text-[11px] text-swiggy-green bg-green-50 border border-green-100 rounded-lg p-2.5 flex items-center gap-1.5">
                  <IconCheck size={13} /> Paid on Swiggy · {order.orderedTime}
                </div>
              )}
            </div>
          </section>

          <section className="grid grid-cols-3 gap-2">
            <ActionCard icon={<IconRefresh size={18} />} title="Refresh" sub="Re-sync" onClick={reload} />
            <ActionCard icon={<IconArrowRight size={18} />} title="Reorder" sub="New date" to="/create" />
            <ActionCard icon={<IconHelp size={18} />} title="Help" sub="Support" />
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="text-ink-tertiary mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-ink-tertiary">{label}</div>
        <div className="text-sm text-ink-primary mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function ActionCard({
  icon, title, sub, to, onClick,
}: { icon: React.ReactNode; title: string; sub: string; to?: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className="w-9 h-9 rounded-xl bg-orange-50 text-swiggy-orange grid place-items-center">{icon}</span>
      <div className="text-[13px] font-bold text-ink-primary mt-2">{title}</div>
      <div className="text-[10px] text-ink-tertiary">{sub}</div>
    </>
  );
  const cls = 'card card-hover p-3 text-left flex flex-col hover:border-orange-200 transition';
  return to ? <Link to={to} className={cls}>{inner}</Link> : <button onClick={onClick} className={cls}>{inner}</button>;
}
