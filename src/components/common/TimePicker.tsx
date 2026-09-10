import { useEffect, useRef, useState } from 'react';
import { Popover, FieldTrigger } from './Popover';
import { IconClock } from '../icons/Icons';

/** "20:30" → { h: 8, m: 30, pm: true } */
function parse(v: string) {
  const [hh, mm] = (v || '20:00').split(':').map(Number);
  const h24 = Number.isFinite(hh) ? hh : 20;
  const m = Number.isFinite(mm) ? mm : 0;
  const pm = h24 >= 12;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return { h, m, pm };
}

/** Back to the 24h "HH:mm" the callers (and the native input) used. */
function toValue(h: number, m: number, pm: boolean) {
  let h24 = h % 12;
  if (pm) h24 += 12;
  return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const pretty = (v: string) => {
  const { h, m, pm } = parse(v);
  return `${h}:${String(m).padStart(2, '0')} ${pm ? 'PM' : 'AM'}`;
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

/**
 * Our own time picker. Replaces <input type="time">, whose UI is OS-drawn
 * (a stepper on desktop, a full-screen roller on iOS) and cannot be themed.
 *
 * Three scroll columns — hour / minute / AM-PM — which is the native wheel
 * pattern people already know, and each column auto-scrolls to its value.
 * Emits the same 24h "HH:mm" string, so callers don't change.
 */
export default function TimePicker({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const { h, m, pm } = parse(value);

  const set = (nh: number, nm: number, npm: boolean) => onChange(toValue(nh, nm, npm));

  return (
    <div ref={anchorRef} className={className}>
      <FieldTrigger
        icon={<IconClock size={15} />}
        value={value ? pretty(value) : undefined}
        placeholder="Pick a time"
        open={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      />

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        title="Pick a time"
        width={260}
      >
        <div className="p-3">
          <div className="flex gap-2">
            <Column
              label="Hour"
              items={HOURS.map((x) => ({ v: x, label: String(x) }))}
              value={h}
              onPick={(v) => set(v, m, pm)}
            />
            <Column
              label="Min"
              items={MINUTES.map((x) => ({ v: x, label: String(x).padStart(2, '0') }))}
              value={m}
              onPick={(v) => set(h, v, pm)}
            />
            <Column
              label=""
              items={[
                { v: 0, label: 'AM' },
                { v: 1, label: 'PM' },
              ]}
              value={pm ? 1 : 0}
              onPick={(v) => set(h, m, v === 1)}
            />
          </div>

          <button
            onClick={() => setOpen(false)}
            className="btn-primary w-full mt-3 !py-2 text-sm"
          >
            Done · {pretty(toValue(h, m, pm))}
          </button>
        </div>
      </Popover>
    </div>
  );
}

function Column({
  label,
  items,
  value,
  onPick,
}: {
  label: string;
  items: { v: number; label: string }[];
  value: number;
  onPick: (v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Scroll the selected row into view when the sheet opens.
  useEffect(() => {
    const el = ref.current?.querySelector('[data-sel="true"]');
    el?.scrollIntoView({ block: 'center' });
  }, []);

  return (
    <div className="flex-1 min-w-0">
      {label && (
        <div className="text-[10px] font-bold uppercase tracking-wide text-ink-tertiary text-center mb-1">
          {label}
        </div>
      )}
      {!label && <div className="h-[18px]" />}
      <div
        ref={ref}
        className="h-[132px] overflow-y-auto overscroll-contain rounded-xl bg-surface-secondary p-1 space-y-0.5" 
      >
        {items.map((it) => {
          const sel = it.v === value;
          return (
            <button
              key={it.v}
              data-sel={sel}
              onClick={() => onPick(it.v)}
              className={`w-full py-1.5 rounded-lg text-sm font-bold tabular-nums transition ${
                sel
                  ? 'bg-swiggy-orange text-white'
                  : 'text-ink-secondary hover:bg-white hover:text-ink-primary'
              }`}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
