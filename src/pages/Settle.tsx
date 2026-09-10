import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useCelebration } from '../state/CelebrationContext';
import { MemberAvatar } from '../components/MemberAvatar';
import { computeSettlement, upiLink, type SplitMode } from '../lib/settle';
import {
  IconArrowRight, IconCheck, IconLink, IconReceipt, IconStore, IconBolt,
  IconWallet, IconQr, IconUsers, LogoMark,
  SwiggyMark,
} from '../components/icons/Icons';

const firstName = (n: string) => n.trim().split(/\s+/)[0] || n;
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/**
 * Settle up — Splitwise for the celebration.
 *
 * Shows the bill (Swiggy orders + Instamart), lets the host split it evenly or
 * by what each person ordered, log WHO fronted the money (multiple payers), then
 * squares everyone up with the fewest UPI transfers.
 */
export default function Settle() {
  const nav = useNavigate();
  const { eventTitle, members, spendByMember, ledger, resetEvent } = useCelebration();

  const host = members.find((m) => m.isHost) ?? members[0];
  const foodOrders = ledger.filter((o) => o.orderId && o.kind === 'food');
  const martOrders = ledger.filter((o) => o.orderId && o.kind === 'instamart');
  const foodTotal = foodOrders.reduce((s, o) => s + o.toPay, 0);
  const instamartTotal = martOrders.reduce((s, o) => s + o.toPay, 0);
  const total = foodTotal + instamartTotal;

  const [mode, setMode] = useState<SplitMode>('equal');
  const [paidBy, setPaidBy] = useState<Record<string, number>>(() => ({ [host?.id ?? '']: total }));
  const [vpaBy, setVpaBy] = useState<Record<string, string>>({});
  const [paidSet, setPaidSet] = useState<Set<string>>(new Set());
  const [openQr, setOpenQr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const result = useMemo(
    () =>
      computeSettlement({
        members: members.map((m) => ({ id: m.id, name: m.name, isHost: m.isHost })),
        foodTotal,
        instamartTotal,
        foodItemsByMember: spendByMember,
        mode,
        paidByMember: paidBy,
      }),
    [members, foodTotal, instamartTotal, spendByMember, mode, paidBy],
  );

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? 'Someone';
  const vpaFor = (id: string) =>
    vpaBy[id] ?? (id === host?.id ? 'host@upi' : `${firstName(nameOf(id)).toLowerCase()}@upi`);

  // Group transfers by who receives the money (the creditor).
  const byCreditor = useMemo(() => {
    const map = new Map<string, { total: number; items: { from: string; amount: number }[] }>();
    for (const t of result.transfers) {
      const g = map.get(t.to) ?? { total: 0, items: [] };
      g.total += t.amount;
      g.items.push({ from: t.from, amount: t.amount });
      map.set(t.to, g);
    }
    return [...map.entries()];
  }, [result.transfers]);

  const owedTotal = result.transfers.reduce((s, t) => s + t.amount, 0);
  const settledTotal = result.transfers
    .filter((t) => paidSet.has(`${t.from}->${t.to}`))
    .reduce((s, t) => s + t.amount, 0);

  const setPaid = (id: string, v: string) =>
    setPaidBy((p) => ({ ...p, [id]: Math.max(0, Math.round(Number(v) || 0)) }));
  const toggleTransfer = (key: string) =>
    setPaidSet((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  if (ledger.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-orange-50 text-swiggy-orange grid place-items-center mx-auto">
          <IconReceipt size={26} />
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-tight text-ink-primary">Nothing to settle</h1>
        <p className="mt-2 text-sm text-ink-secondary">Place an order first, then split it here.</p>
        <button onClick={() => nav('/event')} className="btn-primary mt-6">
          Back to event <IconArrowRight size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-8 pb-40">
      <button
        onClick={() => nav('/event')}
        className="text-[13px] font-semibold text-ink-tertiary hover:text-swiggy-orange transition"
      >
        ← Back to event
      </button>

      <header className="mt-3">
        <div className="section-title">Settle up</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-ink-primary leading-[1.1]">
          Split the <span className="text-swiggy-orange">bill</span>
        </h1>
        <p className="mt-2 text-[14px] text-ink-secondary leading-relaxed">
          Split it fairly, note who fronted the cash, and everyone squares up in the fewest taps.
        </p>
      </header>

      {/* ── The bill ── */}
      <div className="card p-4 mt-5">
        <div className="text-[11px] uppercase tracking-[0.1em] font-bold text-ink-tertiary">The bill</div>
        <div className="mt-3 space-y-2.5">
          <BillRow
            icon={<IconStore size={16} className="text-swiggy-orange" />}
            label="Swiggy orders"
            sub={`${foodOrders.length} order${foodOrders.length === 1 ? '' : 's'}`}
            value={foodTotal}
          />
          {instamartTotal > 0 && (
            <BillRow
              icon={<IconBolt size={16} className="text-swiggy-mart" />}
              label="Instamart supplies"
              sub="shared"
              value={instamartTotal}
            />
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-line-subtle flex items-center justify-between">
          <span className="font-black text-ink-primary">Total</span>
          <span className="font-black text-xl tabular-nums text-ink-primary">{inr(total)}</span>
        </div>
      </div>

      {/* ── Split mode ── */}
      <div className="card p-4 mt-4">
        <div className="text-[11px] uppercase tracking-[0.1em] font-bold text-ink-tertiary mb-2">
          How to split
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { v: 'equal', label: 'Split equally', sub: `${inr(total / Math.max(members.length, 1))} each` },
              { v: 'by-item', label: 'By what they ordered', sub: 'Items + shared fees' },
            ] as { v: SplitMode; label: string; sub: string }[]
          ).map((o) => {
            const on = mode === o.v;
            return (
              <button
                key={o.v}
                onClick={() => setMode(o.v)}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  on ? 'border-swiggy-orange bg-orange-50' : 'border-line-default bg-white hover:border-orange-200'
                }`}
              >
                <div className={`text-sm font-bold ${on ? 'text-swiggy-orange' : 'text-ink-primary'}`}>
                  {o.label}
                </div>
                <div className="text-[11px] text-ink-tertiary mt-0.5">{o.sub}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Who paid ── */}
      <div className="card p-4 mt-4">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.1em] font-bold text-ink-tertiary">
            Who paid?
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPaidBy({ [host?.id ?? '']: total })}
              className="text-[11px] font-bold text-swiggy-orange hover:underline"
            >
              Host paid all
            </button>
            <span className="text-line-default text-[11px]">·</span>
            <button
              onClick={() => setPaidBy({ ...result.owed })}
              className="text-[11px] font-bold text-ink-tertiary hover:text-ink-secondary"
            >
              Each paid own
            </button>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3">
              <MemberAvatar m={m} size={34} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink-primary truncate flex items-center gap-1.5">
                  {firstName(m.name)}
                  {m.isHost && <span className="chip chip-orange text-[10px]">Host</span>}
                </div>
                <div className="text-[11px] text-ink-tertiary">share {inr(result.owed[m.id] ?? 0)}</div>
              </div>
              <div className="relative shrink-0">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-tertiary text-sm">₹</span>
                <input
                  inputMode="numeric"
                  value={paidBy[m.id] ?? 0}
                  onChange={(e) => setPaid(m.id, e.target.value)}
                  className="w-24 rounded-lg border border-line-default pl-6 pr-2 py-1.5 text-sm text-right tabular-nums outline-none focus:border-swiggy-orange focus:ring-2 focus:ring-orange-100"
                />
              </div>
            </div>
          ))}
        </div>

        <div
          className={`mt-3 rounded-lg px-3 py-2 text-[12px] font-semibold flex items-center gap-1.5 ${
            result.balanced ? 'bg-green-50 text-swiggy-green' : 'bg-amber-50 text-amber-800'
          }`}
        >
          <IconWallet size={14} />
          {result.balanced ? (
            <>Paid {inr(result.paidSum)} — matches the total.</>
          ) : (
            <>
              Logged {inr(result.paidSum)} of {inr(total)} — adjust who paid so it adds up.
            </>
          )}
        </div>
      </div>

      {/* ── Settle up ── */}
      <div className="mt-5">
        <div className="section-title mb-3">Who owes whom</div>

        {result.transfers.length === 0 ? (
          <div className="card p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-green-50 text-swiggy-green grid place-items-center mx-auto">
              <IconCheck size={24} />
            </div>
            <div className="font-black text-ink-primary mt-2.5">
              {result.balanced ? 'All square!' : 'No transfers yet'}
            </div>
            <p className="text-[13px] text-ink-secondary mt-1">
              {result.balanced
                ? 'Everyone has paid their share — nothing to collect.'
                : 'Log who paid above to work out who owes whom.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {byCreditor.map(([creditorId, g]) => (
              <div key={creditorId} className="card overflow-hidden">
                {/* Creditor header + their UPI ID */}
                <div className="px-4 py-3 bg-surface-secondary/60 border-b border-line-subtle">
                  <div className="flex items-center gap-2.5">
                    <MemberAvatar m={members.find((m) => m.id === creditorId)!} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-ink-primary truncate">
                        {firstName(nameOf(creditorId))} gets back
                      </div>
                      <div className="text-[11px] text-swiggy-green font-semibold">{inr(g.total)}</div>
                    </div>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-[11px] text-ink-tertiary">
                    <span className="font-semibold shrink-0">Their UPI ID</span>
                    <input
                      value={vpaFor(creditorId)}
                      onChange={(e) => setVpaBy((v) => ({ ...v, [creditorId]: e.target.value }))}
                      className="flex-1 rounded-lg border border-line-default px-2.5 py-1.5 text-[12px] outline-none focus:border-swiggy-orange focus:ring-2 focus:ring-orange-100"
                    />
                  </label>
                </div>

                {/* Each person who owes this creditor */}
                <div className="divide-y divide-line-subtle">
                  {g.items.map(({ from, amount }) => {
                    const key = `${from}->${creditorId}`;
                    const isPaid = paidSet.has(key);
                    const link = upiLink(
                      vpaFor(creditorId),
                      firstName(nameOf(creditorId)),
                      amount,
                      `${eventTitle} · ${firstName(nameOf(from))}`,
                    );
                    const vpaValid = /.+@.+/.test(vpaFor(creditorId).trim());
                    const showQr = openQr === key;
                    return (
                      <div key={key} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <MemberAvatar m={members.find((m) => m.id === from)!} size={30} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-ink-primary truncate">
                              {firstName(nameOf(from))}
                            </div>
                            <div className="text-[11px] text-ink-tertiary">
                              owes {firstName(nameOf(creditorId))}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-black tabular-nums text-ink-primary">{inr(amount)}</div>
                            <button
                              onClick={() => toggleTransfer(key)}
                              className={`mt-0.5 text-[11px] font-bold inline-flex items-center gap-1 ${
                                isPaid ? 'text-swiggy-green' : 'text-ink-tertiary hover:text-swiggy-green'
                              }`}
                            >
                              {isPaid ? (
                                <IconCheck size={12} />
                              ) : (
                                <span className="w-2.5 h-2.5 rounded-full border border-line-default inline-block" />
                              )}
                              {isPaid ? 'Settled' : 'Mark settled'}
                            </button>
                          </div>
                        </div>

                        {!isPaid && vpaValid && (
                          <div className="mt-2.5 flex items-center gap-2">
                            <a href={link} className="btn-primary flex-1 justify-center py-2 text-[13px]">
                              Request on UPI
                            </a>
                            <CopyBtn value={link} />
                            <button
                              onClick={() => setOpenQr(showQr ? null : key)}
                              className="w-9 h-9 rounded-lg border border-line-default grid place-items-center text-ink-secondary hover:border-orange-200 shrink-0"
                              aria-label="Show QR"
                            >
                              <IconQr size={16} />
                            </button>
                          </div>
                        )}
                        {showQr && vpaValid && (
                          <div className="mt-3 grid place-items-center">
                            <div className="p-2.5 bg-white rounded-2xl border border-line-subtle">
                              <QRCodeSVG value={link} size={150} />
                            </div>
                            <p className="text-[11px] text-ink-tertiary mt-1.5">
                              {firstName(nameOf(from))} scans to pay {inr(amount)}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky progress */}
      <div className="fixed inset-x-0 bottom-0 sticky-blur border-t border-line-default z-20">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-ink-tertiary inline-flex items-center gap-1.5">
              <IconUsers size={12} /> Settled {inr(settledTotal)} of {inr(owedTotal)}
            </div>
            <div className="h-1.5 rounded-full bg-surface-tertiary mt-1 overflow-hidden">
              <div
                className="h-full bg-swiggy-green transition-all"
                style={{ width: `${owedTotal > 0 ? Math.min(100, (settledTotal / owedTotal) * 100) : 100}%` }}
              />
            </div>
          </div>
          <button onClick={() => setDone(true)} className="btn-primary shrink-0">
            {owedTotal > 0 && settledTotal >= owedTotal ? '🎉 Finish' : 'Done'}
          </button>
        </div>
      </div>

      {done && (
        <ClosingScreen
          eventTitle={eventTitle}
          total={total}
          people={members.length}
          orders={foodOrders.length + martOrders.length}
          allSettled={owedTotal === 0 || settledTotal >= owedTotal}
          onNew={() => {
            resetEvent();
            nav('/create');
          }}
          onEvent={() => nav('/event')}
        />
      )}
    </div>
  );
}

const CONFETTI = [
  { emoji: '🎉', left: '8%', top: '14%', delay: '0s' },
  { emoji: '✨', left: '24%', top: '32%', delay: '0.2s' },
  { emoji: '🎊', left: '76%', top: '18%', delay: '0.35s' },
  { emoji: '🥳', left: '88%', top: '40%', delay: '0.5s' },
  { emoji: '💸', left: '14%', top: '62%', delay: '0.15s' },
  { emoji: '⭐', left: '70%', top: '60%', delay: '0.45s' },
  { emoji: '🎈', left: '46%', top: '20%', delay: '0.3s' },
  { emoji: '🙌', left: '56%', top: '70%', delay: '0.6s' },
  { emoji: '🍽️', left: '34%', top: '78%', delay: '0.55s' },
  { emoji: '⚡', left: '84%', top: '74%', delay: '0.25s' },
];

function ClosingScreen({
  eventTitle,
  total,
  people,
  orders,
  allSettled,
  onNew,
  onEvent,
}: {
  eventTitle: string;
  total: number;
  people: number;
  orders: number;
  allSettled: boolean;
  onNew: () => void;
  onEvent: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] overflow-hidden bg-mesh-warm bg-[length:200%_200%] animate-gradient-shift grid place-items-center animate-fade-in">
      {/* soft glow */}
      <div className="absolute -top-24 -right-16 w-96 h-96 rounded-full bg-white/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 -left-16 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      {/* confetti */}
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{ left: c.left, top: c.top, animationDelay: c.delay }}
        >
          {c.emoji}
        </span>
      ))}

      <div className="relative text-center px-6 max-w-sm text-white animate-fade-in-up">
        <div className="w-24 h-24 mx-auto rounded-full bg-white grid place-items-center text-swiggy-green shadow-glow animate-float relative">
          <span className="absolute inset-0 rounded-full bg-white/30 animate-pulse-ring" />
          <IconCheck size={52} className="relative" />
        </div>

        <h1 className="mt-6 text-[2.5rem] font-black tracking-tight leading-[1.02]">
          {allSettled ? 'All settled up!' : "You're all set!"}
        </h1>
        <p className="mt-2.5 text-[15px] text-white/90 leading-relaxed">
          Everyone's squared away for <b className="text-white">{eventTitle}</b>. Hope it was a good one 🎉
        </p>

        <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
          <span className="chip bg-white/15 backdrop-blur text-white border border-white/25 font-bold">
            {inr(total)} total
          </span>
          <span className="chip bg-white/15 backdrop-blur text-white border border-white/25 font-bold">
            {people} {people === 1 ? 'person' : 'people'}
          </span>
          <span className="chip bg-white/15 backdrop-blur text-white border border-white/25 font-bold">
            {orders} order{orders === 1 ? '' : 's'}
          </span>
        </div>

        <div className="mt-9">
          <div className="text-[14px] font-semibold text-white/90">Thanks for using</div>
          <div className="mt-2 inline-flex items-center gap-2">
            <LogoMark size={30} />
            <span className="text-2xl font-black tracking-tight">CaterKart</span>
          </div>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70 mt-1.5">
            powered by <SwiggyMark size={12} className="inline-block align-middle" />
          </div>
        </div>

        <div className="mt-9 flex flex-col gap-2.5">
          <button
            onClick={onNew}
            className="bg-white text-swiggy-orange font-black rounded-xl py-3.5 shadow-pop active:scale-[0.98] transition inline-flex items-center justify-center gap-2"
          >
            Plan another celebration <IconArrowRight size={18} />
          </button>
          <button
            onClick={onEvent}
            className="text-white/85 font-semibold text-sm py-1.5 hover:text-white transition"
          >
            Back to the event
          </button>
        </div>
      </div>
    </div>
  );
}

function BillRow({
  icon,
  label,
  sub,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 h-8 rounded-lg bg-surface-secondary grid place-items-center shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink-primary">{label}</div>
        <div className="text-[11px] text-ink-tertiary">{sub}</div>
      </div>
      <div className="font-bold tabular-nums text-ink-primary shrink-0">{inr(value)}</div>
    </div>
  );
}

function CopyBtn({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className={`w-9 h-9 rounded-lg border grid place-items-center shrink-0 transition ${
        done ? 'border-green-200 text-swiggy-green bg-green-50' : 'border-line-default text-ink-secondary hover:border-orange-200'
      }`}
      aria-label="Copy link"
    >
      {done ? <IconCheck size={16} /> : <IconLink size={16} />}
    </button>
  );
}
