import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WorkShell from '../components/WorkShell';
import { useCorporate } from '../state/CorporateContext';
import { inr } from '../lib/format';
import { IconStore, IconArrowRight, IconUsers, IconLeaf, IconShield } from '../components/icons/Icons';
import { DatePicker } from '../components/common';

export default function NewGroupOrder() {
  const nav = useNavigate();
  const { costCenters, currentUser, isAdmin, createGroupOrder, spentForTeam, costCenterById } = useCorporate();

  // Non-admins can only order for their own team; admins can pick any.
  const allowedTeams = useMemo(
    () => (isAdmin ? costCenters : costCenters.filter((c) => c.id === currentUser.costCenterId)),
    [costCenters, isAdmin, currentUser.costCenterId],
  );

  const [title, setTitle] = useState('Friday team lunch');
  const [costCenterId, setCostCenterId] = useState(allowedTeams[0]?.id ?? costCenters[0]?.id ?? '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const team = costCenterById(costCenterId)!;
  const spent = spentForTeam(costCenterId);

  async function create() {
    const go = await createGroupOrder({ title: title.trim() || 'Team lunch', costCenterId, organizerId: currentUser.id, date });
    nav(`/work/group/${go.id}`);
  }

  return (
    <WorkShell>
      <div className="max-w-2xl mx-auto">
        <div className="mb-5">
          <h1 className="text-2xl font-black tracking-tight text-ink-primary">Start a team order</h1>
          <p className="text-sm text-ink-secondary mt-1">
            Open the order, share the link, and let everyone pick their own meal. One invoice, billed to the team.
          </p>
        </div>

        <div className="wcard p-5 space-y-5">
          <Field label="Order name">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-surface-secondary rounded-xl px-3.5 py-3 text-sm font-medium outline-none border border-line-default focus:border-swiggy-orange focus:ring-2 focus:ring-orange-100 transition"
              placeholder="Friday team lunch"
            />
          </Field>

          <Field label="Cost centre (team)">
            {allowedTeams.length === 1 ? (
              <div className="flex items-center gap-2 px-3.5 py-3 rounded-xl bg-surface-secondary border border-line-default">
                <span className="text-lg">{team.emoji}</span>
                <span className="font-bold text-sm text-ink-primary">{team.name}</span>
                <span className="chip text-[10px] py-0 font-mono">{team.code}</span>
                <span className="ml-auto text-[11px] text-ink-tertiary">your team</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allowedTeams.map((cc) => {
                  const active = cc.id === costCenterId;
                  return (
                    <button
                      key={cc.id}
                      onClick={() => setCostCenterId(cc.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border transition ${
                        active ? 'bg-ink-primary text-white border-ink-primary' : 'bg-white text-ink-secondary border-line-default hover:border-ink-tertiary'
                      }`}
                    >
                      <span>{cc.emoji}</span> {cc.name}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>

          <Field label="Delivery date">
            <DatePicker value={date} onChange={setDate} />
          </Field>

          {/* Policy preview */}
          <div className="rounded-xl bg-surface-secondary border border-line-subtle p-3.5">
            <div className="text-[11px] uppercase tracking-wide font-bold text-ink-tertiary mb-2">This team's policy</div>
            <div className="flex flex-wrap gap-2">
              <Chip icon={<IconUsers size={12} />} label={`${inr(team.perHeadCapRup)}/head cap`} />
              <Chip label={`${inr(spent)} of ${inr(team.budgetRup)} used`} tone={spent > team.budgetRup ? 'red' : 'navy'} />
              {team.vegOnly && <Chip icon={<IconLeaf size={12} />} label="Veg only" tone="green" />}
              {team.requireApprovalAboveRup != null && (
                <Chip icon={<IconShield size={12} />} label={`Approval > ${inr(team.requireApprovalAboveRup)}`} tone="amber" />
              )}
            </div>
          </div>

          <button onClick={create} className="wbtn w-full">
            <IconStore size={18} /> Create &amp; get share link <IconArrowRight size={18} />
          </button>
          <p className="text-[11px] text-ink-tertiary text-center">
            You'll get a link to share with the team. You can add your own dishes too.
          </p>
        </div>
      </div>
    </WorkShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide font-bold text-ink-tertiary">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
function Chip({ label, icon, tone = 'navy' }: { label: string; icon?: React.ReactNode; tone?: 'navy' | 'green' | 'amber' | 'red' }) {
  const cls =
    tone === 'green' ? 'bg-green-50 text-swiggy-green'
    : tone === 'amber' ? 'bg-amber-50 text-warning'
    : tone === 'red' ? 'bg-rose-50 text-swiggy-red'
    : 'bg-white text-ink-secondary border border-line-default';
  return <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${cls}`}>{icon}{label}</span>;
}
