import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import WorkShell, { StatusPill } from '../components/WorkShell';
import { useCorporate } from '../state/CorporateContext';
import { invoiceCsvUrl } from '../lib/workApi';
import { inr, longDate } from '../lib/format';
import {
  IconReceipt, IconArrowRight, IconCheck, IconShield, IconStore, IconChevronRight,
  SwiggyMark,
} from '../components/icons/Icons';

export default function InvoiceDetail() {
  const { id } = useParams();
  const { company, getInvoice, getOrder, setInvoiceStatus, employeeById } = useCorporate();
  const inv = id ? getInvoice(id) : undefined;

  if (!inv) {
    return (
      <WorkShell>
        <div className="wcard p-12 text-center">
          <IconReceipt size={36} className="mx-auto mb-2 text-ink-tertiary opacity-40" />
          <p className="font-bold text-ink-primary">Invoice not found</p>
          <Link to="/work/invoices" className="text-sm text-swiggy-orange font-bold hover:underline mt-2 inline-block">
            Back to invoices
          </Link>
        </div>
      </WorkShell>
    );
  }

  const order = getOrder(inv.teamOrderId);

  // Group lines by restaurant → these are the real Swiggy sub-orders.
  const subOrders = useMemo(() => {
    if (!order) return [];
    const map = new Map<string, { name: string; lines: typeof order.lines; total: number }>();
    order.lines.forEach((l) => {
      const g = map.get(l.restaurantId) ?? { name: l.restaurantName, lines: [], total: 0 };
      g.lines.push(l);
      g.total += l.price * l.qty;
      map.set(l.restaurantId, g);
    });
    return [...map.values()];
  }, [order]);

  return (
    <WorkShell>
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1.5 text-xs text-ink-tertiary">
          <Link to="/work/invoices" className="font-semibold hover:text-swiggy-orange">Invoices</Link>
          <IconChevronRight size={13} />
          <span className="font-mono font-bold text-ink-secondary">{inv.number}</span>
        </div>
        <div className="flex items-center gap-2">
          {inv.status === 'issued' && (
            <button onClick={() => setInvoiceStatus(inv.id, 'claimed')} className="wbtn-soft text-xs">
              <IconCheck size={14} /> Mark claimed
            </button>
          )}
          {inv.status === 'claimed' && (
            <button onClick={() => setInvoiceStatus(inv.id, 'reconciled')} className="wbtn-soft text-xs">
              <IconCheck size={14} /> Reconcile
            </button>
          )}
          <a href={invoiceCsvUrl(inv.id)} className="wbtn-soft text-xs" download>
            CSV
          </a>
          <button onClick={() => window.print()} className="wbtn text-xs">
            Download PDF <IconArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* ═══ The invoice document ═══ */}
      <div className="wcard p-0 overflow-hidden">
        {/* Masthead */}
        <div className="bg-ink-primary text-white px-6 sm:px-8 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-3xl leading-none">{company.logoEmoji}</span>
                <div>
                  <div className="font-black text-lg leading-tight">{company.name}</div>
                  <div className="text-[11px] text-white/60">{company.addressLabel}</div>
                </div>
              </div>
              {inv.gstin && (
                <div className="mt-3 text-[11px] text-white/70">
                  <span className="uppercase tracking-widest text-white/40 mr-1.5">GSTIN</span>
                  <span className="font-mono font-bold">{inv.gstin}</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-black text-white/80 bg-white/10 px-2.5 py-1 rounded-full">
                Consolidated {inv.billingLinked ? 'tax invoice' : 'statement'}
              </div>
              <div className="font-mono font-black text-xl mt-2">{inv.number}</div>
              <div className="text-[11px] text-white/60 mt-0.5">Issued {longDate(inv.issuedAt)}</div>
              <div className="mt-2 flex justify-end"><StatusPill status={inv.status} /></div>
            </div>
          </div>
        </div>

        {/* Meta strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line-subtle">
          <Meta label="Bill to (cost centre)" value={inv.costCenterName} sub={inv.costCenterCode} />
          <Meta label="Order" value={inv.title} sub={longDate(inv.date)} />
          <Meta label="Placed by" value={inv.placedByName} sub={`${inv.headcount} people`} />
          <Meta label="Delivered to" value={inv.address.split(',')[0]} sub={`${inv.restaurantCount} restaurants`} />
        </div>

        {/* Sub-orders (real Swiggy orders) */}
        <div className="px-6 sm:px-8 py-6">
          <div className="wsection mb-3">
            {subOrders.length} Swiggy sub-order{subOrders.length === 1 ? '' : 's'} · one event
          </div>
          <div className="space-y-3">
            {subOrders.map((s, i) => (
              <div key={i} className="border border-line-subtle rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-secondary">
                  <IconStore size={15} className="text-swiggy-orange" />
                  <span className="font-bold text-sm text-ink-primary flex-1">{s.name}</span>
                  <span className="font-black text-sm text-ink-primary">{inr(s.total)}</span>
                </div>
                <div className="divide-y divide-line-subtle">
                  {s.lines.map((l, j) => {
                    const emp = employeeById(l.employeeId);
                    return (
                      <div key={j} className="flex items-center gap-3 px-4 py-2 text-sm">
                        <span className="text-ink-secondary flex-1">
                          {l.qty} × {l.dishName}
                        </span>
                        <span className="text-[11px] text-ink-tertiary">{emp?.name.split(' ')[0]}</span>
                        <span className="font-semibold text-ink-primary w-16 text-right">{inr(l.price * l.qty)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Per-person breakdown — the claims killer feature */}
        <div className="px-6 sm:px-8 pb-6">
          <div className="wsection mb-3">Per-person breakdown</div>
          <div className="border border-line-subtle rounded-xl overflow-hidden">
            {inv.breakdown.map((p, i) => (
              <div key={p.employeeId} className={`flex items-center gap-3 px-4 py-2.5 ${i % 2 ? 'bg-surface-secondary/50' : ''}`}>
                <span className="text-sm font-semibold text-ink-primary flex-1">{p.name}</span>
                <span className="text-[11px] text-ink-tertiary">{p.items.length} item{p.items.length === 1 ? '' : 's'}</span>
                <span className="font-bold text-sm text-ink-primary w-20 text-right">{inr(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="px-6 sm:px-8 pb-8">
          <div className="ml-auto max-w-xs space-y-1.5 text-sm">
            <TotalRow label="Food subtotal" value={inr(inv.breakdown.reduce((s, p) => s + p.amount, 0))} />
            <TotalRow label="Delivery + platform" value={inr(inv.subtotal - inv.breakdown.reduce((s, p) => s + p.amount, 0))} muted />
            <TotalRow label="GST (5%)" value={inr(inv.tax)} muted />
            <div className="flex items-center justify-between pt-2 mt-1 border-t-2 border-ink-primary">
              <span className="font-black text-ink-primary">Total payable</span>
              <span className="font-black text-xl text-ink-primary">{inr(inv.total)}</span>
            </div>
          </div>
        </div>

        {/* GST-invoice footer note */}
        <div className={`px-6 sm:px-8 py-4 border-t border-line-subtle flex items-start gap-3 ${inv.billingLinked ? 'bg-green-50/50' : 'bg-amber-50/50'}`}>
          <div className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${inv.billingLinked ? 'bg-green-100 text-swiggy-green' : 'bg-amber-100 text-warning'}`}>
            <IconShield size={16} />
          </div>
          <div className="flex-1">
            {inv.billingLinked ? (
              <>
                <div className="text-sm font-bold text-ink-primary">GST tax invoice available</div>
                <a href={inv.gstInvoiceUrl ?? '#'} className="text-xs text-swiggy-green font-bold hover:underline">
                  Download Swiggy GST invoice for input credit →
                </a>
              </>
            ) : (
              <>
                <div className="text-sm font-bold text-ink-primary">Finance-grade statement</div>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  This consolidated statement is claim-ready. Link Swiggy Corporate billing under
                  the company GSTIN to also attach the official GST tax invoice for input-tax credit.
                </p>
              </>
            )}
          </div>
          {!inv.billingLinked && (
            <Link to="/work/settings" className="wbtn-soft text-xs shrink-0">Link billing</Link>
          )}
        </div>
      </div>

      <p className="text-[11px] text-ink-tertiary text-center mt-4">
        CaterKart for Work · powered by <SwiggyMark size={12} className="inline-block align-middle" /> · this is a prototype document
      </p>
    </WorkShell>
  );
}

function Meta({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="text-[10px] uppercase tracking-wide font-bold text-ink-tertiary">{label}</div>
      <div className="text-sm font-bold text-ink-primary truncate mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-ink-tertiary font-mono">{sub}</div>}
    </div>
  );
}
function TotalRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-ink-tertiary' : 'text-ink-secondary'}>{label}</span>
      <span className={`font-semibold ${muted ? 'text-ink-secondary' : 'text-ink-primary'}`}>{value}</span>
    </div>
  );
}
