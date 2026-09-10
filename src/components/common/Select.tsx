import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Popover, FieldTrigger } from './Popover';
import { IconCheck, IconSearch } from '../icons/Icons';

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  /** second line — e.g. the full address under its label */
  sublabel?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

/**
 * Our own dropdown. Replaces every native <select> so the list is styled by us
 * rather than by the OS (which renders an unstyleable grey menu, and a full-screen
 * roller on iOS).
 *
 * Keyboard: ↑/↓ move, Enter/Space pick, Esc closes, typing filters when searchable.
 */
export default function Select<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  icon,
  disabled,
  searchable,
  title,
  align,
  className,
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  icon?: ReactNode;
  disabled?: boolean;
  /** show a filter box — worth it past ~8 options */
  searchable?: boolean;
  /** heading on the mobile sheet */
  title?: string;
  align?: 'left' | 'right';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const shown = useMemo(() => {
    const lc = q.trim().toLowerCase();
    if (!lc) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(lc) || (o.sublabel ?? '').toLowerCase().includes(lc),
    );
  }, [q, options]);

  // Open on the current value, not the top of the list.
  useEffect(() => {
    if (!open) {
      setQ('');
      return;
    }
    const i = shown.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : 0);
    if (searchable) setTimeout(() => searchRef.current?.focus(), 60);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the highlighted row in view while arrowing.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelectorAll('[data-opt]')
      ?.[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const pick = (o: SelectOption<T>) => {
    if (o.disabled) return;
    onChange(o.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(shown.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = shown[active];
      if (o) pick(o);
    }
  };

  return (
    <div ref={anchorRef} className={className} onKeyDown={onKeyDown}>
      <FieldTrigger
        icon={icon}
        value={selected?.label}
        placeholder={placeholder}
        open={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      />

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        title={title}
        align={align}
      >
        {searchable && (
          <div className="p-2 border-b border-line-subtle sticky top-0 bg-white z-10">
            <div className="relative">
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                placeholder="Search…"
                className="w-full bg-surface-secondary rounded-lg pl-8 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-100 transition"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-tertiary">
                <IconSearch size={14} />
              </span>
            </div>
          </div>
        )}

        <div ref={listRef} role="listbox" className="p-1.5">
          {shown.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-ink-tertiary">No matches</div>
          )}

          {shown.map((o, i) => {
            const isSel = o.value === value;
            const isActive = i === active;
            return (
              <button
                key={o.value}
                data-opt
                role="option"
                aria-selected={isSel}
                disabled={o.disabled}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
                className={`w-full text-left flex items-start gap-2.5 px-2.5 py-2.5 rounded-xl transition disabled:opacity-40 ${
                  isSel
                    ? 'bg-orange-50'
                    : isActive
                      ? 'bg-surface-secondary'
                      : 'hover:bg-surface-secondary'
                }`}
              >
                {o.icon && (
                  <span className={`shrink-0 mt-0.5 ${isSel ? 'text-swiggy-orange' : 'text-ink-tertiary'}`}>
                    {o.icon}
                  </span>
                )}
                <span className="flex-1 min-w-0">
                  <span
                    className={`block text-sm truncate ${
                      isSel ? 'font-bold text-swiggy-orange' : 'font-semibold text-ink-primary'
                    }`}
                  >
                    {o.label}
                  </span>
                  {o.sublabel && (
                    <span className="block text-[11px] text-ink-tertiary truncate mt-0.5">
                      {o.sublabel}
                    </span>
                  )}
                </span>
                {isSel && <IconCheck size={16} className="text-swiggy-orange shrink-0 mt-0.5" />}
              </button>
            );
          })}
        </div>
      </Popover>
    </div>
  );
}
