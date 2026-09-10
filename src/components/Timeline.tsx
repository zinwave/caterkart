import type { Restaurant } from '../lib/mcp/types';
import { IconGift } from './icons/Icons';

type Props = {
  restaurants: Restaurant[];
  hasInstamart: boolean;
  partyTime: string; // HH:mm
};

/**
 * The staggered placement plan.
 *
 * Swiggy has no scheduled delivery, so "synced arrival" is really "staggered
 * placement": the slowest kitchen is ordered first, and quicker ones are held
 * back by the ETA difference so everything lands together.
 */
export default function Timeline({ restaurants, hasInstamart, partyTime }: Props) {
  if (restaurants.length === 0) {
    return (
      <div className="card p-4 text-sm text-ink-tertiary">
        Add some dishes to see the synced delivery timeline.
      </div>
    );
  }

  const slowest = Math.max(...restaurants.map((r) => r.etaMin));
  const arriveByMinutes = slowest;

  const lanes = restaurants.map((r) => {
    const placeAt = slowest - r.etaMin;
    const arriveAt = placeAt + r.etaMin;
    return { r, placeAt, arriveAt };
  });

  const instamartArriveAt = Math.max(arriveByMinutes - 15, 8);

  // Scale the bars to the actual window, not a magic 50 minutes.
  const span = Math.max(arriveByMinutes, 1);

  function fmt(min: number) {
    const [h, m] = partyTime.split(':').map(Number);
    const total = h * 60 + m + min;
    const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="font-bold flex items-center gap-2">
            <span className="relative inline-flex w-2.5 h-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-swiggy-orange animate-pulse-ring" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-swiggy-orange" />
            </span>
            Synced delivery timeline
          </div>
          <div className="text-xs text-ink-tertiary mt-0.5">
            Slowest kitchen goes first; quicker ones are held back so everything lands together.
          </div>
        </div>
        <span className="chip chip-orange shrink-0">Auto-coordinated</span>
      </div>

      <div className="space-y-4">
        {hasInstamart && (
          <Lane
            color="bg-swiggy-mart"
            badge="Instamart"
            badgeColor="bg-purple-100 text-swiggy-mart"
            label="Drinks · ice · plates · sides"
            arriveLabel={fmt(instamartArriveAt)}
            pct={(instamartArriveAt / span) * 100}
            note="Arrives ~15 min early — set the table before the food shows up"
          />
        )}
        {lanes.map(({ r, placeAt, arriveAt }) => (
          <Lane
            key={r.id}
            color="bg-gradient-to-r from-swiggy-orange to-cater-coral"
            badge={r.name}
            badgeColor="bg-orange-100 text-swiggy-orange"
            label={r.cuisines.join(' · ')}
            arriveLabel={fmt(arriveAt)}
            pct={(arriveAt / span) * 100}
            note={
              placeAt === 0
                ? 'Placed first — slowest kitchen'
                : `Held back ${placeAt} min so it arrives with the rest`
            }
          />
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-dashed border-line-default flex items-center justify-between gap-2">
        <span className="text-sm text-ink-secondary">Everything ready by</span>
        <span className="font-bold text-lg text-shimmer inline-flex items-center gap-1 shrink-0">
          {fmt(arriveByMinutes)} <IconGift size={14} />
        </span>
      </div>
    </div>
  );
}

function Lane({
  color,
  badge,
  badgeColor,
  label,
  arriveLabel,
  pct,
  note,
}: {
  color: string;
  badge: string;
  badgeColor: string;
  label: string;
  arriveLabel: string;
  pct: number;
  note: string;
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));

  return (
    <div>
      <div className="flex items-center gap-2 text-xs mb-1.5">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold truncate max-w-[45%] ${badgeColor}`}
        >
          {badge}
        </span>
        <span className="text-ink-tertiary truncate flex-1 min-w-0">{label}</span>
        <span className="font-mono text-ink-secondary font-semibold shrink-0">{arriveLabel}</span>
      </div>

      {/*
        The knob is 16px and sits proud of the 10px track, so it must NOT live
        inside the overflow-hidden box — that clipped its top edge and sliced it
        in half at 100%. Clip only the FILL; float the knob in a taller wrapper
        and clamp it so it can never hang off either end.
      */}
      <div className="relative h-4 flex items-center">
        <div className="h-2.5 w-full bg-surface-tertiary rounded-full overflow-hidden">
          <div
            className={`${color} h-full rounded-full transition-all duration-700 ease-out`}
            style={{ width: `${clamped}%` }}
          />
        </div>
        <div
          className={`${color} absolute top-0 w-4 h-4 rounded-full ring-2 ring-white shadow-md transition-all duration-700 ease-out`}
          style={{ left: `clamp(0px, calc(${clamped}% - 8px), calc(100% - 16px))` }}
        />
      </div>

      <div className="text-[11px] text-ink-tertiary mt-1">{note}</div>
    </div>
  );
}
