import { Link, useNavigate } from 'react-router-dom';
import WorkShell, { BudgetBar, StatusPill } from '../components/WorkShell';
import { useCorporate, type GroupOrder } from '../state/CorporateContext';
import { inr, inrCompact, shortDate } from '../lib/format';
import {
  IconArrowRight, IconReceipt, IconStore, IconUsers, IconBolt, IconShield,
} from '../components/icons/Icons';

export default function WorkHome() {
  const nav = useNavigate();
  const {
    company, costCenters, orders, invoices, groupOrders, currentUser, isAdmin,
    companySpentThisMonth, companyBudgetTotal, spentForTeam, employeesByTeam,
  } = useCorporate();

  const monthLabel = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const first = currentUser.name.split(' ')[0];

  // Role scoping
  const myTeams = isAdmin ? costCenters : costCenters.filter((c) => c.id === currentUser.costCenterId);
  const visibleGroupOrders = groupOrders.filter(
    (g) => g.status === 'collecting' && (isAdmin || g.costCenterId === currentUser.costCenterId || g.participants.some((p) => p.employeeId === currentUser.id)),
  );
  const visibleOrders = isAdmin ? orders : orders.filter((o) => o.costCenterId === currentUser.costCenterId);
  const openClaims = invoices.filter((i) => i.status === 'issued' || i.status === 'claimed').length;
  const remaining = companyBudgetTotal - companySpentThisMonth;

  return (
    <WorkShell>
      {/* Hero */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-ink-primary">
            {greeting()}, {first}
          </h1>
          <p className="text-sm text-ink-secondary mt-1">
            {isAdmin ? <>Team meals for <span className="font-bold">{company.name}</span> — {monthLabel}</> : <>Order lunch with your team — {monthLabel}</>}
          </p>
        </div>
        <button className="wbtn shrink-0" onClick={() => nav('/work/order')}>
          <IconStore size={18} /> New team order
        </button>
      </div>

      {/* Billing banner — admin only */}
      {isAdmin && !company.billingLinked && (
        <div className="wcard p-4 mb-6 border-amber-200 bg-amber-50/60 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 grid place-items-center text-warning shrink-0"><IconShield size={18} /></div>
          <div className="flex-1">
            <div className="font-bold text-sm text-ink-primary">Finance-grade statements are live · GST tax invoices pending</div>
            <p className="text-xs text-ink-secondary mt-0.5 leading-relaxed">
              You get one consolidated, cost-center-tagged statement per order today. Link Swiggy Corporate billing under
              GSTIN <span className="font-mono">{company.gstin}</span> to also auto-issue the true GST tax invoice.
            </p>
          </div>
          <Link to="/work/settings" className="wbtn-soft shrink-0 text-xs">Link billing</Link>
        </div>
      )}

      {/* KPIs — admin only */}
      {isAdmin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Kpi label="Spent this month" value={inrCompact(companySpentThisMonth)} sub={`of ${inrCompact(companyBudgetTotal)} budget`} icon={<IconBolt size={18} />} />
          <Kpi label="Budget remaining" value={inrCompact(Math.max(0, remaining))} sub={remaining < 0 ? 'over budget' : 'across all teams'} tone={remaining < 0 ? 'red' : 'green'} icon={<IconShield size={18} />} />
          <Kpi label="Team orders" value={String(orders.length)} sub="this quarter" icon={<IconStore size={18} />} />
          <Kpi label="Open claims" value={String(openClaims)} sub="awaiting reconcile" tone={openClaims > 0 ? 'orange' : 'green'} icon={<IconReceipt size={18} />} />
        </div>
      )}

      {/* Live orders */}
      {visibleGroupOrders.length > 0 && (
        <section className="mb-6">
          <div className="wsection mb-3">Collecting now · {visibleGroupOrders.length}</div>
          <div className="grid sm:grid-cols-2 gap-3">
            {visibleGroupOrders.map((g) => <LiveOrderCard key={g.id} go={g} />)}
          </div>
        </section>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Team budgets */}
        <section className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <div className="wsection">{isAdmin ? 'Team budgets' : 'Your team'} · {monthLabel}</div>
            {isAdmin && <Link to="/work/settings" className="text-xs font-bold text-swiggy-orange hover:underline">Manage</Link>}
          </div>
          <div className="space-y-2.5">
            {myTeams.map((cc) => {
              const spent = spentForTeam(cc.id);
              const headcount = employeesByTeam(cc.id).length;
              const over = spent > cc.budgetRup;
              const inner = (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-secondary grid place-items-center text-xl shrink-0">{cc.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ink-primary truncate">{cc.name}</span>
                        <span className="chip text-[10px] py-0 font-mono">{cc.code}</span>
                      </div>
                      <div className="text-[11px] text-ink-tertiary flex items-center gap-1 mt-0.5">
                        <IconUsers size={12} /> {headcount} people · {inr(cc.perHeadCapRup)}/head cap
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-sm font-black ${over ? 'text-swiggy-red' : 'text-ink-primary'}`}>{inr(spent)}</div>
                      <div className="text-[11px] text-ink-tertiary">of {inr(cc.budgetRup)}</div>
                    </div>
                  </div>
                  <div className="mt-3"><BudgetBar spent={spent} budget={cc.budgetRup} /></div>
                </>
              );
              return isAdmin ? (
                <Link to="/work/settings" key={cc.id} className="wcard-link p-4 block">{inner}</Link>
              ) : (
                <div key={cc.id} className="wcard p-4">{inner}</div>
              );
            })}
          </div>
        </section>

        {/* Recent orders */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="wsection">Recent orders</div>
            <Link to="/work/invoices" className="text-xs font-bold text-swiggy-orange hover:underline">All invoices</Link>
          </div>
          <div className="space-y-2.5">
            {visibleOrders.slice(0, 5).map((o) => {
              const inv = invoices.find((i) => i.id === o.invoiceId);
              return (
                <Link to={inv ? `/work/invoices/${inv.id}` : '/work/invoices'} key={o.id} className="wcard-link p-4 block">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-ink-primary truncate">{o.title}</div>
                      <div className="text-[11px] text-ink-tertiary mt-0.5">
                        {shortDate(o.date)} · {o.memberIds.length} people · {new Set(o.lines.map((l) => l.restaurantId)).size} spots
                      </div>
                    </div>
                    <StatusPill status={o.status} />
                  </div>
                  <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-line-subtle">
                    <span className="text-[11px] font-mono text-ink-tertiary">{inv?.number}</span>
                    <span className="text-sm font-black text-ink-primary">{inr(inv?.total ?? 0)}</span>
                  </div>
                </Link>
              );
            })}
            <button onClick={() => nav('/work/order')} className="w-full wcard-link p-4 flex items-center justify-center gap-2 text-sm font-bold text-swiggy-orange border-dashed">
              Start a new team order <IconArrowRight size={16} />
            </button>
          </div>
        </section>
      </div>
    </WorkShell>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function LiveOrderCard({ go }: { go: GroupOrder }) {
  const { costCenterById, employeesByTeam } = useCorporate();
  const team = costCenterById(go.costCenterId);
  const roster = employeesByTeam(go.costCenterId);
  const submitted = go.participants.filter((p) => p.status === 'submitted').length;
  const food = go.participants.flatMap((p) => p.lines).reduce((s, l) => s + l.price * l.qty, 0);
  const rest = new Set(go.participants.flatMap((p) => p.lines).map((l) => l.restaurantId)).size;
  const total = food + rest * 35 + (food ? 6 : 0) + Math.round(food * 0.05);
  const pct = roster.length ? (submitted / roster.length) * 100 : 0;

  return (
    <Link to={`/work/group/${go.id}`} className="wcard-link p-4 block">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-sm text-ink-primary truncate">{go.title}</div>
          <div className="text-[11px] text-ink-tertiary mt-0.5">{team?.emoji} {team?.name} · {shortDate(go.date)}</div>
        </div>
        <StatusPill status="collecting" />
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-ink-tertiary">{submitted}/{roster.length} submitted</span>
          <span className="font-bold text-ink-primary">{inr(total)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-tertiary overflow-hidden">
          <div className="h-full rounded-full bg-swiggy-green transition-all" style={{ width: `${Math.max(pct, 4)}%` }} />
        </div>
      </div>
    </Link>
  );
}

function Kpi({ label, value, sub, icon, tone = 'navy' }: { label: string; value: string; sub: string; icon: React.ReactNode; tone?: 'navy' | 'green' | 'orange' | 'red' }) {
  const toneCls: Record<string, string> = {
    navy: 'text-ink-primary bg-surface-secondary',
    green: 'text-swiggy-green bg-green-50',
    orange: 'text-swiggy-orange bg-orange-50',
    red: 'text-swiggy-red bg-rose-50',
  };
  return (
    <div className="wcard p-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wide font-bold text-ink-tertiary">{label}</div>
        <div className={`w-8 h-8 rounded-lg grid place-items-center ${toneCls[tone]}`}>{icon}</div>
      </div>
      <div className="text-2xl font-black text-ink-primary mt-2 leading-none">{value}</div>
      <div className="text-[11px] text-ink-tertiary mt-1">{sub}</div>
    </div>
  );
}
