import { useState } from 'react';
import WorkShell, { BudgetBar } from '../components/WorkShell';
import { useCorporate } from '../state/CorporateContext';
import type { CostCenter, CostCenterWithSpend } from '../data/corporate';
import { inr } from '../lib/format';
import {
  IconUsers, IconLeaf, IconShield, IconCheck, IconStore,
} from '../components/icons/Icons';

export default function BudgetSettings() {
  const { company, costCenters, spentForTeam, updateCostCenter, updateCompany } = useCorporate();

  return (
    <WorkShell>
      <div className="mb-5">
        <h1 className="text-2xl font-black tracking-tight text-ink-primary">Teams &amp; budgets</h1>
        <p className="text-sm text-ink-secondary mt-1">
          Set spend caps and meal policy per cost centre. Every order is gated against these.
        </p>
      </div>

      {/* Company billing card */}
      <div className="wcard p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-surface-secondary grid place-items-center text-2xl">{company.logoEmoji}</div>
            <div>
              <div className="font-black text-ink-primary">{company.name}</div>
              <div className="text-xs text-ink-tertiary mt-0.5">
                {company.emailDomain} · GSTIN <span className="font-mono">{company.gstin}</span>
              </div>
              <div className="text-xs text-ink-tertiary">Billing: {company.billingEmail}</div>
            </div>
          </div>
          <span className="chip chip-navy capitalize">{company.plan} plan</span>
        </div>

        <div className="mt-4 pt-4 border-t border-line-subtle flex items-center justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <IconShield size={18} className={company.billingLinked ? 'text-swiggy-green mt-0.5' : 'text-warning mt-0.5'} />
            <div>
              <div className="text-sm font-bold text-ink-primary">Swiggy Corporate GST billing</div>
              <p className="text-xs text-ink-secondary max-w-md leading-relaxed">
                {company.billingLinked
                  ? 'Linked — orders auto-issue an official GST tax invoice under your GSTIN.'
                  : 'Not linked — you get finance-grade consolidated statements. Link to also issue GST tax invoices for input-tax credit.'}
              </p>
            </div>
          </div>
          <Toggle
            on={company.billingLinked}
            onChange={(v) => updateCompany({ billingLinked: v })}
            labelOn="Linked"
            labelOff="Link"
          />
        </div>
      </div>

      {/* Teams */}
      <div className="wsection mb-3">Cost centres · {costCenters.length}</div>
      <div className="space-y-4">
        {costCenters.map((cc) => (
          <TeamCard key={cc.id} cc={cc} spent={spentForTeam(cc.id)} onChange={(patch) => updateCostCenter(cc.id, patch)} />
        ))}
      </div>
    </WorkShell>
  );
}

function TeamCard({ cc, spent, onChange }: { cc: CostCenterWithSpend; spent: number; onChange: (p: Partial<CostCenter>) => void }) {
  const { employeesByTeam, employeeById } = useCorporate();
  const [open, setOpen] = useState(false);
  const members = employeesByTeam(cc.id);
  const lead = employeeById(cc.leadId);
  const over = spent > cc.budgetRup;

  return (
    <div className="wcard overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-surface-secondary grid place-items-center text-2xl shrink-0">{cc.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink-primary truncate">{cc.name}</span>
            <span className="chip text-[10px] py-0 font-mono">{cc.code}</span>
          </div>
          <div className="text-[11px] text-ink-tertiary flex items-center gap-1 mt-0.5">
            <IconUsers size={12} /> {members.length} people · Lead: {lead?.name.split(' ')[0] ?? '—'}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-sm font-black ${over ? 'text-swiggy-red' : 'text-ink-primary'}`}>{inr(spent)}</div>
          <div className="text-[11px] text-ink-tertiary">of {inr(cc.budgetRup)}/mo</div>
        </div>
      </div>
      <div className="px-4 pb-3"><BudgetBar spent={spent} budget={cc.budgetRup} /></div>

      {/* Controls */}
      <div className="px-4 pb-4 grid sm:grid-cols-2 gap-4 border-t border-line-subtle pt-4">
        <NumberField
          label="Monthly budget"
          value={cc.budgetRup}
          step={5000}
          onChange={(v) => onChange({ budgetRup: v })}
        />
        <NumberField
          label="Per-head cap / order"
          value={cc.perHeadCapRup}
          step={50}
          onChange={(v) => onChange({ perHeadCapRup: v })}
        />
      </div>

      {/* Policy toggles */}
      <div className="px-4 pb-4 flex flex-wrap gap-2">
        <PolicyToggle label="Veg only" icon={<IconLeaf size={13} />} on={cc.vegOnly} onChange={(v) => onChange({ vegOnly: v })} />
        <PolicyToggle label="Allow alcohol" on={cc.allowAlcohol} onChange={(v) => onChange({ allowAlcohol: v })} />
        <PolicyToggle
          label={cc.requireApprovalAboveRup != null ? `Approval > ${inr(cc.requireApprovalAboveRup)}` : 'No approval gate'}
          icon={<IconShield size={13} />}
          on={cc.requireApprovalAboveRup != null}
          onChange={(v) => onChange({ requireApprovalAboveRup: v ? 15000 : null })}
        />
      </div>

      {/* Members expander */}
      <button
        onClick={() => setOpen((s) => !s)}
        className="w-full px-4 py-2.5 border-t border-line-subtle text-xs font-bold text-ink-secondary hover:bg-surface-secondary transition flex items-center justify-center gap-1.5"
      >
        {open ? 'Hide' : 'Show'} {members.length} members
      </button>
      {open && (
        <div className="px-4 py-3 bg-surface-secondary/50 grid sm:grid-cols-2 gap-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 bg-white rounded-xl px-3 py-2 border border-line-subtle">
              <span className={`w-8 h-8 rounded-full ${m.color} grid place-items-center text-white text-xs font-bold`}>{m.initials}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink-primary truncate">{m.name}</div>
                <div className="text-[11px] text-ink-tertiary truncate">{m.workEmail}</div>
              </div>
              <span className={`chip text-[9px] py-0 capitalize ${m.role === 'admin' ? 'chip-orange' : m.role === 'lead' ? 'chip-navy' : ''}`}>{m.role}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── atoms ──
function NumberField({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide font-bold text-ink-tertiary mb-1.5">{label}</div>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(Math.max(0, value - step))} className="w-9 h-9 rounded-lg bg-surface-tertiary text-ink-secondary font-bold shrink-0">−</button>
        <div className="flex-1 text-center font-black text-ink-primary bg-surface-secondary rounded-lg py-2 border border-line-default">{inr(value)}</div>
        <button onClick={() => onChange(value + step)} className="w-9 h-9 rounded-lg bg-surface-tertiary text-ink-secondary font-bold shrink-0">+</button>
      </div>
    </div>
  );
}

function PolicyToggle({ label, icon, on, onChange }: { label: string; icon?: React.ReactNode; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition ${
        on ? 'bg-orange-50 border-orange-200 text-swiggy-orange' : 'bg-white border-line-default text-ink-tertiary'
      }`}
    >
      {on ? <IconCheck size={13} /> : icon ?? <span className="w-3 h-3 rounded-full border border-current" />}
      {label}
    </button>
  );
}

function Toggle({ on, onChange, labelOn, labelOff }: { on: boolean; onChange: (v: boolean) => void; labelOn: string; labelOff: string }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-sm transition shrink-0 ${
        on ? 'bg-swiggy-green text-white' : 'bg-ink-primary text-white'
      }`}
    >
      {on ? <><IconCheck size={15} /> {labelOn}</> : labelOff}
    </button>
  );
}
