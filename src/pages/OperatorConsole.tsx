import { Link } from 'react-router-dom';
import WorkShell from '../components/WorkShell';
import { useCorporate } from '../state/CorporateContext';
import { inr, shortDate } from '../lib/format';
import { IconStore, IconCheck, IconShield, IconReceipt } from '../components/icons/Icons';

// =====================================================
// F1 — Operator console. The ops cockpit: every team order that was actually
// placed through the Swiggy MCP, its per-restaurant sub-orders, real Swiggy
// order ids, and reconciliation/failure health. This is how you babysit pilots.
// =====================================================
const SUB_BADGE: Record<string, string> = {
  placed: 'bg-green-50 text-swiggy-green',
  reconciled: 'bg-amber-50 text-warning',
  failed: 'bg-rose-50 text-swiggy-red',
};

export default function OperatorConsole() {
  const { invoices, groupOrders, costCenterById } = useCorporate();

  const placed = invoices.filter((i) => i.placement); // real MCP placements only
  const subOrders = placed.flatMap((i) => i.placement!.subOrders);
  const reconciled = subOrders.filter((s) => s.status === 'reconciled').length;
  const failed = subOrders.filter((s) => s.status === 'failed').length;
  const needsAttention = placed.filter((i) => i.placement!.anyFailed);
  const collecting = groupOrders.filter((g) => g.status === 'collecting');

  return (
    <WorkShell>
      <div className="mb-5">
        <h1 className="text-2xl font-black tracking-tight text-ink-primary">Operator console</h1>
        <p className="text-sm text-ink-secondary mt-1">
          Live health of every order placed through Swiggy — sub-orders, reconciliation, failures.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi label="Placed orders" value={String(placed.length)} icon={<IconStore size={18} />} />
        <Kpi label="Swiggy sub-orders" value={String(subOrders.length)} icon={<IconReceipt size={18} />} />
        <Kpi label="Auto-reconciled" value={String(reconciled)} tone={reconciled ? 'amber' : 'navy'} icon={<IconShield size={18} />} sub="recovered after a 5xx" />
        <Kpi label="Failed" value={String(failed)} tone={failed ? 'red' : 'green'} icon={<IconCheck size={18} />} sub={failed ? 'need attention' : 'all healthy'} />
      </div>

      {needsAttention.length > 0 && (
        <div className="wcard p-4 mb-6 border-rose-200 bg-rose-50/50">
          <div className="wsection mb-2 text-swiggy-red">Needs attention · {needsAttention.length}</div>
          <div className="space-y-1.5">
            {needsAttention.map((i) => (
              <Link key={i.id} to={`/work/invoices/${i.id}`} className="flex items-center justify-between text-sm hover:underline">
                <span className="font-semibold text-ink-primary">{i.title}</span>
                <span className="font-mono text-xs text-ink-tertiary">{i.number}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Live collecting */}
      {collecting.length > 0 && (
        <section className="mb-6">
          <div className="wsection mb-3">Collecting (not yet placed) · {collecting.length}</div>
          <div className="grid sm:grid-cols-2 gap-3">
            {collecting.map((g) => {
              const cc = costCenterById(g.costCenterId);
              const submitted = g.participants.filter((p) => p.status === 'submitted').length;
              return (
                <Link key={g.id} to={`/work/group/${g.id}`} className="wcard-link p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-ink-primary">{g.title}</div>
                    <div className="text-[11px] text-ink-tertiary">{cc?.emoji} {cc?.name} · {shortDate(g.date)}</div>
                  </div>
                  <span className="chip text-[11px]">{submitted} submitted</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Placed orders + sub-order health */}
      <div className="wsection mb-3">Placed orders</div>
      {placed.length === 0 ? (
        <div className="wcard p-10 text-center text-ink-tertiary text-sm">
          No orders placed through Swiggy yet. Place a team order to see its sub-orders here.
        </div>
      ) : (
        <div className="space-y-3">
          {placed.map((i) => (
            <div key={i.id} className="wcard p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <Link to={`/work/invoices/${i.id}`} className="font-bold text-sm text-ink-primary hover:underline">{i.title}</Link>
                  <div className="text-[11px] text-ink-tertiary">
                    {i.number} · {shortDate(i.date)} · {i.costCenterName} · paid {i.placement!.paymentUsed}
                    {i.placement!.paymentIntended !== i.placement!.paymentUsed && ` (intended ${i.placement!.paymentIntended})`}
                  </div>
                </div>
                <span className="text-sm font-black text-ink-primary">{inr(i.total)}</span>
              </div>
              <div className="border-t border-line-subtle pt-2 space-y-1.5">
                {i.placement!.subOrders.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-sm">
                    <IconStore size={14} className="text-ink-tertiary shrink-0" />
                    <span className="font-semibold text-ink-primary flex-1 truncate">{s.restaurantName}</span>
                    <span className="text-[11px] font-mono text-ink-tertiary truncate max-w-[160px]">{s.swiggyOrderId ?? '—'}</span>
                    <span className="text-[11px] text-ink-tertiary">{s.itemCount} item{s.itemCount === 1 ? '' : 's'}</span>
                    <span className="font-semibold text-ink-primary w-16 text-right">{inr(s.amount)}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold capitalize ${SUB_BADGE[s.status]}`}>{s.status}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </WorkShell>
  );
}

function Kpi({ label, value, sub, icon, tone = 'navy' }: { label: string; value: string; sub?: string; icon: React.ReactNode; tone?: 'navy' | 'green' | 'amber' | 'red' }) {
  const toneCls: Record<string, string> = {
    navy: 'text-ink-primary bg-surface-secondary',
    green: 'text-swiggy-green bg-green-50',
    amber: 'text-warning bg-amber-50',
    red: 'text-swiggy-red bg-rose-50',
  };
  return (
    <div className="wcard p-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wide font-bold text-ink-tertiary">{label}</div>
        <div className={`w-8 h-8 rounded-lg grid place-items-center ${toneCls[tone]}`}>{icon}</div>
      </div>
      <div className="text-2xl font-black text-ink-primary mt-2 leading-none">{value}</div>
      {sub && <div className="text-[11px] text-ink-tertiary mt-1">{sub}</div>}
    </div>
  );
}
