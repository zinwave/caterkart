import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import WorkShell, { StatusPill } from '../components/WorkShell';
import { useCorporate, type InvoiceStatus } from '../state/CorporateContext';
import { inr, shortDate } from '../lib/format';
import { IconReceipt, IconSearch } from '../components/icons/Icons';

const FILTERS: { key: 'all' | InvoiceStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'issued', label: 'To claim' },
  { key: 'claimed', label: 'Claimed' },
  { key: 'reconciled', label: 'Reconciled' },
];

export default function Invoices() {
  const { invoices, costCenters, isAdmin, currentUser } = useCorporate();
  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all');
  const [q, setQ] = useState('');

  // Non-admins only see invoices for their own cost centre.
  const scoped = useMemo(
    () => (isAdmin ? invoices : invoices.filter((i) => i.costCenterId === currentUser.costCenterId)),
    [invoices, isAdmin, currentUser.costCenterId],
  );

  const filtered = useMemo(() => {
    return scoped.filter((i) => {
      if (filter !== 'all' && i.status !== filter) return false;
      if (q && !(`${i.title} ${i.number} ${i.costCenterName}`.toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
  }, [scoped, filter, q]);

  const totalBilled = filtered.reduce((s, i) => s + i.total, 0);

  return (
    <WorkShell>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink-primary">Invoices</h1>
          <p className="text-sm text-ink-secondary mt-1">
            One consolidated, cost-center-tagged invoice per team order.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[11px] uppercase tracking-wide font-bold text-ink-tertiary">Showing</div>
          <div className="text-xl font-black text-ink-primary">{inr(totalBilled)}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filter === f.key ? 'bg-ink-primary text-white' : 'bg-white border border-line-default text-ink-secondary hover:border-ink-tertiary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search invoice no, order, team…"
            className="w-full bg-white rounded-lg pl-9 pr-3 py-2 text-sm outline-none border border-line-default focus:border-swiggy-orange focus:ring-2 focus:ring-orange-100 transition"
          />
        </div>
      </div>

      {/* Table */}
      <div className="wcard overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2.5 bg-surface-secondary text-[11px] uppercase tracking-wide font-bold text-ink-tertiary border-b border-line-subtle">
          <div className="col-span-3">Invoice</div>
          <div className="col-span-3">Order</div>
          <div className="col-span-2">Team</div>
          <div className="col-span-2">Date</div>
          <div className="col-span-1 text-right">Amount</div>
          <div className="col-span-1 text-right">Status</div>
        </div>

        {filtered.length === 0 && (
          <div className="p-12 text-center text-ink-tertiary">
            <IconReceipt size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No invoices match.</p>
          </div>
        )}

        <div className="divide-y divide-line-subtle">
          {filtered.map((i) => {
            const cc = costCenters.find((c) => c.id === i.costCenterId);
            return (
              <Link
                key={i.id}
                to={`/work/invoices/${i.id}`}
                className="grid grid-cols-2 md:grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-surface-secondary transition"
              >
                <div className="md:col-span-3">
                  <div className="font-mono text-[12px] font-bold text-ink-primary">{i.number}</div>
                  <div className="text-[11px] text-ink-tertiary">{i.headcount} people · {i.restaurantCount} spots</div>
                </div>
                <div className="md:col-span-3 hidden md:block">
                  <div className="text-sm font-semibold text-ink-primary truncate">{i.title}</div>
                </div>
                <div className="md:col-span-2 hidden md:flex items-center gap-1.5">
                  <span>{cc?.emoji}</span>
                  <span className="text-xs font-semibold text-ink-secondary truncate">{i.costCenterName}</span>
                </div>
                <div className="md:col-span-2 text-xs text-ink-secondary hidden md:block">{shortDate(i.date)}</div>
                <div className="md:col-span-1 text-right font-black text-sm text-ink-primary">{inr(i.total)}</div>
                <div className="md:col-span-1 flex md:justify-end"><StatusPill status={i.status} /></div>
              </Link>
            );
          })}
        </div>
      </div>
    </WorkShell>
  );
}
