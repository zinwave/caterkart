import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import type { ComponentType, SVGProps } from 'react';
import { useOrders } from '../hooks/useSwiggyData';
import { useSwiggy } from '../state/SwiggyContext';
import { useCelebration } from '../state/CelebrationContext';
import AddressPicker from '../components/AddressPicker';
import type { OrderSummary } from '../lib/mcp/types';
import {
  IconReceipt, IconChef, IconTruck, IconCheck, IconClose, IconUtensils,
  IconStore, IconRefresh, IconMapPin, IconAlertTriangle,
} from '../components/icons/Icons';

type IconType = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

type StatusKind = 'placed' | 'preparing' | 'on-the-way' | 'delivered' | 'cancelled';

const STATUS_STYLE: Record<StatusKind, { icon: IconType; cls: string }> = {
  placed:       { icon: IconReceipt, cls: 'bg-orange-50 text-swiggy-orange border-orange-200' },
  preparing:    { icon: IconChef,    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  'on-the-way': { icon: IconTruck,   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  delivered:    { icon: IconCheck,   cls: 'bg-green-50 text-swiggy-green border-green-200' },
  cancelled:    { icon: IconClose,   cls: 'bg-red-50 text-red-700 border-red-200' },
};

/**
 * Swiggy hands us free-text statuses ("Delivered", "Order picked up", "Cancelled"…),
 * not an enum — so we keyword-match to pick an icon/colour and still render
 * Swiggy's own wording as the label. Order matters: "delivery pending" would
 * otherwise match /deliver/.
 */
export function statusKind(o: Pick<OrderSummary, 'status' | 'deliveryStatus' | 'isActive'>): StatusKind {
  const s = `${o.deliveryStatus ?? ''} ${o.status}`.toLowerCase();
  if (/cancel|refund/.test(s)) return 'cancelled';
  if (/delivered/.test(s)) return 'delivered';
  if (/picked|on the way|out for delivery|transit|arriv/.test(s)) return 'on-the-way';
  if (/prepar|cook|kitchen|confirm/.test(s)) return 'preparing';
  if (/placed|received|pending/.test(s)) return 'placed';
  return o.isActive ? 'placed' : 'delivered';
}

/**
 * `itemsSummary` is Swiggy's only item detail: "Mutton Biryani (1),Chicken Biryani (1)".
 * Dish names can themselves contain commas, so a chunk without a trailing "(n)"
 * is glued back onto the previous one rather than treated as a new item.
 */
export function parseItems(summary: string): Array<{ name: string; qty: number }> {
  const out: Array<{ name: string; qty: number }> = [];
  for (const raw of summary.split(',')) {
    const chunk = raw.trim();
    if (!chunk) continue;
    const m = chunk.match(/^(.*?)\s*\((\d+)\)$/);
    if (m) {
      out.push({ name: m[1].trim(), qty: Number(m[2]) });
    } else if (out.length) {
      out[out.length - 1].name += `, ${chunk}`;
    } else {
      out.push({ name: chunk, qty: 1 });
    }
  }
  return out;
}

export default function Orders() {
  const { connected, addressId, connect } = useSwiggy();
  const { ledger } = useCelebration();
  const { data: orders, loading, error, reload } = useOrders();

  // The current event's placed orders (incl. TEST orders from test mode) that
  // aren't already on the real Swiggy list — so everything tracks in one place.
  const eventOrders = useMemo<OrderSummary[]>(() => {
    const realIds = new Set(orders.map((o) => o.orderId));
    return ledger
      .filter((o) => o.orderId && !realIds.has(o.orderId))
      .map((o) => ({
        orderId: o.orderId as string,
        restaurantName: o.restaurantName,
        total: o.toPay,
        status: 'Order placed',
        itemsSummary: '',
        orderedTime: 'Just now',
        isActive: true,
      }));
  }, [ledger, orders]);

  const merged = useMemo(() => [...eventOrders, ...orders], [eventOrders, orders]);
  const active = merged.filter((o) => o.isActive);
  const past = merged.filter((o) => !o.isActive);

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 pb-12">
      <div className="text-sm text-neutral-500 reveal">Your orders</div>
      <div className="flex items-baseline justify-between gap-3 reveal" style={{ animationDelay: '40ms' }}>
        <h1 className="text-3xl font-black tracking-tight mt-1">
          Order <span className="text-shimmer">history</span>
        </h1>
        <div className="flex items-center gap-2">
          {ledger.length > 0 && (
            <Link to="/event" className="btn-ghost text-sm">
              Event tab
            </Link>
          )}
          <button
            onClick={reload}
            disabled={loading || !addressId}
            className="btn-ghost text-sm disabled:opacity-40"
            aria-label="Refresh orders"
          >
            <IconRefresh size={15} className={loading ? 'animate-spin-slow' : ''} /> Refresh
          </button>
          <Link to="/create" className="btn-primary text-sm">+ New celebration</Link>
        </div>
      </div>

      {merged.length > 0 ? (
        <>
          {active.length > 0 && (
            <section className="mt-7 reveal" style={{ animationDelay: '90ms' }}>
              <h2 className="section-title mb-3">In progress ({active.length})</h2>
              <div className="space-y-3">
                {active.map((o, i) => <OrderCard key={o.orderId} order={o} delay={i * 50} highlight />)}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section className="mt-7 reveal" style={{ animationDelay: '150ms' }}>
              <h2 className="section-title mb-3">Past orders ({past.length})</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {past.map((o, i) => <OrderCard key={o.orderId} order={o} delay={i * 50} />)}
              </div>
            </section>
          )}
        </>
      ) : connected === false ? (
        <Notice
          icon={<IconStore size={30} />}
          title="Connect Swiggy to see your orders"
          body="Your real Swiggy order history — live tracking included — shows up here once your account is linked."
          action={<button onClick={() => void connect()} className="btn-primary inline-flex mt-5">Connect Swiggy</button>}
        />
      ) : !addressId ? (
        <div className="card p-6 mt-8">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-orange-50 text-swiggy-orange grid place-items-center shrink-0">
              <IconMapPin size={18} />
            </span>
            <div>
              <div className="font-bold text-ink-primary">Pick a delivery address</div>
              <div className="text-xs text-ink-tertiary mt-0.5">
                Swiggy scopes orders to an address — choose one to load your history.
              </div>
            </div>
          </div>
          <div className="mt-4">
            <AddressPicker />
          </div>
        </div>
      ) : error ? (
        <Notice
          icon={<IconAlertTriangle size={30} />}
          title="Couldn't load your orders"
          body={error}
          action={<button onClick={reload} className="btn-secondary inline-flex mt-5"><IconRefresh size={15} /> Try again</button>}
        />
      ) : loading && orders.length === 0 ? (
        <div className="mt-8 grid sm:grid-cols-2 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-surface-secondary shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3.5 w-1/2 rounded bg-surface-secondary" />
                  <div className="h-3 w-2/3 rounded bg-surface-secondary" />
                  <div className="h-2.5 w-1/3 rounded bg-surface-secondary" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function Notice({
  icon, title, body, action,
}: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="card p-10 text-center mt-8">
      <div className="w-16 h-16 rounded-2xl bg-surface-secondary grid place-items-center text-ink-tertiary mx-auto mb-3">
        {icon}
      </div>
      <h2 className="font-bold text-lg">{title}</h2>
      <p className="text-sm text-neutral-500 mt-1 max-w-sm mx-auto">{body}</p>
      {action}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-10 text-center mt-8">
      <div className="w-16 h-16 rounded-2xl bg-surface-secondary grid place-items-center text-ink-tertiary mx-auto mb-3">
        <IconUtensils size={32} />
      </div>
      <h2 className="font-bold text-lg">No orders yet</h2>
      <p className="text-sm text-neutral-500 mt-1 max-w-sm mx-auto">
        When you place a celebration order on Swiggy, you'll see it here with live
        tracking all the way to your door.
      </p>
      <Link to="/create" className="btn-primary inline-flex mt-5">Plan a celebration</Link>
    </div>
  );
}

function OrderCard({ order, delay, highlight }: { order: OrderSummary; delay: number; highlight?: boolean }) {
  const kind = statusKind(order);
  const style = STATUS_STYLE[kind];
  const StatusIcon = style.icon;
  const items = parseItems(order.itemsSummary);
  const itemCount = items.reduce((s, it) => s + it.qty, 0);

  return (
    <Link
      to={`/orders/${order.orderId}`}
      className="block card card-hover p-4 reveal active:scale-[0.99] transition relative overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-50 to-rose-50 grid place-items-center text-swiggy-orange shrink-0">
          <IconStore size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-bold truncate">{order.restaurantName}</div>
            <span className={`chip border ${style.cls} text-[11px] font-bold inline-flex items-center gap-1 shrink-0`}>
              <StatusIcon size={12} />{order.status}
            </span>
          </div>
          {order.areaName && (
            <div className="text-xs text-neutral-500 mt-0.5 truncate">{order.areaName}</div>
          )}
          <div className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1.5 flex-wrap">
            {highlight && (
              <span className="inline-flex items-center gap-1 text-swiggy-orange font-bold uppercase tracking-wide">
                <span className="relative inline-flex w-1.5 h-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-swiggy-orange animate-pulse-ring" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-swiggy-orange" />
                </span>
                Live
                <span className="text-neutral-300 font-normal">·</span>
              </span>
            )}
            <span>
              {order.orderedTime}
              {itemCount > 0 && <>{' · '}{itemCount} {itemCount === 1 ? 'item' : 'items'}</>}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wide font-semibold text-neutral-500">Total</div>
          <div className="font-black tabular-nums">₹{order.total}</div>
        </div>
      </div>

      {order.itemsSummary && (
        <div className="mt-3 text-xs text-neutral-600 line-clamp-2">
          {items.map((it) => `${it.name} × ${it.qty}`).join(' · ')}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-dashed border-neutral-200 flex items-center justify-between text-xs">
        <div className="text-neutral-500">
          Order <span className="font-mono text-neutral-700">{order.orderId}</span>
        </div>
        <span className="text-swiggy-orange font-semibold">View details →</span>
      </div>
    </Link>
  );
}
