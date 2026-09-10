import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCelebration } from '../state/CelebrationContext';
import { useSwiggy } from '../state/SwiggyContext';
import { useOrders } from '../hooks/useSwiggyData';
import { usePersonalAuth, initialsFor } from '../state/PersonalAuthContext';
import IconButton from './IconButton';
import { ProfileMenu, type ProfileMenuItem } from './common';
import {
  IconBell, IconChevronDown, IconHelp, IconHome, IconMapPin, IconReceipt, IconSearch, IconStore, IconBriefcase, IconCheck, LogoMark,
} from './icons/Icons';

// Delivery addresses come from the user's real Swiggy account (SwiggyContext),
// not a hardcoded list — Swiggy owns the address book and requires the addressId.

export default function Header() {
  const loc = useLocation();
  const nav = useNavigate();
  const { host } = useCelebration();
  const { address, addresses, setAddressId, addressId } = useSwiggy();
  // Real Swiggy orders currently in flight.
  const { data: activeOrders } = useOrders(true);
  const { user, signOut } = usePersonalAuth();

  const [locOpen, setLocOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const onHome = loc.pathname === '/';
  const onCreate = loc.pathname === '/create';
  const activeOrdersCount = activeOrders.length;

  // Auto focus the search input when search opens
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [searchOpen]);

  return (
    <header className="sticky top-0 z-30">
      {/* Glass background with bottom hairline */}
      <div className="sticky-blur border-b border-neutral-200/60 shadow-[0_2px_12px_-8px_rgba(0,0,0,0.06)]">
        {/* Row 1 — brand · switch · icons (mirrors the Work header) */}
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center gap-3">
          {/*
            Brand — deliberately just the mark and the wordmark.
            The "Personal" tag was redundant (the ModeSwitch beside it already
            says Personal / Work) and "powered by Swiggy" already lives in the
            footer, so the header carried the same two claims twice.
          */}
          <Link
            to="/"
            className="flex items-center gap-2 group shrink-0 active:scale-95 transition"
          >
            <LogoMark
              size={30}
              className="drop-shadow-[0_4px_10px_rgba(252,128,25,0.35)] transition-transform group-hover:scale-105 group-hover:rotate-[-4deg]"
            />
            <span className="font-bold text-[17px] tracking-tight hidden sm:block leading-none">
              Cater<span className="text-swiggy-orange">Kart</span>
            </span>
          </Link>

          {/* Personal / Work switch removed for the demo (personal-only). */}

          {/* Right cluster */}
          <div className="ml-auto flex items-center gap-1">
            <IconButton
              icon={<IconSearch size={20} />}
              label="Search"
              onClick={() => setSearchOpen(true)}
            />
            <IconButton
              icon={<IconBell size={20} />}
              label="Notifications"
              dot
            />
            <IconButton
              icon={<IconHelp size={20} />}
              label="Help"
              className="hidden md:inline-grid"
            />

            <ProfileMenu
              initials={user ? initialsFor(user.name) : host.initials}
              color="bg-gradient-to-br from-swiggy-orange via-cater-coral to-amber-500"
              name={user?.name ?? host.name}
              subtitle={user ? `+91 ${user.phone}` : 'Guest'}
              items={[
                { key: 'orders', label: 'My orders', to: '/orders' } as ProfileMenuItem,
                { key: 'addr', label: 'Saved addresses' },
                { key: 'pay', label: 'Payment methods' },
                { key: 'settings', label: 'Settings' },
                {
                  key: 'work',
                  label: 'CaterKart for Work',
                  sublabel: 'Team lunches · one invoice',
                  to: '/work',
                  leading: <span className="w-6 h-6 rounded-md bg-ink-primary text-white grid place-items-center shrink-0"><IconBriefcase size={13} /></span>,
                },
                { key: 'signout', label: 'Sign out', danger: true, onClick: () => { signOut(); nav('/'); } },
              ]}
            />
          </div>
        </div>

        {/* Row 2 — tab strip: only on /create (work has its own tabs in WorkShell) */}
        {onCreate && (
        <div className="border-t border-neutral-200/60">
          <div className="max-w-5xl mx-auto px-5 flex items-center gap-0.5 overflow-x-auto no-scrollbar">
            {[
              { to: '/', label: 'Home', Icon: IconHome, end: true, badge: undefined as number | undefined },
              { to: '/create', label: 'New', Icon: IconStore, end: false, badge: undefined },
              { to: '/orders', label: 'Orders', Icon: IconReceipt, end: false, badge: activeOrdersCount > 0 ? activeOrdersCount : undefined },
            ].map((t) => {
              const active = t.end ? loc.pathname === t.to : loc.pathname.startsWith(t.to);
              return (
                <NavLink
                  key={t.to}
                  to={t.to}
                  end={t.end}
                  className={`relative flex items-center gap-1.5 px-3 py-2.5 text-[13px] whitespace-nowrap transition-colors ${active ? 'text-swiggy-orange font-semibold' : 'text-neutral-500 hover:text-neutral-900 font-medium'}`}
                >
                  <t.Icon size={15} />
                  {t.label}
                  {t.badge != null && <span className="text-[10px] font-bold bg-swiggy-orange text-white rounded-full px-1.5 py-0.5 leading-none">{t.badge}</span>}
                  {active && <span className="absolute left-3 right-3 -bottom-px h-[1.5px] rounded-full bg-swiggy-orange" />}
                </NavLink>
              );
            })}

            {!onHome && (
              <div className="relative ml-auto shrink-0">
                <button
                  onClick={() => setLocOpen((s) => !s)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-orange-50 transition group max-w-[200px]"
                >
                  <IconMapPin size={16} className="text-swiggy-orange shrink-0" />
                  <span className="text-[12px] font-semibold text-neutral-700 truncate group-hover:text-swiggy-orange">{address?.label ?? 'Pick address'}</span>
                  <IconChevronDown size={13} className="text-neutral-400 shrink-0" />
                </button>
                {locOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setLocOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-pop border border-neutral-100 z-40 animate-fade-in-down overflow-hidden">
                      <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-rose-50 border-b border-neutral-100">
                        <div className="text-[10px] uppercase tracking-widest font-black text-swiggy-orange">Delivery address</div>
                        <div className="text-sm font-bold mt-0.5">Where should we deliver?</div>
                      </div>
                      <div className="py-1.5">
                        {addresses.length === 0 && (
                          <div className="px-4 py-3 text-[12px] text-neutral-500">
                            No saved Swiggy addresses found on your account.
                          </div>
                        )}
                        {addresses.map((a) => {
                          const active = a.id === addressId;
                          return (
                            <button
                              key={a.id}
                              onClick={() => { setAddressId(a.id); setLocOpen(false); }}
                              className={`w-full text-left px-4 py-2.5 hover:bg-orange-50 flex items-start gap-2.5 transition ${active ? 'bg-orange-50/80' : ''}`}
                            >
                              <IconMapPin size={16} className={active ? 'text-swiggy-orange mt-0.5' : 'text-neutral-400 mt-0.5'} />
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm leading-tight ${active ? 'text-swiggy-orange font-bold' : 'text-neutral-800'}`}>{a.label}</div>
                                <div className="text-[11px] text-neutral-500 leading-tight mt-0.5 line-clamp-2">{a.display}</div>
                              </div>
                              {active && <IconCheck size={15} className="text-swiggy-orange mt-0.5 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                      <div className="border-t border-neutral-100 p-2">
                        <div className="px-3 py-2 text-[11px] text-neutral-500 leading-snug">
                          These are your saved Swiggy addresses. Add new ones in the Swiggy app.
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Inline expanding search */}
        {searchOpen && (
          <div className="border-t border-neutral-200/60 bg-white animate-fade-in-down">
            <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-2">
              <div className="flex-1 relative">
                <IconSearch size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  ref={searchInputRef}
                  placeholder="Search restaurants, dishes, or Instamart items…"
                  className="w-full bg-neutral-50 rounded-xl pl-10 pr-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-orange-100 focus:border-swiggy-orange border border-neutral-200 transition"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setSearchOpen(false);
                    if (e.key === 'Enter') { setSearchOpen(false); nav('/group'); }
                  }}
                />
              </div>
              <button
                onClick={() => setSearchOpen(false)}
                className="text-sm font-semibold text-neutral-600 px-3 py-2 hover:text-swiggy-orange"
              >
                Cancel
              </button>
            </div>
            <div className="max-w-5xl mx-auto px-5 pb-3 flex flex-wrap gap-1.5">
              <span className="text-[11px] text-neutral-500 uppercase tracking-wide font-semibold mr-1">Trending:</span>
              {['Biryani', 'Pizza', 'Cake', 'Beer', 'Ice cream'].map((q) => (
                <button
                  key={q}
                  className="text-xs px-2.5 py-1 rounded-full bg-neutral-100 hover:bg-orange-50 hover:text-swiggy-orange font-medium transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
