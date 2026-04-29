import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Order, OrderStatus, useOrders } from '../state/OrdersContext';
import { restaurants as ALL_RESTAURANTS } from '../data/mock';
import { MemberAvatar } from '../components/MemberAvatar';

const STAGES: OrderStatus[] = ['placed', 'preparing', 'on-the-way', 'delivered'];

const STAGE_META: Record<OrderStatus, { label: string; emoji: string; subtitle: string }> = {
  placed:       { label: 'Order placed',  emoji: '📝', subtitle: 'Restaurant confirmed your order' },
  preparing:    { label: 'Preparing',     emoji: '👨‍🍳', subtitle: 'Kitchen is on it' },
  'on-the-way': { label: 'On the way',    emoji: '🛵', subtitle: 'Rider picked up the food' },
  delivered:    { label: 'Delivered',     emoji: '✓',  subtitle: 'Enjoy your celebration!' },
  cancelled:    { label: 'Cancelled',     emoji: '×',  subtitle: 'This order was cancelled' },
};

export default function OrderDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { getOrder, updateStatus, markPaid } = useOrders();
  const order = getOrder(id);

  const [showInvoice, setShowInvoice] = useState(false);

  // Auto-advance status for the demo if order is fresh
  useEffect(() => {
    if (!order) return;
    if (order.status === 'delivered' || order.status === 'cancelled') return;
    const idx = STAGES.indexOf(order.status);
    if (idx === -1) return;
    const next = STAGES[idx + 1];
    if (!next) return;
    const t = setTimeout(() => updateStatus(order.id, next), 4500);
    return () => clearTimeout(t);
  }, [order?.id, order?.status]);

  if (!order) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <div className="text-5xl mb-3">🤔</div>
        <h1 className="text-xl font-bold">Order not found</h1>
        <Link to="/orders" className="btn-secondary mt-5 inline-flex">← Back to orders</Link>
      </div>
    );
  }

  const linesByRestaurant = useMemo(() => {
    const map: Record<string, typeof order.lines> = {};
    order.lines.forEach((l) => {
      (map[l.restaurantId] = map[l.restaurantId] || []).push(l);
    });
    return map;
  }, [order.lines]);

  const placedAt = new Date(order.placedAt);
  const expectedAt = new Date(order.expectedAt);
  const elapsedMin = Math.max(0, Math.floor((Date.now() - placedAt.getTime()) / 60000));
  const remainingMin = Math.max(0, Math.floor((expectedAt.getTime() - Date.now()) / 60000));

  const currentStageIdx = STAGES.indexOf(order.status);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-12">
      {/* Top: nav + invoice no */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => nav('/orders')} className="text-sm text-neutral-500 hover:text-neutral-700">← Orders</button>
        <span className="text-[11px] text-neutral-500 font-mono">{order.invoiceNo}</span>
      </div>

      <div className="reveal mt-3">
        <div className="text-sm text-neutral-500">Order details</div>
        <div className="flex items-baseline gap-3 mt-1">
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <span>{order.occasionEmoji}</span>{order.occasionName}
          </h1>
        </div>
        <div className="text-xs text-neutral-500 mt-1">
          Placed on {placedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · {order.members.length} guests
        </div>
      </div>

      {/* Status timeline */}
      <section className="card p-5 mt-5 reveal" style={{ animationDelay: '60ms' }}>
        {order.status === 'cancelled' ? (
          <div className="text-center py-6">
            <div className="text-4xl">❌</div>
            <div className="font-bold mt-2">Order cancelled</div>
            <div className="text-xs text-neutral-500 mt-1">Refund (if any) reflects in 5–7 working days.</div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold flex items-center gap-2">
                  {STAGE_META[order.status].emoji} {STAGE_META[order.status].label}
                </div>
                <div className="text-xs text-neutral-500">{STAGE_META[order.status].subtitle}</div>
              </div>
              <div className="text-right">
                {order.status !== 'delivered' ? (
                  <>
                    <div className="text-[10px] uppercase tracking-wide font-semibold text-neutral-500">ETA</div>
                    <div className="font-bold text-swiggy-orange">{remainingMin > 0 ? `${remainingMin} min` : 'Any moment'}</div>
                  </>
                ) : (
                  <span className="chip chip-green">✓ Delivered</span>
                )}
              </div>
            </div>

            {/* Timeline track */}
            <div className="relative mt-5">
              <div className="absolute top-3 left-2 right-2 h-1 bg-neutral-100 rounded-full" />
              <div
                className="absolute top-3 left-2 h-1 bg-gradient-to-r from-swiggy-orange to-cater-coral rounded-full transition-all duration-1000"
                style={{ width: `${(currentStageIdx / (STAGES.length - 1)) * 100}%`, maxWidth: 'calc(100% - 1rem)' }}
              />
              <div className="relative grid grid-cols-4">
                {STAGES.map((s, i) => {
                  const done = i < currentStageIdx;
                  const cur = i === currentStageIdx;
                  return (
                    <div key={s} className="flex flex-col items-center gap-1 z-10">
                      <div className={`w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold transition ${
                        done
                          ? 'bg-swiggy-green text-white'
                          : cur
                            ? 'bg-swiggy-orange text-white ring-4 ring-orange-100'
                            : 'bg-neutral-200 text-neutral-400'
                      }`}>
                        {done ? '✓' : cur ? STAGE_META[s].emoji : ''}
                      </div>
                      <div className={`text-[10px] uppercase tracking-wide font-semibold ${
                        done ? 'text-swiggy-green' : cur ? 'text-swiggy-orange' : 'text-neutral-400'
                      }`}>
                        {STAGE_META[s].label.replace('Order ', '').split(' ')[0]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rider details */}
            {order.rider && order.status !== 'placed' && (
              <div className="mt-5 pt-5 border-t border-dashed border-neutral-200 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 grid place-items-center text-2xl">🛵</div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{order.rider.name}</div>
                  <div className="text-xs text-neutral-500">{order.rider.vehicle}</div>
                </div>
                <a href={`tel:${order.rider.phone}`} className="btn-secondary text-xs">📞 Call</a>
              </div>
            )}
          </>
        )}
      </section>

      {/* Delivery details */}
      <h2 className="section-title mt-7 mb-3 reveal" style={{ animationDelay: '100ms' }}>Delivery details</h2>
      <section className="card p-4 reveal" style={{ animationDelay: '140ms' }}>
        {/* Map placeholder */}
        <div className="relative h-32 rounded-xl bg-gradient-to-br from-blue-100 via-emerald-100 to-cyan-100 overflow-hidden mb-4">
          <div className="absolute inset-0 opacity-25" style={{
            backgroundImage:
              'linear-gradient(0deg, transparent 95%, rgba(0,0,0,0.2) 95%), linear-gradient(90deg, transparent 95%, rgba(0,0,0,0.2) 95%)',
            backgroundSize: '24px 24px',
          }} />
          {/* Pin */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full">
            <div className="text-3xl drop-shadow-md">📍</div>
            <div className="w-3 h-3 rounded-full bg-swiggy-orange ring-4 ring-orange-200/60 animate-pulse-soft mx-auto -mt-1" />
          </div>
          {/* Path */}
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
            <path d="M 30 90 Q 100 30 200 60 T 360 50" stroke="#FC8019" strokeWidth="2.5" fill="none" strokeDasharray="6 4" />
          </svg>
        </div>

        <Row label="Address" value={order.address} icon="📍" />
        <Row label="Party time" value={`${new Date(order.partyDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} at ${order.partyTime}`} icon="🕗" />
        <Row label="Host" value={order.hostName} icon="👤" />
        <Row label="Contact" value="+91 99xxx xx210" icon="📞" />
      </section>

      {/* Items */}
      <h2 className="section-title mt-7 mb-3 reveal" style={{ animationDelay: '180ms' }}>Items ordered</h2>
      <section className="space-y-3 reveal" style={{ animationDelay: '220ms' }}>
        {Object.keys(linesByRestaurant).map((rid) => {
          const r = ALL_RESTAURANTS.find((x) => x.id === rid)!;
          const lines = linesByRestaurant[rid];
          const sub = lines.reduce((s, l) => s + l.dish.price * l.qty, 0);
          return (
            <div key={rid} className="card overflow-hidden">
              <div className="px-3 py-3 flex items-center gap-3 border-b border-neutral-100">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-50 to-rose-50 grid place-items-center text-2xl">{r.imageEmoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{r.name}</div>
                  <div className="text-xs text-neutral-500">{r.cuisines.join(' · ')}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-semibold text-neutral-500">Subtotal</div>
                  <div className="font-bold tabular-nums">₹{sub}</div>
                </div>
              </div>
              <div className="divide-y divide-neutral-100">
                {lines.map((l, i) => (
                  <div key={i} className="px-3 py-2.5 flex items-center gap-3">
                    <span className={`inline-block w-3 h-3 border-[1.5px] ${l.dish.veg ? 'border-swiggy-green' : 'border-swiggy-red'}`}>
                      <span className={`block w-1 h-1 m-[3px] rounded-full ${l.dish.veg ? 'bg-swiggy-green' : 'bg-swiggy-red'}`} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium leading-tight">{l.dish.name}</div>
                      <div className="text-[11px] text-neutral-500 flex items-center gap-1 mt-0.5">
                        for <MemberAvatar m={l.pickedBy} size={14} /> {l.pickedBy.name.split('(')[0].trim()}
                      </div>
                    </div>
                    <span className="text-xs text-neutral-500 tabular-nums">× {l.qty}</span>
                    <div className="w-16 text-right text-sm font-semibold tabular-nums">₹{l.dish.price * l.qty}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {order.addons.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-3 py-3 flex items-center gap-3 border-b border-neutral-100">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 grid place-items-center text-2xl">🛒</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">Instamart add-ons</div>
                <div className="text-xs text-neutral-500">Arrived 15 min before food</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-semibold text-neutral-500">Subtotal</div>
                <div className="font-bold tabular-nums">₹{order.bill.addons}</div>
              </div>
            </div>
            <div className="divide-y divide-neutral-100">
              {order.addons.map((a) => (
                <div key={a.id} className="px-3 py-2.5 flex items-center gap-3">
                  <span className="text-2xl">{a.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-tight">{a.name}</div>
                    <div className="text-[11px] text-neutral-500">{a.unit}</div>
                  </div>
                  <div className="w-16 text-right text-sm font-semibold tabular-nums">₹{a.price}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Bill */}
      <h2 className="section-title mt-7 mb-3 reveal" style={{ animationDelay: '260ms' }}>Bill summary</h2>
      <section className="card p-4 reveal" style={{ animationDelay: '300ms' }}>
        <BillRow label="Food (across restaurants)" value={order.bill.food} />
        <BillRow label="Instamart add-ons" value={order.bill.addons} faded={order.bill.addons === 0} />
        <BillRow label="Delivery (synced multi-pickup)" value={order.bill.delivery} />
        <BillRow label="Platform fee" value={order.bill.platform} />
        <BillRow label="GST (5%)" value={order.bill.taxes} />
        <div className="mt-2 pt-3 border-t border-neutral-100 flex items-center justify-between">
          <div className="font-bold">Grand total</div>
          <div className="font-black text-xl tabular-nums">₹{order.bill.grand}</div>
        </div>
        <div className="mt-3 text-[11px] text-neutral-500 bg-green-50 border border-green-100 rounded-lg p-2.5">
          ✓ Paid via UPI · settled by host on {placedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </div>
      </section>

      {/* Split */}
      <h2 className="section-title mt-7 mb-3 reveal" style={{ animationDelay: '340ms' }}>Group split</h2>
      <section className="card p-3 reveal" style={{ animationDelay: '380ms' }}>
        <div className="text-xs text-neutral-500 mb-2 px-1">
          {order.splitMode === 'equal' ? 'Split equally' : 'Pay-for-what-you-ordered'} · {order.split.length} people
        </div>
        {order.split.map((s) => {
          const m = order.members.find((x) => x.id === s.memberId);
          if (!m) return null;
          return (
            <div key={s.memberId} className="flex items-center gap-3 py-2 border-b border-neutral-100 last:border-0">
              <MemberAvatar m={m} size={32} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-tight">{m.name}</div>
                <div className="text-[11px] text-neutral-500">
                  {m.isHost ? 'Host · paid full amount on UPI' : s.paid ? 'Settled' : 'UPI link sent'}
                </div>
              </div>
              <div className="font-bold tabular-nums">₹{s.amount}</div>
              {!m.isHost && (
                s.paid ? (
                  <span className="chip chip-green">✓ Paid</span>
                ) : (
                  <button
                    onClick={() => markPaid(order.id, m.id)}
                    className="text-xs px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 hover:bg-emerald-100"
                  >
                    Mark paid
                  </button>
                )
              )}
            </div>
          );
        })}
      </section>

      {/* Actions */}
      <section className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-7 reveal" style={{ animationDelay: '420ms' }}>
        <button
          onClick={() => setShowInvoice(true)}
          className="card card-hover p-3 text-left"
        >
          <div className="text-xl">🧾</div>
          <div className="text-sm font-semibold mt-1">View invoice</div>
          <div className="text-[11px] text-neutral-500">PDF-ready receipt</div>
        </button>
        <Link to="/create" className="card card-hover p-3 text-left">
          <div className="text-xl">🔁</div>
          <div className="text-sm font-semibold mt-1">Reorder</div>
          <div className="text-[11px] text-neutral-500">Same setup, new date</div>
        </Link>
        <button className="card card-hover p-3 text-left">
          <div className="text-xl">💬</div>
          <div className="text-sm font-semibold mt-1">Need help?</div>
          <div className="text-[11px] text-neutral-500">Chat with support</div>
        </button>
      </section>

      {showInvoice && <InvoiceModal order={order} onClose={() => setShowInvoice(false)} />}
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="text-base mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wide font-semibold text-neutral-500">{label}</div>
        <div className="text-sm">{value}</div>
      </div>
    </div>
  );
}

function BillRow({ label, value, faded }: { label: string; value: number; faded?: boolean }) {
  return (
    <div className={`flex justify-between text-sm py-1 ${faded ? 'opacity-50' : ''}`}>
      <span className="text-neutral-700">{label}</span>
      <span className="tabular-nums font-medium">₹{value}</span>
    </div>
  );
}

// =====================================================
// Invoice modal — printable receipt
// =====================================================
function InvoiceModal({ order, onClose }: { order: Order; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/55 grid place-items-end sm:place-items-center p-0 sm:p-6 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-pop max-h-[92vh] overflow-y-auto animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 sticky top-0 bg-white flex items-center gap-3 z-10">
          <div className="flex-1">
            <div className="font-black text-lg">Tax Invoice</div>
            <div className="text-[11px] text-neutral-500 font-mono">{order.invoiceNo}</div>
          </div>
          <button
            onClick={() => window.print()}
            className="btn-secondary text-xs"
          >
            🖨️ Print
          </button>
          <button onClick={onClose} className="text-2xl leading-none w-8 h-8 grid place-items-center rounded-full hover:bg-neutral-100">×</button>
        </div>

        <div className="px-6 py-5 print:px-0">
          {/* Brand */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="font-black text-xl tracking-tight">cater<span className="text-swiggy-orange">kart</span></div>
              <div className="text-[10px] uppercase tracking-widest font-semibold text-neutral-500 mt-0.5">
                Powered by Swiggy
              </div>
              <div className="text-[11px] text-neutral-500 mt-1">
                GSTIN: 29ABCDE1234F1Z5<br />
                Caterkart Inc., Bengaluru — 560038
              </div>
            </div>
            <div className="text-right text-[11px] text-neutral-600">
              <div className="font-semibold">Date</div>
              <div>{new Date(order.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              <div className="mt-1.5 font-semibold">Order ID</div>
              <div className="font-mono">{order.id}</div>
            </div>
          </div>

          {/* Bill to */}
          <div className="border-t border-neutral-200 pt-3 mb-4">
            <div className="text-[10px] uppercase tracking-wide font-semibold text-neutral-500">Bill to</div>
            <div className="font-semibold mt-0.5">{order.hostName}</div>
            <div className="text-xs text-neutral-600">{order.address}</div>
          </div>

          {/* Line items table */}
          <table className="w-full text-xs">
            <thead>
              <tr className="border-y border-neutral-200 text-[10px] uppercase tracking-wide text-neutral-500">
                <th className="text-left py-2">Item</th>
                <th className="text-right py-2 w-12">Qty</th>
                <th className="text-right py-2 w-16">Rate</th>
                <th className="text-right py-2 w-20">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((l, i) => (
                <tr key={i} className="border-b border-neutral-100">
                  <td className="py-2">
                    <div className="font-medium">{l.dish.name}</div>
                    <div className="text-[10px] text-neutral-500">
                      {ALL_RESTAURANTS.find((r) => r.id === l.restaurantId)?.name} · for {l.pickedBy.name.split('(')[0].trim()}
                    </div>
                  </td>
                  <td className="text-right tabular-nums">{l.qty}</td>
                  <td className="text-right tabular-nums">₹{l.dish.price}</td>
                  <td className="text-right tabular-nums">₹{l.dish.price * l.qty}</td>
                </tr>
              ))}
              {order.addons.map((a) => (
                <tr key={a.id} className="border-b border-neutral-100">
                  <td className="py-2">
                    <div className="font-medium">{a.name}</div>
                    <div className="text-[10px] text-neutral-500">Instamart · {a.unit}</div>
                  </td>
                  <td className="text-right tabular-nums">1</td>
                  <td className="text-right tabular-nums">₹{a.price}</td>
                  <td className="text-right tabular-nums">₹{a.price}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-4 ml-auto w-full max-w-[260px] text-xs space-y-1">
            <Total label="Subtotal" value={order.bill.food + order.bill.addons} />
            <Total label="Delivery" value={order.bill.delivery} />
            <Total label="Platform fee" value={order.bill.platform} />
            <Total label="GST (5%)" value={order.bill.taxes} />
            <div className="border-t border-neutral-300 pt-1.5 mt-1.5">
              <Total label="Grand total" value={order.bill.grand} bold />
            </div>
          </div>

          <div className="mt-6 text-center">
            <span className="chip chip-green">✓ Paid via UPI</span>
          </div>

          <div className="mt-5 pt-3 border-t border-neutral-200 text-[10px] text-neutral-500 text-center">
            This is a system-generated invoice. No signature required.<br />
            For queries: support@caterkart.in
          </div>
        </div>
      </div>
    </div>
  );
}

function Total({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-black text-base' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">₹{value}</span>
    </div>
  );
}
