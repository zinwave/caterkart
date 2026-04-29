import { useMemo, useState } from 'react';
import { friends as ALL_FRIENDS, DietaryPref, Friend } from '../data/mock';
import { useCelebration } from '../state/CelebrationContext';
import { MemberAvatar } from './MemberAvatar';

type Tab = 'friends' | 'email' | 'phone';

export default function AddGuestModal({ onClose }: { onClose: () => void }) {
  const {
    guests, addGuestFromFriend, addGuestByContact,
  } = useCelebration();

  const [tab, setTab] = useState<Tab>('friends');

  return (
    <div className="fixed inset-0 z-40 bg-black/45 grid place-items-end sm:place-items-center animate-fade-in" onClick={onClose}>
      <div
        className="bg-white w-full sm:w-[520px] sm:rounded-2xl rounded-t-3xl max-h-[90vh] overflow-y-auto animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-100 sticky top-0 bg-white flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-50 to-rose-50 grid place-items-center text-2xl">👥</div>
          <div className="flex-1">
            <div className="font-bold text-lg leading-tight">Invite a guest</div>
            <div className="text-xs text-neutral-500 mt-0.5">Pick from friends, or invite by email or phone.</div>
          </div>
          <button onClick={onClose} className="text-2xl leading-none w-8 h-8 grid place-items-center rounded-full hover:bg-neutral-100">×</button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-4">
          <div className="inline-flex bg-neutral-100 rounded-xl p-1 w-full">
            <TabBtn label="From friends" emoji="👋" active={tab === 'friends'} onClick={() => setTab('friends')} />
            <TabBtn label="Email" emoji="📧" active={tab === 'email'} onClick={() => setTab('email')} />
            <TabBtn label="Phone" emoji="📱" active={tab === 'phone'} onClick={() => setTab('phone')} />
          </div>
        </div>

        <div className="p-5">
          {tab === 'friends' && (
            <FriendsTab
              alreadyAdded={new Set(guests.map((g) => g.id))}
              onPick={(f) => { addGuestFromFriend(f); }}
              onDone={onClose}
              addedCount={guests.length}
            />
          )}
          {tab === 'email' && (
            <ContactTab
              type="email"
              onAdd={(d) => { addGuestByContact(d); onClose(); }}
            />
          )}
          {tab === 'phone' && (
            <ContactTab
              type="phone"
              onAdd={(d) => { addGuestByContact(d); onClose(); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ label, emoji, active, onClick }:
  { label: string; emoji: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
        active ? 'bg-white shadow-card text-neutral-900' : 'text-neutral-600'
      }`}
    >
      <span>{emoji}</span>{label}
    </button>
  );
}

// ============ Friends tab ============
function FriendsTab({
  alreadyAdded, onPick, onDone, addedCount,
}: {
  alreadyAdded: Set<string>;
  onPick: (f: Friend) => void;
  onDone: () => void;
  addedCount: number;
}) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const lc = q.trim().toLowerCase();
    return ALL_FRIENDS.filter((f) =>
      !lc || f.name.toLowerCase().includes(lc) || f.contact.value.includes(lc)
    );
  }, [q]);

  return (
    <div>
      <div className="relative mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search friends…"
          className="w-full bg-neutral-100 rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-swiggy-orange/30 transition"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">🔍</span>
      </div>
      <div className="space-y-1.5 max-h-[320px] overflow-y-auto -mx-1 px-1">
        {list.map((f) => {
          const added = alreadyAdded.has(f.id);
          return (
            <div
              key={f.id}
              className={`flex items-center gap-3 p-2 rounded-xl transition ${added ? 'bg-green-50/60' : 'hover:bg-neutral-50'}`}
            >
              <MemberAvatar m={{ id: f.id, name: f.name, initials: f.initials, color: f.color }} size={38} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold leading-tight">{f.name}</div>
                <div className="text-[11px] text-neutral-500 truncate">
                  {f.contact.value}{f.lastSeenWith && <> · <span className="italic">{f.lastSeenWith}</span></>}
                </div>
                <div className="mt-1">
                  <DietChip d={f.dietary} />
                </div>
              </div>
              <button
                onClick={() => !added && onPick(f)}
                disabled={added}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition ${
                  added
                    ? 'bg-swiggy-green text-white cursor-default'
                    : 'bg-white border-2 border-swiggy-orange text-swiggy-orange hover:bg-orange-50'
                }`}
              >
                {added ? '✓ Added' : '+ Invite'}
              </button>
            </div>
          );
        })}
        {list.length === 0 && (
          <div className="text-center text-sm text-neutral-500 py-8">
            No friends match "{q}".<br />
            <span className="text-xs">Try the email or phone tab.</span>
          </div>
        )}
      </div>

      <button
        onClick={onDone}
        className="btn-primary w-full mt-4"
      >
        {addedCount > 0 ? `Done · ${addedCount} guests added` : 'Close'}
      </button>
    </div>
  );
}

