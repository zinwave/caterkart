import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCelebration } from '../state/CelebrationContext';
import { useOrders } from '../state/OrdersContext';
import IconButton from './IconButton';
import {
  IconBell, IconChevronDown, IconHelp, IconMapPin, IconReceipt, IconSearch, LogoMark,
} from './icons/Icons';

const LOCATIONS = [
  'Indiranagar 100ft Rd, Bengaluru',
  'HSR Layout Sector 6, Bengaluru',
  'Koramangala 5th Block, Bengaluru',
  'Whitefield ITPL Main Rd, Bengaluru',
];

export default function Header() {
  const loc = useLocation();
  const nav = useNavigate();
  const { host, address, setAddress } = useCelebration();
  const { orders } = useOrders();

  const [locOpen, setLocOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const onHome = loc.pathname === '/';
  const activeOrdersCount = orders.filter(
    (o) => o.status !== 'delivered' && o.status !== 'cancelled'
  ).length;

  // Auto focus the search input when search opens
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [searchOpen]);

  return (
    <header className="sticky top-0 z-30">
      {/* Glass background with bottom hairline */}
      <div className="sticky-blur border-b border-neutral-200/60 shadow-[0_2px_12px_-8px_rgba(0,0,0,0.06)]">
        <div className="max-w-3xl mx-auto px-4 h-[68px] flex items-center gap-3">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0 active:scale-95 transition">
            <div className="relative">
              <LogoMark size={36} className="drop-shadow-[0_4px_10px_rgba(252,128,25,0.35)] transition-transform group-hover:scale-105 group-hover:rotate-[-4deg]" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-swiggy-green ring-2 ring-white animate-pulse-soft" />
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="font-black text-[17px] tracking-tight bg-gradient-to-r from-neutral-900 to-neutral-700 bg-clip-text text-transparent">
                cater<span className="text-swiggy-orange">kart</span>
              </div>
              <div className="powered-by mt-0.5">
                powered by <span className="pb-mark">S</span>
                <span className="text-swiggy-orange tracking-normal normal-case font-bold text-[10px]">Swiggy</span>
              </div>
            </div>
          </Link>

          {/* Vertical divider */}
          <div className="hidden sm:block w-px h-9 bg-neutral-200 mx-1" />

          {/* Location pill */}
          {!onHome && (
            <div className="relative flex-1 sm:flex-none min-w-0">
              <button
                onClick={() => setLocOpen((s) => !s)}
                className="w-full sm:w-auto flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-orange-50 transition group active:scale-[0.98]"
              >
                <IconMapPin size={18} className="text-swiggy-orange shrink-0" />
                <div className="text-left min-w-0">
                  <div className="text-[10px] uppercase tracking-wide font-bold text-neutral-500 leading-none">Deliver to</div>
                  <div className="text-sm font-bold text-neutral-800 truncate group-hover:text-swiggy-orange leading-tight max-w-[180px]">
                    {address.split(',')[0]}
                  </div>
                </div>
                <IconChevronDown size={14} className="text-neutral-400 shrink-0" />
              </button>

              {locOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setLocOpen(false)} />
                  <div className="absolute left-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-pop border border-neutral-100 z-40 animate-fade-in-down overflow-hidden">
                    <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-rose-50 border-b border-neutral-100">
                      <div className="text-[10px] uppercase tracking-widest font-black text-swiggy-orange">Delivery address</div>
                      <div className="text-sm font-bold mt-0.5">Where should we deliver?</div>
                    </div>
                    <div className="py-1.5">
                      {LOCATIONS.map((l) => {
                        const active = address === l;
                        return (
                          <button
                            key={l}
                            onClick={() => { setAddress(l); setLocOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 hover:bg-orange-50 flex items-start gap-2.5 transition ${
                              active ? 'bg-orange-50/80' : ''
                            }`}
                          >
                            <IconMapPin size={16} className={active ? 'text-swiggy-orange mt-0.5' : 'text-neutral-400 mt-0.5'} />
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm leading-tight ${active ? 'text-swiggy-orange font-bold' : 'text-neutral-800'}`}>
                                {l.split(',')[0]}
                              </div>
                              <div className="text-[11px] text-neutral-500 leading-tight mt-0.5">
                                {l.split(',').slice(1).join(',').trim()}
                              </div>
                            </div>
                            {active && <span className="text-swiggy-orange text-sm font-bold mt-0.5">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                    <div className="border-t border-neutral-100 p-2">
                      <button className="w-full text-left px-3 py-2 text-sm text-swiggy-orange font-bold hover:bg-orange-50 rounded-lg flex items-center gap-2">
                        <IconMapPin size={16} />
                        Add a new address
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Right cluster */}
          <div className="ml-auto flex items-center gap-1">
            <IconButton
              icon={<IconSearch size={20} />}
              label="Search"
              onClick={() => setSearchOpen(true)}
            />
            <IconButton
              icon={<IconReceipt size={20} />}
              label="Orders"
              to="/orders"
              badge={activeOrdersCount > 0 ? activeOrdersCount : undefined}
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

            {/* Profile chip */}
            <div className="relative ml-1">
              <button
                onClick={() => setProfileOpen((s) => !s)}
                className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-swiggy-orange via-cater-coral to-amber-500 grid place-items-center text-white font-black ring-2 ring-white shadow-pop hover:shadow-glow active:scale-95 transition-all"
              >
                {host.initials}
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-swiggy-green ring-2 ring-white" />
              </button>
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-pop border border-neutral-100 z-40 animate-fade-in-down overflow-hidden">
                    <div className="px-4 py-4 bg-gradient-to-br from-orange-50 via-white to-rose-50 border-b border-neutral-100 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-swiggy-orange to-cater-coral grid place-items-center text-white font-black shadow-pop">
                        {host.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold leading-tight truncate">{host.name}</div>
                        <div className="text-[11px] text-neutral-500 truncate">aarav@caterkart.in</div>
                      </div>
                    </div>
                    <div className="py-1">
                      <ProfileItem to="/orders" label="My orders" />
                      <ProfileItem label="Saved addresses" />
                      <ProfileItem label="Payment methods" />
                      <ProfileItem label="Settings" />
                      <div className="border-t border-neutral-100 my-1" />
                      <ProfileItem label="Sign out" danger />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Inline expanding search */}
        {searchOpen && (
          <div className="border-t border-neutral-200/60 bg-white animate-fade-in-down">
            <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
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
            <div className="max-w-3xl mx-auto px-4 pb-3 flex flex-wrap gap-1.5">
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

function ProfileItem({ label, to, danger }: { label: string; to?: string; danger?: boolean }) {
  const cls = `w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 transition ${
    danger ? 'text-red-600 hover:bg-red-50' : 'text-neutral-700'
  }`;
  if (to) return <Link to={to} className={cls}>{label}</Link>;
  return <button className={cls}>{label}</button>;
}
