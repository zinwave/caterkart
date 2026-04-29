import { useMemo, useState } from 'react';
import { useCelebration } from '../state/CelebrationContext';

type SplitMode = 'equal' | 'by-item';

export default function BillSplit() {
  const { carts, foodTotal, addonTotal, members, addonSelections, groupSize } =
    useCelebration();
  const [mode, setMode] = useState<SplitMode>('equal');

  const deliveryFee = 49;
  const platformFee = 6;
  const taxes = Math.round((foodTotal + addonTotal) * 0.05);
  const grand = foodTotal + addonTotal + deliveryFee + platformFee + taxes;

  // list of members who actually picked something
  const participatingMembers = useMemo(() => {
    const ids = new Set(carts.map((l) => l.pickedBy.id));
    return members.filter((m) => ids.has(m.id));
  }, [carts, members]);

  const equalSplitN = Math.max(participatingMembers.length, 1);
  const equalShare = Math.round(grand / equalSplitN);

  const byItem = useMemo(() => {
    const totals: Record<string, number> = {};
    carts.forEach((l) => {
      totals[l.pickedBy.id] = (totals[l.pickedBy.id] || 0) + l.dish.price * l.qty;
    });
    // distribute fees equally on top
    const sharedFees = deliveryFee + platformFee + taxes + addonTotal;
    const perPerson = sharedFees / Math.max(participatingMembers.length, 1);
    return participatingMembers.map((m) => ({
      member: m,
      amount: Math.round((totals[m.id] || 0) + perPerson),
    }));
  }, [carts, participatingMembers, addonTotal, taxes]);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Bill summary</div>
        <span className="chip chip-green">{groupSize} people</span>
      </div>

      <dl className="text-sm mt-3 space-y-1.5 text-neutral-700">
        <Row k="Food (across restaurants)" v={`₹${foodTotal}`} />
        <Row k="Instamart add-ons" v={`₹${addonTotal}`} faded={addonTotal === 0} />
        <Row k="Delivery (synced multi-pickup)" v={`₹${deliveryFee}`} />
        <Row k="Platform fee" v={`₹${platformFee}`} />
        <Row k="Taxes" v={`₹${taxes}`} />
      </dl>
      <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between">
        <div className="font-bold">Total</div>
        <div className="font-bold text-lg">₹{grand}</div>
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="font-semibold text-sm">Split with group</div>
          <div className="ml-auto inline-flex bg-neutral-100 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setMode('equal')}
              className={`px-3 py-1 rounded-md ${mode === 'equal' ? 'bg-white shadow-sm font-semibold' : ''}`}
            >Equal</button>
            <button
              onClick={() => setMode('by-item')}
              className={`px-3 py-1 rounded-md ${mode === 'by-item' ? 'bg-white shadow-sm font-semibold' : ''}`}
            >By what they ordered</button>
          </div>
        </div>

        <div className="space-y-2">
          {(mode === 'equal'
            ? participatingMembers.map((m) => ({ member: m, amount: equalShare }))
            : byItem
          ).map(({ member, amount }) => (
            <div key={member.id} className="flex items-center gap-3 py-1.5">
              <div className={`${member.color} w-8 h-8 rounded-full grid place-items-center text-white text-sm font-semibold`}>
                {member.initials}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{member.name}</div>
                <div className="text-[11px] text-neutral-500">
                  {member.isHost ? 'Host · pays balance if anyone bails' : 'UPI link will be sent'}
                </div>
              </div>
              <div className="font-semibold tabular-nums">₹{amount}</div>
              {!member.isHost && (
                <button className="text-xs px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                  UPI
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, faded }: { k: string; v: string; faded?: boolean }) {
  return (
    <div className={`flex justify-between ${faded ? 'opacity-50' : ''}`}>
      <dt>{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}
