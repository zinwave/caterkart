import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import WorkShell, { BudgetBar, StatusPill } from '../components/WorkShell';
import DishPicker from '../components/DishPicker';
import RealOrderWarning from '../components/RealOrderWarning';
import { useCorporate, type OrderLine } from '../state/CorporateContext';
import { inr, shortDate } from '../lib/format';
import {
  IconUsers, IconStore, IconArrowRight, IconCheck, IconShield, IconReceipt, IconChevronDown,
} from '../components/icons/Icons';

export default function GroupOrderManage() {
  const { id } = useParams();
  const nav = useNavigate();
  const {
    getGroupOrder, currentUser, isAdmin, spentForTeam,
    setParticipantLines, placeGroupOrder, cancelGroupOrder,
    costCenterById, employeesByTeam, employeeById,
  } = useCorporate();

  const go = id ? getGroupOrder(id) : undefined;
  const [copied, setCopied] = useState(false);
  const [myPicksOpen, setMyPicksOpen] = useState(false);
  // Declared before the early return below — hooks must not run conditionally.
  const [confirmingPlace, setConfirmingPlace] = useState(false);
  const [placing, setPlacing] = useState(false);

  if (!go) {
    return (
      <WorkShell>
        <NotFound />
      </WorkShell>
    );
  }

  const team = costCenterById(go.costCenterId)!;
  const roster = employeesByTeam(go.costCenterId);
  const organizer = employeeById(go.organizerId);
  const canManage = currentUser.id === go.organizerId || isAdmin;
  const isPlaced = go.status === 'placed';

  const shareUrl = `${window.location.origin}/work/join/${go.token}`;

  // ── Roll-up ──
  const allLines = useMemo(() => go.participants.flatMap((p) => p.lines), [go.participants]);
  const spentByMember = useMemo(() => {
    const m: Record<string, number> = {};
    go.participants.forEach((p) => { m[p.employeeId] = p.lines.reduce((s, l) => s + l.price * l.qty, 0); });
    return m;
  }, [go.participants]);

  const food = allLines.reduce((s, l) => s + l.price * l.qty, 0);
  const restaurantCount = new Set(allLines.map((l) => l.restaurantId)).size;
  const fees = restaurantCount * 35 + (allLines.length ? 6 : 0);
  const tax = Math.round(food * 0.05);
  const grand = food + fees + tax;

  const alreadySpent = spentForTeam(go.costCenterId);
  const projected = alreadySpent + grand;
  const overBudget = projected > team.budgetRup;
  const capViolators = go.participants.filter((p) => (spentByMember[p.employeeId] ?? 0) > team.perHeadCapRup);
  const contributing = go.participants.filter((p) => p.lines.length > 0);
  const needsApproval = team.requireApprovalAboveRup != null && grand > team.requireApprovalAboveRup;
  const canPlace = !isPlaced && contributing.length > 0 && !overBudget && capViolators.length === 0;

  const submittedCount = go.participants.filter((p) => p.status === 'submitted').length;

  function copy() {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }
  /**
   * Placing sends this straight to Swiggy: the backend splits the lines by
   * restaurant (and by the ₹1000 cap) and places one REAL, paid order per
   * sub-cart. No sandbox, not idempotent — so it goes through RealOrderWarning
   * first, never on a bare click.
   */
  async function place() {
    if (!canPlace || placing) return;
    setPlacing(true);
    const inv = await placeGroupOrder(go!.id);
    setPlacing(false);
    setConfirmingPlace(false);
    if (inv) nav(`/work/invoices/${inv.id}`);
  }

  /** One row per real Swiggy order the backend will place: grouped by restaurant. */
  const orderPreview = useMemo(() => {
    const byRestaurant = new Map<string, { name: string; amount: number; items: number }>();
    for (const l of allLines) {
      const cur = byRestaurant.get(l.restaurantId) ?? { name: l.restaurantName, amount: 0, items: 0 };
      cur.amount += l.price * l.qty;
      cur.items += l.qty;
      byRestaurant.set(l.restaurantId, cur);
    }
    return [...byRestaurant.entries()].map(([id, v]) => ({
      id,
      label: v.name,
      sublabel: `${v.items} item${v.items === 1 ? '' : 's'}`,
      amount: v.amount,
    }));
  }, [allLines]);

  const myLines = go.participants.find((p) => p.employeeId === currentUser.id)?.lines ?? [];
  const iAmOnTeam = roster.some((e) => e.id === currentUser.id) || currentUser.id === go.organizerId;

  return (
    <WorkShell>
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1.5 text-xs text-ink-tertiary">
          <Link to="/work" className="font-semibold hover:text-swiggy-orange">Overview</Link>
          <span>/</span><span className="font-bold text-ink-secondary">{go.title}</span>
        </div>
        {isAdmin && currentUser.id !== go.organizerId && (
          <span className="chip chip-navy text-[10px]"><IconShield size={11} /> Admin oversight</span>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ══ Left ══ */}
        <div className="lg:col-span-2 space-y-5">
          {/* Header card */}
          <div className="wcard p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black tracking-tight text-ink-primary">{go.title}</h1>
                  <StatusPill status={go.status === 'collecting' ? 'placed' : go.status} />
                </div>
                <div className="text-sm text-ink-secondary mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>{team.emoji} {team.name}</span><span className="text-line-default">·</span>
                  <span>{shortDate(go.date)}</span><span className="text-line-default">·</span>
                  <span>Organised by {organizer?.name.split(' ')[0]}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] uppercase tracking-wide font-bold text-ink-tertiary">Running total</div>
                <div className="text-2xl font-black text-ink-primary">{inr(grand)}</div>
              </div>
            </div>
          </div>

          {/* Share link */}
          {!isPlaced && (
            <div className="wcard p-5">
              <div className="wsection mb-2">Share with the team</div>
              <p className="text-xs text-ink-secondary mb-3">
                Anyone at your company can open this link, sign in, and pick their meal within the {inr(team.perHeadCapRup)}/head cap.
              </p>
              <div className="flex gap-2">
                <div className="flex-1 bg-white border border-line-default rounded-xl px-3 py-2.5 text-sm font-mono text-ink-secondary truncate">
                  {shareUrl}
                </div>
                <button onClick={copy} className="wbtn shrink-0 px-4">
                  {copied ? <><IconCheck size={16} /> Copied</> : 'Copy link'}
                </button>
              </div>
            </div>
          )}

          {isPlaced && go.placedInvoiceId && (
            <Link to={`/work/invoices/${go.placedInvoiceId}`} className="wcard-link p-4 flex items-center gap-3 border-green-200 bg-green-50/50">
              <div className="w-10 h-10 rounded-xl bg-green-100 grid place-items-center text-swiggy-green"><IconReceipt size={20} /></div>
              <div className="flex-1">
                <div className="font-bold text-sm text-ink-primary">Order placed · invoice ready</div>
                <div className="text-xs text-ink-secondary">View the consolidated invoice for this order</div>
              </div>
              <IconArrowRight size={18} className="text-swiggy-green" />
            </Link>
          )}

          {/* Participants */}
          <div className="wcard p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="wsection">Team picks · {submittedCount}/{roster.length} in</div>
              <span className="text-xs text-ink-tertiary">{contributing.length} ordering</span>
            </div>
            <div className="space-y-2">
              {roster.map((e) => {
                const p = go.participants.find((x) => x.employeeId === e.id);
                const status = p?.status ?? 'invited';
                const amount = spentByMember[e.id] ?? 0;
                const over = amount > team.perHeadCapRup;
                return (
                  <div key={e.id} className="flex items-center gap-3 py-1.5">
                    <span className={`w-9 h-9 rounded-full ${e.color} grid place-items-center text-white text-xs font-bold shrink-0`}>{e.initials}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-ink-primary truncate flex items-center gap-1.5">
                        {e.name}
                        {e.id === go.organizerId && <span className="chip chip-orange text-[9px] py-0">Organiser</span>}
                      </div>
                      <div className="text-[11px] text-ink-tertiary">
                        {p && p.lines.length > 0 ? `${p.lines.length} item${p.lines.length === 1 ? '' : 's'}` : 'No picks yet'}
                      </div>
                    </div>
                    {over && <span className="text-[10px] font-bold text-swiggy-red">over cap</span>}
                    <ParticipantStatusPill status={status} />
                    <span className="text-sm font-bold text-ink-primary w-16 text-right">{amount > 0 ? inr(amount) : '—'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add my own dishes (organizer / any team member viewing) */}
          {!isPlaced && iAmOnTeam && (
            <div className="wcard p-5">
              <button onClick={() => setMyPicksOpen((s) => !s)} className="w-full flex items-center justify-between">
                <div className="wsection">Add your dishes · {inr(spentByMember[currentUser.id] ?? 0)}</div>
                <IconChevronDown size={18} className={`text-ink-tertiary transition-transform ${myPicksOpen ? 'rotate-180' : ''}`} />
              </button>
              {myPicksOpen && (
                <div className="mt-4">
                  <DishPicker
                    employeeId={currentUser.id}
                    vegOnly={team.vegOnly}
                    perHeadCap={team.perHeadCapRup}
                    lines={myLines}
                    onChange={(lines: OrderLine[]) => setParticipantLines(go.id, currentUser.id, lines)}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══ Right: place ══ */}
        <div className="lg:col-span-1">
          <div className="sticky top-32 space-y-4">
            <div className="wcard p-5">
              <div className="wsection mb-3">Bill</div>
              <div className="space-y-1.5 text-sm">
                <Row label={`Food · ${restaurantCount} restaurant${restaurantCount === 1 ? '' : 's'}`} value={inr(food)} />
                <Row label="Delivery + fees" value={inr(fees)} muted />
                <Row label="GST (5%)" value={inr(tax)} muted />
                <div className="flex items-center justify-between pt-1.5 border-t border-line-subtle">
                  <span className="font-black text-ink-primary">Total</span>
                  <span className="font-black text-lg text-ink-primary">{inr(grand)}</span>
                </div>
              </div>
            </div>

            <div className="wcard p-5">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-ink-secondary">{team.name} · this month</span>
                <span className={`font-bold ${overBudget ? 'text-swiggy-red' : 'text-ink-primary'}`}>{inr(projected)} / {inr(team.budgetRup)}</span>
              </div>
              <BudgetBar spent={projected} budget={team.budgetRup} />

              {overBudget && <Gate tone="red" text={`This pushes ${team.name} ${inr(projected - team.budgetRup)} over budget.`} />}
              {capViolators.length > 0 && (
                <Gate tone="red" text={`${capViolators.map((p) => employeeById(p.employeeId)?.name.split(' ')[0]).join(', ')} exceed the ${inr(team.perHeadCapRup)}/head cap.`} />
              )}
              {needsApproval && !overBudget && capViolators.length === 0 && (
                <Gate tone="amber" text={`Over ${inr(team.requireApprovalAboveRup!)} — routed to an admin for approval.`} />
              )}

              {isPlaced ? (
                <div className="mt-3 text-center text-sm font-bold text-swiggy-green flex items-center justify-center gap-1.5">
                  <IconCheck size={16} /> Order placed
                </div>
              ) : canManage ? (
                <>
                  <button onClick={() => setConfirmingPlace(true)} disabled={!canPlace || placing} className="wbtn w-full mt-3 disabled:opacity-40 disabled:cursor-not-allowed">
                    <IconStore size={18} /> {needsApproval ? 'Submit for approval' : 'Place team order'}
                  </button>
                  <button onClick={() => cancelGroupOrder(go.id)} className="wbtn-ghost w-full mt-1 text-xs text-swiggy-red">
                    Cancel order
                  </button>
                  <p className="text-[11px] text-ink-tertiary text-center mt-1">One invoice · billed to {team.code}</p>
                </>
              ) : (
                <p className="mt-3 text-[12px] text-ink-tertiary text-center leading-snug">
                  Waiting for {organizer?.name.split(' ')[0]} to place the order once everyone's in.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* The gate before real money moves — the backend places one REAL Swiggy
          order per restaurant (split again by the ₹1000 cap). */}
      <RealOrderWarning
        open={confirmingPlace}
        lines={orderPreview}
        total={grand}
        addressLabel={go.address}
        busy={placing}
        confirmLabel="Yes, place for real"
        onConfirm={() => void place()}
        onCancel={() => setConfirmingPlace(false)}
      />
    </WorkShell>
  );
}

// ── atoms ──
function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-ink-tertiary' : 'text-ink-secondary'}>{label}</span>
      <span className={`font-semibold ${muted ? 'text-ink-secondary' : 'text-ink-primary'}`}>{value}</span>
    </div>
  );
}
function Gate({ tone, text }: { tone: 'red' | 'amber'; text: string }) {
  const cls = tone === 'red' ? 'bg-rose-50 text-swiggy-red' : 'bg-amber-50 text-warning';
  return <div className={`mt-2.5 text-[12px] font-semibold px-3 py-2 rounded-lg leading-snug ${cls}`}>{text}</div>;
}
function ParticipantStatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    invited: 'bg-surface-tertiary text-ink-tertiary',
    joined: 'bg-blue-50 text-info',
    picking: 'bg-amber-50 text-warning',
    submitted: 'bg-green-50 text-swiggy-green',
  };
  const label: Record<string, string> = { invited: 'Not opened', joined: 'Joined', picking: 'Picking', submitted: 'Ready' };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${map[status]}`}>{label[status]}</span>;
}
function NotFound() {
  return (
    <div className="wcard p-12 text-center">
      <IconUsers size={36} className="mx-auto mb-2 text-ink-tertiary opacity-40" />
      <p className="font-bold text-ink-primary">Order not found</p>
      <Link to="/work" className="text-sm text-swiggy-orange font-bold hover:underline mt-2 inline-block">Back to overview</Link>
    </div>
  );
}
