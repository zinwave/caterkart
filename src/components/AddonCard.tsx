import { AddonItem } from '../data/mock';

export default function AddonCard({
  a,
  selected,
  onToggle,
}: {
  a: AddonItem;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`card card-hover p-3 flex gap-3 items-start cursor-pointer ${
        selected ? 'ring-2 ring-swiggy-mart bg-purple-50/40 -translate-y-0.5 shadow-pop' : ''
      }`}
      onClick={onToggle}
    >
      <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 grid place-items-center text-2xl shrink-0">
        {selected && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-swiggy-mart text-white text-[11px] font-bold grid place-items-center ring-2 ring-white animate-pop">
            ✓
          </span>
        )}
        {a.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold leading-tight">{a.name}</div>
        <div className="text-xs text-neutral-500">{a.unit} · <span className="font-medium text-neutral-700">₹{a.price}</span></div>
        <div className="text-[11px] mt-1 text-swiggy-mart leading-snug flex items-start gap-1">
          <span>💡</span><span>{a.reason}</span>
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-bold transition-all active:scale-95 ${
          selected
            ? 'bg-swiggy-mart text-white shadow-md'
            : 'bg-white border-2 border-swiggy-mart text-swiggy-mart hover:bg-purple-50'
        }`}
      >
        {selected ? 'Added' : 'Add'}
      </button>
    </div>
  );
}
