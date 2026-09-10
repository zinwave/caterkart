import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type ProfileMenuItem = {
  key: string;
  label: string;
  sublabel?: string;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
  active?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
};

/**
 * The one profile control used by /create and /work — identical avatar button
 * and dropdown structure so toggling modes causes no shift. Content differs
 * (personal = account menu, work = "sign in as"); structure is shared.
 */
export function ProfileMenu({
  initials,
  color,
  name,
  subtitle,
  tone = 'light',
  menuTitle,
  items,
}: {
  initials: string;
  color: string; // tailwind bg-* / gradient class for the avatar
  name: string;
  subtitle?: string;
  tone?: 'light' | 'dark';
  menuTitle?: string;
  items: ProfileMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const ring = tone === 'dark' ? 'ring-white/20' : 'ring-white';

  return (
    <div className="relative ml-1">
      <button
        onClick={() => setOpen((s) => !s)}
        aria-label="Account"
        className={`w-9 h-9 rounded-xl ${color} grid place-items-center text-white text-[13px] font-black ring-2 ${ring} shadow-pop active:scale-95 transition`}
      >
        {initials}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-64 bg-white text-ink-primary rounded-2xl shadow-pop border border-neutral-100 z-40 animate-fade-in-down overflow-hidden">
            <div className="px-4 py-4 bg-gradient-to-br from-orange-50 via-white to-rose-50 border-b border-neutral-100 flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl ${color} grid place-items-center text-white font-black shadow-pop`}>{initials}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold leading-tight truncate">{name}</div>
                {subtitle && <div className="text-[11px] text-neutral-500 truncate">{subtitle}</div>}
              </div>
            </div>

            {menuTitle && (
              <div className="px-4 pt-2.5 pb-1 text-[10px] uppercase tracking-widest font-black text-ink-tertiary">{menuTitle}</div>
            )}

            <div className="py-1 max-h-80 overflow-y-auto no-scrollbar">
              {items.map((it) => {
                const cls = `w-full flex items-center gap-2.5 px-4 py-2 text-sm text-left transition ${
                  it.danger ? 'text-red-600 hover:bg-red-50' : 'text-neutral-700 hover:bg-orange-50'
                } ${it.active ? 'bg-orange-50/70' : ''}`;
                const inner = (
                  <>
                    {it.leading}
                    <span className="flex-1 min-w-0">
                      <span className="block truncate font-medium">{it.label}</span>
                      {it.sublabel && <span className="block text-[10px] text-neutral-500 truncate capitalize">{it.sublabel}</span>}
                    </span>
                    {it.trailing}
                  </>
                );
                return it.to ? (
                  <Link key={it.key} to={it.to} onClick={() => setOpen(false)} className={cls}>{inner}</Link>
                ) : (
                  <button key={it.key} onClick={() => { it.onClick?.(); setOpen(false); }} className={cls}>{inner}</button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
