import { Link } from 'react-router-dom';
import { Order, OrderStatus, useOrders } from '../state/OrdersContext';
import { restaurants as ALL_RESTAURANTS } from '../data/mock';

const STATUS_META: Record<OrderStatus, { label: string; emoji: string; cls: string }> = {
  placed:       { label: 'Placed',      emoji: '📝', cls: 'bg-orange-50 text-swiggy-orange border-orange-200' },
  preparing:    { label: 'Preparing',   emoji: '👨‍🍳', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  'on-the-way': { label: 'On the way',  emoji: '🛵', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  delivered:    { label: 'Delivered',   emoji: '✓',  cls: 'bg-green-50 text-swiggy-green border-green-200' },
  cancelled:    { label: 'Cancelled',   emoji: '×',  cls: 'bg-red-50 text-red-700 border-red-200' },
};

export default function Orders() {
  const { orders } = useOrders();

  const active = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
  const past = orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled');

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-12">
      <div className="text-sm text-neutral-500 reveal">Your orders</div>
      <div className="flex items-baseline justify-between gap-3 reveal" style={{ animationDelay: '40ms' }}>
        <h1 className="text-3xl font-black tracking-tight mt-1">
          Order <span className="text-shimmer">history</span>
        </h1>
        <Link to="/create" className="btn-primary text-sm">+ New celebration</Link>
      </div>

      {orders.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {active.length > 0 && (
            <section className="mt-7 reveal" style={{ animationDelay: '90ms' }}>
              <h2 className="section-title mb-3">In progress ({active.length})</h2>
              <div className="space-y-3">
                {active.map((o, i) => <OrderCard key={o.id} order={o} delay={i * 50} highlight />)}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section className="mt-7 reveal" style={{ animationDelay: '150ms' }}>
              <h2 className="section-title mb-3">Past orders ({past.length})</h2>
              <div className="space-y-3">
                {past.map((o, i) => <OrderCard key={o.id} order={o} delay={i * 50} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-10 text-center mt-8">
      <div className="text-6xl mb-3">🍽️</div>
      <h2 className="font-bold text-lg">No orders yet</h2>
      <p className="text-sm text-neutral-500 mt-1 max-w-sm mx-auto">
        When you place a celebration order, you'll see live tracking, the bill,
        and the per-guest UPI split here.
      </p>
      <Link to="/create" className="btn-primary inline-flex mt-5">Plan a celebration</Link>
    </div>
  );
}

function OrderCard({ order, delay, highlight }: { order: Order; delay: number; highlight?: boolean }) {
  const meta = STATUS_META[order.status];
  const restaurantNames = Array.from(new Set(order.lines.map((l) => l.restaurantId)))
    .map((id) => ALL_RESTAURANTS.find((r) => r.id === id)?.name)
    .filter(Boolean) as string[];
  const itemCount = order.lines.reduce((s, l) => s + l.qty, 0);
  const placed = new Date(order.placedAt);

  return (
    <Link
      to={`/orders/${order.id}`}
      className="block card card-hover p-4 reveal active:scale-[0.99] transition relative overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      {highlight && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-swiggy-orange">
          <span className="relative inline-flex w-1.5 h-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-swiggy-orange animate-pulse-ring" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-swiggy-orange" />
          </span>
          Live
        </span>
      )}

      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-50 to-rose-50 grid place-items-center text-2xl shrink-0">
          {order.occasionEmoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-bold truncate">{order.occasionName}</div>
            <span className={`chip border ${meta.cls} text-[11px] font-bold`}>
              <span className="mr-0.5">{meta.emoji}</span>{meta.label}
            </span>
          </div>
          <div className="text-xs text-neutral-500 mt-0.5 truncate">
            {restaurantNames.slice(0, 3).join(' · ')}
            {restaurantNames.length > 3 && ` +${restaurantNames.length - 3} more`}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            {placed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            {' · '}{itemCount} items
            {' · '}{order.members.length} guests
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wide font-semibold text-neutral-500">Total</div>
          <div className="font-black tabular-nums">₹{order.bill.grand}</div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-dashed border-neutral-200 flex items-center justify-between text-xs">
        <div className="text-neutral-500">
          Invoice <span className="font-mono text-neutral-700">{order.invoiceNo}</span>
        </div>
        <span className="text-swiggy-orange font-semibold">View details →</span>
      </div>
    </Link>
  );
}
