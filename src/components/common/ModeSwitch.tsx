import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Shared Personal / Work product switch. Same component, same layout in both
 * shells — only the theme accent differs (Personal = Swiggy orange, Work = navy).
 * Reflects the current route and routes to `/create` or `/work` accordingly.
 *
 *  tone="light" → sits on the consumer (light) header
 *  tone="dark"  → sits on the corporate (navy) header
 */
export default function ModeSwitch({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const loc = useLocation();
  const nav = useNavigate();
  const isWork = loc.pathname.startsWith('/work');

  const container = tone === 'dark' ? 'bg-white/10' : 'bg-neutral-100';
  const inactive = tone === 'dark' ? 'text-white/55 hover:text-white/90' : 'text-neutral-500 hover:text-neutral-900';

  const seg = (mode: 'personal' | 'work', label: string, to: string) => {
    const active = mode === 'work' ? isWork : !isWork;
    const activeCls =
      mode === 'work'
        ? tone === 'dark'
          ? 'bg-white text-ink-primary'
          : 'bg-ink-primary text-white'
        : 'bg-swiggy-orange text-white';
    return (
      <button
        key={mode}
        onClick={() => !active && nav(to)}
        aria-pressed={active}
        className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold tracking-tight transition-colors ${active ? activeCls : inactive}`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className={`inline-flex items-center gap-0.5 p-0.5 rounded-full ${container}`}>
      {seg('personal', 'Personal', '/create')}
      {seg('work', 'Work', '/work')}
    </div>
  );
}
