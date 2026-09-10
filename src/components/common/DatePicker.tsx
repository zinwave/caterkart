import { useMemo, useRef, useState } from 'react';
import { Popover, FieldTrigger } from './Popover';
import { IconCalendar, IconChevronRight } from '../icons/Icons';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Local YYYY-MM-DD. NEVER toISOString() — that shifts the day across timezones. */
const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parse = (s?: string) => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const sameDay = (a: Date, b: Date) => toKey(a) === toKey(b);

function label(d: Date) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
}

/**
 * Our own calendar. Replaces <input type="date">, whose picker is drawn by the
 * browser/OS and cannot be themed (and on iOS takes over the screen).
 *
 * Value is a local `YYYY-MM-DD` string, matching what the native input produced,
 * so callers don't change.
 */
export default function DatePicker({
  value,
  onChange,
  /** default: today — a party can't be in the past */
  min = toKey(new Date()),
  disabled,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const selected = parse(value);
  const minDate = parse(min);

  const [cursor, setCursor] = useState(() => {
    const d = selected ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = first.getDay(); // leading blanks
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = Array.from({ length: start }, () => null);
    for (let i = 1; i <= days; i++) {
      cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), i));
    }
    return cells;
  }, [cursor]);

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const blocked = (d: Date) => !!minDate && toKey(d) < toKey(minDate);

  const pick = (d: Date) => {
    if (blocked(d)) return;
    onChange(toKey(d));
    setOpen(false);
  };

  const shiftMonth = (n: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));

  return (
    <div ref={anchorRef} className={className}>
      <FieldTrigger
        icon={<IconCalendar size={15} />}
        value={selected ? label(selected) : undefined}
        placeholder="Pick a date"
        open={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      />

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        title="Pick a date"
        width={300}
      >
        <div className="p-3">
          {/* Quick picks — what people actually choose */}
          <div className="flex gap-1.5 mb-3">
            {[
              { d: today, label: 'Today' },
              { d: tomorrow, label: 'Tomorrow' },
            ].map((q) => {
              const active = selected && sameDay(selected, q.d);
              return (
                <button
                  key={q.label}
                  onClick={() => pick(q.d)}
                  disabled={blocked(q.d)}
                  className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold transition disabled:opacity-40 ${
                    active
                      ? 'bg-swiggy-orange text-white'
                      : 'bg-surface-secondary text-ink-secondary hover:bg-orange-50 hover:text-swiggy-orange'
                  }`}
                >
                  {q.label}
                </button>
              );
            })}
          </div>

          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="w-8 h-8 rounded-lg grid place-items-center text-ink-tertiary hover:bg-surface-secondary hover:text-ink-primary transition"
            >
              <IconChevronRight size={16} className="rotate-180" />
            </button>
            <div className="text-sm font-bold text-ink-primary tabular-nums">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </div>
            <button
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="w-8 h-8 rounded-lg grid place-items-center text-ink-tertiary hover:bg-surface-secondary hover:text-ink-primary transition"
            >
              <IconChevronRight size={16} />
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d, i) => (
              <div
                key={i}
                className="text-[10px] font-bold uppercase text-ink-tertiary text-center py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-0.5">
            {grid.map((d, i) => {
              if (!d) return <div key={`b${i}`} />;
              const isSel = selected && sameDay(d, selected);
              const isToday = sameDay(d, today);
              const off = blocked(d);
              return (
                <button
                  key={toKey(d)}
                  onClick={() => pick(d)}
                  disabled={off}
                  className={`h-9 rounded-lg text-[13px] font-semibold tabular-nums transition ${
                    isSel
                      ? 'bg-swiggy-orange text-white shadow-card'
                      : off
                        ? 'text-ink-disabled cursor-not-allowed'
                        : isToday
                          ? 'text-swiggy-orange bg-orange-50 hover:bg-orange-100'
                          : 'text-ink-primary hover:bg-surface-secondary'
                  }`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      </Popover>
    </div>
  );
}
