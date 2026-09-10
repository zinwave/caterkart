import { ReactNode, RefObject, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconChevronDown } from '../icons/Icons';

/**
 * The shell every custom field (Select / DatePicker / TimePicker) is built on.
 *
 *   • desktop — an anchored popover under the trigger
 *   • mobile  — a bottom sheet with a dim backdrop and a grab handle
 *
 * The panel is rendered in a PORTAL on document.body, not next to its trigger.
 * That is not a style choice — an absolutely-positioned panel is trapped inside
 * its nearest stacking context, and any ancestor with `position: sticky`, a
 * `transform` (our `reveal` animation) or its own z-index creates one. Inside
 * such a context no z-index can lift the panel above later siblings, so the
 * dropdown rendered *behind* the cards below it. A portal has no ancestors to
 * be trapped by.
 */
const DESKTOP = '(min-width: 640px)';

export function Popover({
  open,
  onClose,
  anchorRef,
  title,
  children,
  align = 'left',
  width = 320,
}: {
  open: boolean;
  onClose: () => void;
  /** the field the panel hangs off, on desktop */
  anchorRef: RefObject<HTMLElement>;
  /** shown only on the mobile sheet, where there's no visual anchor */
  title?: string;
  children: ReactNode;
  align?: 'left' | 'right';
  /** desktop panel width in px; it never goes narrower than the trigger */
  width?: number;
}) {
  const [desktop, setDesktop] = useState(() => window.matchMedia(DESKTOP).matches);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean } | null>(
    null,
  );

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const onChange = () => setDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Position against the trigger, and keep it there while the page scrolls.
  useLayoutEffect(() => {
    if (!open || !desktop) return;

    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const w = Math.max(width, r.width);
      const GAP = 6;
      const PANEL_MAX = 340;

      const below = window.innerHeight - r.bottom;
      const up = below < PANEL_MAX + GAP && r.top > below; // flip when it won't fit

      let left = align === 'right' ? r.right - w : r.left;
      // Never let it hang off the viewport.
      left = Math.min(Math.max(8, left), window.innerWidth - w - 8);

      setPos({
        top: up ? r.top - GAP : r.bottom + GAP,
        left,
        width: w,
        up,
      });
    };

    place();
    window.addEventListener('scroll', place, true); // capture: catch scrolling containers too
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, desktop, align, width, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const panel = (
    <>
      {/* Backdrop: dim on mobile, an invisible click-catcher on desktop. */}
      <div
        className="fixed inset-0 z-[100] bg-black/40 sm:bg-transparent animate-fade-in"
        onClick={onClose}
      />

      <div
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        style={
          desktop && pos
            ? {
                top: pos.up ? undefined : pos.top,
                bottom: pos.up ? window.innerHeight - pos.top : undefined,
                left: pos.left,
                width: pos.width,
              }
            : undefined
        }
        className={[
          'z-[101] bg-white overflow-hidden flex flex-col',
          desktop
            ? 'fixed rounded-2xl border border-line-default shadow-pop max-h-[340px] animate-fade-in'
            : 'fixed inset-x-0 bottom-0 rounded-t-3xl shadow-floating max-h-[70vh] animate-fade-in-up',
        ].join(' ')}
      >
        {/* Grab handle + title — mobile only */}
        {!desktop && (
          <div className="pt-2.5 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-line-default mx-auto" />
            {title && (
              <div className="px-5 pt-3 pb-1 text-sm font-black tracking-tight text-ink-primary">
                {title}
              </div>
            )}
          </div>
        )}

        <div className="overflow-y-auto overscroll-contain flex-1">{children}</div>
      </div>
    </>
  );

  // Escape every ancestor stacking context.
  return createPortal(panel, document.body);
}

/**
 * The clickable field that opens a Popover. Looks like an input, behaves like a
 * button — so it can never summon the OS's own picker UI.
 */
export function FieldTrigger({
  icon,
  value,
  placeholder,
  open,
  disabled,
  onClick,
  className = '',
}: {
  icon?: ReactNode;
  value?: string;
  placeholder?: string;
  open: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  const empty = !value;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={open}
      className={`w-full flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-sm text-left transition outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
        open
          ? 'border-swiggy-orange ring-2 ring-orange-100'
          : 'border-line-default hover:border-orange-200'
      } ${className}`}
    >
      {icon && <span className="text-ink-tertiary shrink-0">{icon}</span>}
      <span
        className={`flex-1 min-w-0 truncate font-medium ${
          empty ? 'text-ink-tertiary font-normal' : 'text-ink-primary'
        }`}
      >
        {value || placeholder}
      </span>
      <IconChevronDown
        size={16}
        className={`text-ink-tertiary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
      />
    </button>
  );
}