// ============ Email / Phone tab ============
function ContactTab({
  type, onAdd,
}: {
  type: 'email' | 'phone';
  onAdd: (d: {
    name: string;
    contact: { type: 'email' | 'phone'; value: string };
    dietary: DietaryPref;
    isKid: boolean;
  }) => void;
}) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [dietary, setDietary] = useState<DietaryPref>('non-veg');
  const [isKid, setIsKid] = useState(false);

  const valid = name.trim().length > 1 && value.trim().length > 4;

  return (
    <div className="space-y-3">
      <Field label="Guest name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Aisha Khan"
          className="w-full bg-transparent outline-none text-sm py-1"
        />
      </Field>
      <Field label={type === 'email' ? 'Email address' : 'Phone number'}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          type={type === 'email' ? 'email' : 'tel'}
          inputMode={type === 'email' ? 'email' : 'tel'}
          placeholder={type === 'email' ? 'name@example.com' : '+91 9XXXX XXXXX'}
          className="w-full bg-transparent outline-none text-sm py-1"
        />
      </Field>

      <div>
        <div className="text-[11px] uppercase tracking-wide font-semibold text-neutral-500 mb-1.5">Dietary preference</div>
        <div className="grid grid-cols-2 gap-2">
          <DietRadio label="Veg" emoji="🟢" v="veg" cur={dietary} set={setDietary} />
          <DietRadio label="Non-veg" emoji="🔴" v="non-veg" cur={dietary} set={setDietary} />
          <DietRadio label="Jain" emoji="🟡" v="jain" cur={dietary} set={setDietary} />
          <DietRadio label="Vegan" emoji="🌱" v="vegan" cur={dietary} set={setDietary} />
        </div>
      </div>

      <label className="card p-3 flex items-center gap-3 cursor-pointer hover:bg-neutral-50">
        <input
          type="checkbox"
          checked={isKid}
          onChange={(e) => setIsKid(e.target.checked)}
          className="w-4 h-4 accent-swiggy-orange"
        />
        <div className="flex-1">
          <div className="text-sm font-semibold">This guest is a kid</div>
          <div className="text-[11px] text-neutral-500">We'll suggest kid-friendly Instamart items and skip alcohol.</div>
        </div>
        <span className="text-2xl">🧒</span>
      </label>

      <div className="text-[11px] text-neutral-500 bg-orange-50/60 border border-orange-100 rounded-lg p-2.5 leading-relaxed">
        We'll send them an invite {type === 'email' ? 'email' : 'SMS'} with a link to pick their dishes. They get one tap to mark dietary & confirm.
      </div>

      <button
        disabled={!valid}
        onClick={() => onAdd({
          name: name.trim(),
          contact: { type, value: value.trim() },
          dietary,
          isKid,
        })}
        className="btn-primary w-full disabled:opacity-50 disabled:saturate-50"
      >
        Send invite {type === 'email' ? '📧' : '📱'}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card p-3">
      <div className="text-[11px] text-neutral-500 font-semibold uppercase tracking-wide">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function DietRadio({
  label, emoji, v, cur, set,
}: {
  label: string; emoji: string;
  v: DietaryPref; cur: DietaryPref;
  set: (d: DietaryPref) => void;
}) {
  const active = cur === v;
  return (
    <button
      type="button"
      onClick={() => set(v)}
      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border-2 transition ${
        active
          ? 'border-swiggy-orange bg-orange-50 text-swiggy-orange'
          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
      }`}
    >
      <span>{emoji}</span>{label}
    </button>
  );
}

export function DietChip({ d }: { d?: DietaryPref }) {
  if (!d) return null;
  const map: Record<DietaryPref, { label: string; emoji: string; cls: string }> = {
    'veg':     { label: 'Veg',     emoji: '🟢', cls: 'bg-green-50 text-green-700' },
    'non-veg': { label: 'Non-veg', emoji: '🔴', cls: 'bg-red-50 text-red-700' },
    'jain':    { label: 'Jain',    emoji: '🟡', cls: 'bg-amber-50 text-amber-700' },
    'vegan':   { label: 'Vegan',   emoji: '🌱', cls: 'bg-lime-50 text-lime-700' },
  };
  const m = map[d];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-semibold ${m.cls}`}>
      <span>{m.emoji}</span>{m.label}
    </span>
  );
}
