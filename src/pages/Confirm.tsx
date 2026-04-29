import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Timeline from '../components/Timeline';
import BillSplit from '../components/BillSplit';
import { useCelebration } from '../state/CelebrationContext';
import { useOrders } from '../state/OrdersContext';

export default function Confirm() {
  const nav = useNavigate();
  const {
    occasion, time, date, address,
    restaurantsInCart, addonSelections,
    foodTotal, addonTotal, carts, members, host, groupSize,
  } = useCelebration();
  const { addOrder } = useOrders();
  const [placed, setPlaced] = useState(false);

  const delivery = 49;
  const platform = 6;
  const taxes = Math.round((foodTotal + addonTotal) * 0.05);
  const grandTotal = foodTotal + addonTotal + delivery + platform + taxes;

  function placeOrder() {
    setPlaced(true);
    const equalShare = Math.round(grandTotal / Math.max(members.length, 1));
    const expected = new Date(Date.now() + 35 * 60_000).toISOString();
    const order = addOrder({
      occasionName: occasion?.name ?? 'Celebration',
      occasionEmoji: occasion?.emoji ?? '🎉',
      partyDate: date,
      partyTime: time,
      address,
      hostName: host.name,
      hostInitial: host.initials,
      hostColor: host.color,
      members,
      lines: carts,
      addons: addonSelections,
      bill: {
        food: foodTotal, addons: addonTotal, delivery, platform, taxes, grand: grandTotal,
      },
      splitMode: 'equal',
      split: members.map((m) => ({
        memberId: m.id,
        amount: equalShare,
        paid: m.isHost === true,
      })),
      expectedAt: expected,
      rider: { name: 'Karthik R.', phone: '+91 99887 12345', vehicle: 'Honda Activa · KA-05-MX-2114' },
    });
    setTimeout(() => nav(`/orders/${order.id}`), 2400);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-28">
      <div className="text-sm text-neutral-500 reveal">Final step</div>
      <h1 className="text-3xl font-black mt-1 tracking-tight reveal" style={{ animationDelay: '40ms' }}>
        Review &amp; place <span className="text-shimmer">celebration order</span>
      </h1>

      {/* Summary card */}
      <div className="card p-4 mt-5 reveal" style={{ animationDelay: '80ms' }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-50 to-rose-50 grid place-items-center text-3xl">
            {occasion?.emoji || '🎉'}
          </div>
          <div className="flex-1">
            <div className="font-bold">{occasion?.name || 'Celebration'}</div>
            <div className="text-xs text-neutral-500">
              {groupSize} guests · {time} · {address}
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <Stat label="Restaurants" value={restaurantsInCart.length} />
          <Stat label="Items" value={carts.reduce((s, l) => s + l.qty, 0)} />
          <Stat label="Add-ons" value={addonSelections.length} />
        </div>
      </div>

      {/* Timeline */}
      <h2 className="section-title mt-7 mb-3 reveal" style={{ animationDelay: '120ms' }}>
        Synced delivery
      </h2>
      <Timeline
        restaurants={restaurantsInCart}
        hasInstamart={addonSelections.length > 0}
        partyTime={time}
      />

      {/* Bill */}
      <h2 className="section-title mt-7 mb-3 reveal" style={{ animationDelay: '160ms' }}>
        Bill &amp; split
      </h2>
      <div className="reveal" style={{ animationDelay: '200ms' }}>
        <BillSplit />
      </div>

      {/* Members status */}
      <h2 className="section-title mt-7 mb-3 reveal" style={{ animationDelay: '240ms' }}>
        Group readiness
      </h2>
      <div className="card p-3 reveal" style={{ animationDelay: '280ms' }}>
        {members.map((m) => {
          const status = m.isHost ? 'ready' : (m.status ?? 'invited');
          const sm: Record<string, { label: string; cls: string }> = {
            invited: { label: '✉️ Invite sent', cls: 'text-neutral-400' },
            joined:  { label: '👋 Opened',     cls: 'text-blue-600' },
            picking: { label: '⏳ Picking…',   cls: 'text-amber-600' },
            ready:   { label: '✓ Ready',       cls: 'text-swiggy-green' },
          };
          return (
            <div key={m.id} className="flex items-center gap-3 py-1.5">
              <div className={`${m.color} w-7 h-7 rounded-full grid place-items-center text-white text-xs font-bold ring-2 ring-white shadow-sm`}>
                {m.initials}
              </div>
              <div className="flex-1 text-sm flex items-center gap-1.5 min-w-0">
                <span className="truncate">{m.name}</span>
                {m.isHost && <span className="chip chip-orange">Host</span>}
                {m.isKid && <span className="text-xs">🧒</span>}
              </div>
              <span className={`text-xs font-semibold ${sm[status].cls}`}>
                {sm[status].label}
              </span>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="fixed inset-x-0 bottom-0 sticky-blur border-t border-neutral-200 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/addons" className="btn-ghost">← Back</Link>
          <button
            onClick={placeOrder}
            disabled={placed || carts.length === 0}
            className="btn-primary flex-1 disabled:opacity-50 disabled:saturate-50"
          >
            <span>🎉</span>
            <span>Place celebration order</span>
            <span className="opacity-90">· ₹{grandTotal}</span>
          </button>
        </div>
      </div>

      {/* Success overlay with confetti */}
      {placed && (
        <div className="fixed inset-0 bg-black/55 z-50 grid place-items-center px-6 animate-fade-in">
          <div className="relative bg-white rounded-3xl p-8 max-w-sm text-center shadow-pop animate-pop overflow-hidden">
            {/* confetti */}
            {confettiPieces.map((c, i) => (
              <span
                key={i}
                className="confetti-piece"
                style={{ left: c.left, top: c.top, animationDelay: c.delay }}
              >
                {c.emoji}
              </span>
            ))}
            <div className="relative">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-swiggy-orange to-cater-coral grid place-items-center text-4xl shadow-glow animate-float">
                🎉
              </div>
              <h2 className="font-black text-2xl mt-4 tracking-tight">Celebration is on its way!</h2>
              <p className="text-sm text-neutral-600 mt-2 leading-relaxed">
                Instamart drops in <b>~10 min</b>. Food converging by <b>{time}</b>.<br />
                UPI links sent to <b>{groupSize - 1} guests</b>.
              </p>
              <div className="mt-5 chip chip-orange">cater<span className="text-swiggy-orange ml-px">kart</span> · powered by Swiggy</div>
              <div className="mt-3 text-[11px] text-neutral-400">Opening live tracking…</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-gradient-to-br from-neutral-50 to-orange-50/40 rounded-xl py-3 text-center border border-neutral-100">
      <div className="text-xl font-black tracking-tight">{value}</div>
      <div className="text-[10px] text-neutral-500 uppercase tracking-[0.12em] font-semibold mt-0.5">{label}</div>
    </div>
  );
}

const confettiPieces = [
  { emoji: '🎉', left: '10%', top: '60%', delay: '0s' },
  { emoji: '✨', left: '30%', top: '70%', delay: '0.15s' },
  { emoji: '🎊', left: '60%', top: '65%', delay: '0.3s' },
  { emoji: '🥳', left: '80%', top: '70%', delay: '0.45s' },
  { emoji: '🍕', left: '20%', top: '75%', delay: '0.6s' },
  { emoji: '🥤', left: '70%', top: '78%', delay: '0.75s' },
  { emoji: '⭐', left: '45%', top: '72%', delay: '0.2s' },
  { emoji: '🎈', left: '55%', top: '80%', delay: '0.5s' },
];
