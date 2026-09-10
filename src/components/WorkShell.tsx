import { ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCorporate } from '../state/CorporateContext';
import { useWorkAuth } from '../state/WorkAuthContext';
import { ModeSwitch, ProfileMenu, type ProfileMenuItem } from './common';
import { LogoMark, IconHome, IconReceipt, IconUsers, IconStore, IconShield, IconBolt, IconBuilding, SwiggyMark } from './icons/Icons';

// =====================================================
// CaterKart for Work — corporate console shell.
// Navy-forward chrome (vs the consumer orange header),
// role-aware nav, and the signed-in identity (WorkAuth).
// =====================================================

const ALL_TABS = [
  { to: '/work', label: 'Overview', icon: IconHome, end: true, adminOnly: false },
  { to: '/work/order', label: 'New order', icon: IconStore, end: false, adminOnly: false },
  { to: '/work/invoices', label: 'Invoices', icon: IconReceipt, end: false, adminOnly: false },
  { to: '/work/org', label: 'Organization', icon: IconUsers, end: false, adminOnly: false },
  { to: '/work/settings', label: 'Teams & budgets', icon: IconShield, end: false, adminOnly: true },
  { to: '/work/ops', label: 'Ops', icon: IconBolt, end: false, adminOnly: true },
];

export default function WorkShell({ children }: { children: ReactNode }) {
  const { company, loading } = useCorporate();
  const { session, org, roleLabel, isAdmin, signOut } = useWorkAuth();
  const loc = useLocation();
  const nav = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-secondary grid place-items-center">
        <div className="flex items-center gap-2 text-ink-tertiary text-sm font-semibold">
          <span className="w-4 h-4 rounded-full border-2 border-line-default border-t-swiggy-orange animate-spin-slow" />
          Loading workspace…
        </div>
      </div>
    );
  }

  if (!session) return null; // RequireWork guarantees a session; keeps types honest

  const tabs = ALL_TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(60rem 40rem at 50% -12%, rgba(10,37,64,0.06), transparent 62%),' +
          'linear-gradient(180deg, #F3F7FB 0%, #FAFBFD 38%, #F6F9FC 100%)',
      }}
    >
      <header className="sticky top-0 z-30">
        <div className="bg-ink-primary text-white shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
          <div className="max-w-5xl mx-auto px-5 h-16 flex items-center gap-4">
            <Link to="/work" className="flex items-center gap-2.5 shrink-0 transition-opacity hover:opacity-90">
              <LogoMark size={30} />
              <div className="leading-tight hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[15px] tracking-tight">Cater<span className="text-cater-coral">Kart</span></span>
                  <span className="w-px h-3.5 bg-white/15" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">for Work</span>
                </div>
                <div className="mt-0.5 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] font-bold text-white/40">
                  powered by <SwiggyMark size={14} />
                </div>
              </div>
            </Link>

            <div className="hidden md:block ml-4"><ModeSwitch tone="dark" /></div>

            <div className="ml-auto flex items-center gap-3.5">
              <div className="hidden sm:flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-white/[0.07] grid place-items-center text-sm leading-none">{org?.logoEmoji ?? company.logoEmoji}</span>
                <div className="leading-tight">
                  <div className="text-[13px] font-semibold tracking-tight">{org?.name ?? company.name}</div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-white/40 flex items-center gap-1.5 mt-0.5">
                    {company.plan}
                    <span className={`w-1 h-1 rounded-full ${company.billingLinked ? 'bg-swiggy-green' : 'bg-amber-400'}`} />
                  </div>
                </div>
              </div>

              <span className="hidden sm:block w-px h-7 bg-white/10" />

              <ProfileMenu
                tone="dark"
                initials={session.initials}
                color={session.color}
                name={session.name}
                subtitle={roleLabel}
                menuTitle={session.email}
                items={[
                  {
                    key: 'org',
                    label: 'Organization & members',
                    sublabel: isAdmin ? 'Add people · set roles' : 'View roster',
                    to: '/work/org',
                    leading: <span className="w-6 h-6 rounded-md bg-ink-primary text-white grid place-items-center shrink-0"><IconBuilding size={13} /></span>,
                  } as ProfileMenuItem,
                  { key: 'signout', label: 'Sign out', danger: true, onClick: () => { signOut(); nav('/work/login'); } },
                ]}
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="border-t border-white/[0.07]">
            <div className="max-w-5xl mx-auto px-5 flex items-center gap-0.5 overflow-x-auto no-scrollbar">
              {tabs.map((t) => {
                const active = t.end ? loc.pathname === t.to : loc.pathname.startsWith(t.to);
                const Icon = t.icon;
                return (
                  <NavLink
                    key={t.to}
                    to={t.to}
                    end={t.end}
                    className={`relative flex items-center gap-1.5 px-3.5 py-3 text-[13px] whitespace-nowrap transition-colors ${active ? 'text-white font-semibold' : 'text-white/45 hover:text-white/75 font-medium'}`}
                  >
                    <Icon size={15} />
                    {t.label}
                    {active && <span className="absolute left-3.5 right-3.5 -bottom-px h-[1.5px] rounded-full bg-white/90" />}
                  </NavLink>
                );
              })}
              {/* Personal switch lives in the top row via ModeSwitch; on small
                  screens (where the switch is hidden) keep a text fallback. */}
              <Link to="/create" className="md:hidden ml-auto text-[12px] font-medium text-white/35 hover:text-white/70 px-3 py-3 whitespace-nowrap transition-colors">← Personal</Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-7">{children}</main>
    </div>
  );
}

// Shared UI atoms ------------------------------------------------------------

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    issued: 'bg-blue-50 text-info',
    claimed: 'bg-orange-50 text-swiggy-orange',
    reconciled: 'bg-green-50 text-swiggy-green',
    void: 'bg-neutral-100 text-neutral-400',
    collecting: 'bg-amber-50 text-warning',
    placed: 'bg-green-50 text-swiggy-green',
    cancelled: 'bg-neutral-100 text-neutral-400',
    preparing: 'bg-amber-50 text-warning',
    'on-the-way': 'bg-purple-50 text-swiggy-mart',
    delivered: 'bg-green-50 text-swiggy-green',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold capitalize ${map[status] ?? 'chip'}`}>
      {status.replace(/-/g, ' ')}
    </span>
  );
}

export function BudgetBar({ spent, budget }: { spent: number; budget: number }) {
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const over = spent > budget;
  const color = over ? 'bg-swiggy-red' : pct > 75 ? 'bg-warning' : 'bg-swiggy-green';
  return (
    <div className="h-2 rounded-full bg-surface-tertiary overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.max(pct, 3)}%` }} />
    </div>
  );
}
