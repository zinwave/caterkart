import { useState } from 'react';
import WorkShell from '../components/WorkShell';
import { useWorkAuth, type WorkRole } from '../state/WorkAuthContext';
import { IconUsers, IconPlus, IconClose, IconShield, IconCheck } from '../components/icons/Icons';
import { Select } from '../components/common';

// =====================================================
// Organization & members — the admin's member console.
// Driven by the WorkAuth identity layer (mock, localStorage-backed).
// Admins can add members, change roles, and remove people.
// =====================================================
const ROLES: { value: WorkRole; label: string; hint: string }[] = [
  { value: 'admin', label: 'Admin', hint: 'Runs the org · budgets · billing' },
  { value: 'lead', label: 'Team lead', hint: 'Owns a team & its budget' },
  { value: 'member', label: 'Member', hint: 'Joins orders, picks food' },
];

export default function OrganizationSettings() {
  const { org, members, session, isAdmin, addMember, updateMemberRole, removeMember } = useWorkAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkRole>('member');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const domain = org?.emailDomain ?? '';
  const emailValid = /\S+@\S+\.\S+/.test(email);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setAdded(null);
    setBusy(true);
    try {
      const m = await addMember({ name, email, role });
      setAdded(m.name);
      setName(''); setEmail(''); setRole('member');
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not add member.');
    } finally {
      setBusy(false);
    }
  };

  const counts = {
    admin: members.filter((m) => m.role === 'admin').length,
    lead: members.filter((m) => m.role === 'lead').length,
    member: members.filter((m) => m.role === 'member').length,
  };

  return (
    <WorkShell>
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink-primary">Organization &amp; members</h1>
          <p className="text-sm text-ink-secondary mt-1">
            {isAdmin ? 'Add people, set roles, and manage who can order.' : 'Your organization roster.'}
          </p>
        </div>
        {org && (
          <div className="wcard px-4 py-3 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-surface-secondary grid place-items-center text-xl">{org.logoEmoji}</span>
            <div className="leading-tight">
              <div className="font-bold text-[15px] text-ink-primary">{org.name}</div>
              <div className="text-[11px] text-ink-tertiary">@{org.emailDomain} · <span className="capitalize">{org.plan}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Add member — admin only */}
      {isAdmin && (
        <div className="wcard p-5 mb-6">
          <div className="wsection mb-4">Add a member</div>
          <form onSubmit={submit} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <label className="block">
              <span className="wlabel">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={inputCls} />
            </label>
            <label className="block">
              <span className="wlabel">Work email</span>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder={`name@${domain || 'company.com'}`} className={inputCls}
              />
            </label>
            <label className="block">
              <span className="wlabel">Role</span>
              <Select
                value={role}
                onChange={(v) => setRole(v as WorkRole)}
                title="Role"
                options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
              />
            </label>
            <div className="sm:col-span-3">
              <button type="submit" disabled={!name.trim() || !emailValid || busy} className="wbtn-dark">
                <IconPlus size={17} /> {busy ? 'Adding…' : 'Add member'}
              </button>
              {added && (
                <span className="ml-3 text-[13px] font-semibold text-swiggy-green inline-flex items-center gap-1">
                  <IconCheck size={15} /> {added} added — they can sign in with OTP 1234
                </span>
              )}
              {err && <span className="ml-3 text-[13px] font-semibold text-swiggy-red">{err}</span>}
            </div>
          </form>
        </div>
      )}

      {/* Roster */}
      <div className="wcard overflow-hidden">
        <div className="px-5 py-3.5 border-b border-line-subtle flex items-center justify-between">
          <div className="wsection">
            <IconUsers size={15} /> {members.length} {members.length === 1 ? 'member' : 'members'}
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-semibold text-ink-tertiary">
            <span className="chip chip-navy">{counts.admin} admin</span>
            <span className="chip">{counts.lead} lead</span>
            <span className="chip">{counts.member} member</span>
          </div>
        </div>

        <ul className="divide-y divide-line-subtle">
          {members.map((m) => {
            const isSelf = m.id === session?.id;
            return (
              <li key={m.id} className="px-5 py-3 flex items-center gap-3">
                <span className={`w-9 h-9 rounded-full ${m.color} grid place-items-center text-white text-[12px] font-bold shrink-0`}>{m.initials}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink-primary truncate">
                    {m.name} {isSelf && <span className="text-[11px] font-bold text-ink-tertiary">(you)</span>}
                  </div>
                  <div className="text-[12px] text-ink-tertiary truncate">{m.email}</div>
                </div>

                {isAdmin && !isSelf ? (
                  <Select
                    value={m.role}
                    onChange={(v) => updateMemberRole(m.id, v as WorkRole)}
                    align="right"
                    title="Role"
                    className="w-32"
                    options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
                  />
                ) : (
                  <span className={`chip ${m.role === 'admin' ? 'chip-navy' : ''} capitalize`}>
                    {m.role === 'admin' && <IconShield size={12} />} {m.role}
                  </span>
                )}

                {isAdmin && !isSelf && (
                  <button
                    onClick={() => removeMember(m.id)}
                    title={`Remove ${m.name}`}
                    className="w-8 h-8 rounded-lg grid place-items-center text-ink-tertiary hover:bg-red-50 hover:text-swiggy-red transition"
                  >
                    <IconClose size={16} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {!isAdmin && (
        <p className="mt-4 text-[12px] text-ink-tertiary">
          Only admins can add or change members. Ask an admin at {org?.name} for access.
        </p>
      )}
    </WorkShell>
  );
}

const inputCls =
  'mt-1.5 w-full px-3 py-2.5 text-sm rounded-xl border border-line-default bg-white outline-none focus:ring-2 focus:ring-blue-100 focus:border-ink-primary transition';
