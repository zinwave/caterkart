import { Restaurant } from '../data/mock';

type Props = {
  restaurants: Restaurant[];
  hasInstamart: boolean;
  partyTime: string; // HH:mm
};

export default function Timeline({ restaurants, hasInstamart, partyTime }: Props) {
  if (restaurants.length === 0) {
    return (
      <div className="card p-4 text-sm text-neutral-500">
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

  function fmt(min: number) {
    const [h, m] = partyTime.split(':').map(Number);
    const total = h * 60 + m + min;
    const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  return (
    <div className="card p-5 reveal">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-bold flex items-center gap-2">
            <span className="relative inline-flex w-2.5 h-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-swiggy-orange animate-pulse-ring" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-swiggy-orange" />
            </span>
            Synced delivery timeline
          </div>
          <div className="text-xs text-neutral-500 mt-0.5">
            Best-effort sync · all food arrives within ~5 min of each other
          </div>
        </div>
        <span className="chip chip-orange">Auto-coordinated</span>
      </div>

      <div className="space-y-4">
        {hasInstamart && (
          <Lane
            color="bg-swiggy-mart"
            badge="Instamart"
            badgeColor="bg-purple-100 text-swiggy-mart"
            label="Drinks · ice · plates · sides"
            arriveLabel={fmt(instamartArriveAt)}
            pct={Math.min(100, (instamartArriveAt / 50) * 100)}
            note="Arrives 15 min early — set the table before guests' food shows up"
            delay={0}
          />
        )}
        {lanes.map(({ r, placeAt, arriveAt }, i) => (
          <Lane
            key={r.id}
            color="bg-gradient-to-r from-swiggy-orange to-cater-coral"
            badge={r.name}
            badgeColor="bg-orange-100 text-swiggy-orange"
            label={r.cuisines.join(' · ')}
            arriveLabel={fmt(arriveAt)}
            pct={Math.min(100, (arriveAt / 50) * 100)}
            note={
              placeAt === 0
                ? 'Placed first — slowest kitchen'
                : `Placed +${placeAt} min later to sync arrival`
            }
            delay={(i + 1) * 80}
          />
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-dashed border-neutral-200 flex items-center justify-between">
        <span className="text-sm text-neutral-600">Everything ready by</span>
        <span className="font-bold text-lg text-shimmer">
          {fmt(arriveByMinutes)} 🎉
        </span>
      </div>
    </div>
  );
}

function Lane({
  color, badge, badgeColor, label, arriveLabel, pct, note, delay,
}: {
  color: string; badge: string; badgeColor: string; label: string;
  arriveLabel: string; pct: number; note: string; delay: number;
}) {
  return (
    <div className="reveal" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold ${badgeColor}`}>
          {badge}
        </span>
        <span className="text-neutral-500 truncate mx-2">{label}</span>
        <span className="font-mono text-neutral-700 font-semibold">{arriveLabel}</span>
      </div>
      <div className="relative h-2.5 bg-neutral-100 rounded-full overflow-hidden">
        <div
          className={`${color} h-2.5 rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
        <div
          className={`${color} absolute -top-1 w-4 h-4 rounded-full ring-2 ring-white shadow-md transition-all duration-700 ease-out`}
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>
      <div className="text-[11px] text-neutral-500 mt-1">{note}</div>
    </div>
  );
}
