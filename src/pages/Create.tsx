import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useCelebration } from '../state/CelebrationContext';
import { MemberAvatar } from '../components/MemberAvatar';
import AddGuestModal, { DietChip } from '../components/AddGuestModal';
import { DietaryPref, Member } from '../data/mock';

export default function Create() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const {
    occasion, setOccasion, occasions,
    date, setDate, time, setTime,
    address, setAddress,
    host, setHostDietary,
    guests, removeGuest, updateGuest,
    inviteToken,
    groupSize, vegCount, nonVegCount, kidCount,
  } = useCelebration();

  const [openModal, setOpenModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewAs, setPreviewAs] = useState<string>('');
  const inviteLink = `swiggy.app/celebrate/${(occasion?.id || 'new').toUpperCase()}-${inviteToken}`;

  useEffect(() => {
    const oId = params.get('occasion');
    if (oId) {
      const o = occasions.find((x) => x.id === oId);
      if (o) setOccasion(o);
    } else if (!occasion) {
      setOccasion(occasions[0]);
    }
  }, [params]);

  const canContinue = guests.length > 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-28">
      <div className="text-sm text-neutral-500 reveal">Step 1 of 3</div>
      <h1 className="text-3xl font-black tracking-tight mt-1 reveal" style={{ animationDelay: '40ms' }}>
        Set up your <span className="text-shimmer">celebration</span>
      </h1>

      {/* Occasion picker */}
      <div className="mt-6 reveal" style={{ animationDelay: '90ms' }}>
        <label className="text-sm font-semibold">Occasion</label>
        <div className="flex gap-2 overflow-x-auto no-scrollbar mt-2 pb-2">
          {occasions.map((o) => (
            <button
              key={o.id}
              onClick={() => setOccasion(o)}
              className={`shrink-0 px-3.5 py-2 rounded-full border text-sm flex items-center gap-1.5 transition active:scale-95 ${
                occasion?.id === o.id
                  ? 'bg-orange-50 border-swiggy-orange text-swiggy-orange font-semibold shadow-card'
                  : 'bg-white border-neutral-200 text-neutral-700'
              }`}
            >
              <span>{o.emoji}</span>{o.name}
            </button>
          ))}
        </div>
      </div>

      {/* Date / Time / Address */}
      <div className="grid sm:grid-cols-2 gap-3 mt-4 reveal" style={{ animationDelay: '150ms' }}>
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full bg-transparent outline-none text-sm py-1" />
        </Field>
        <Field label="Party time">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
            className="w-full bg-transparent outline-none text-sm py-1" />
        </Field>
      </div>

      <div className="mt-3 reveal" style={{ animationDelay: '180ms' }}>
        <Field label="Delivery address">
          <div className="flex items-center gap-2">
            <span className="text-lg">📍</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm py-1"
            />
          </div>
        </Field>
      </div>

      {/* Host dietary */}
      <div className="mt-5 reveal" style={{ animationDelay: '210ms' }}>
        <div className="flex items-baseline justify-between">
          <label className="text-sm font-semibold">You (host) — your dietary preference</label>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-2">
          {(['veg', 'non-veg', 'jain', 'vegan'] as DietaryPref[]).map((d) => (
            <button
              key={d}
              onClick={() => setHostDietary(d)}
              className={`px-2 py-2 rounded-lg text-xs font-bold border-2 transition flex items-center justify-center gap-1 ${
                host.dietary === d
                  ? 'border-swiggy-orange bg-orange-50 text-swiggy-orange'
                  : 'border-neutral-200 bg-white text-neutral-700'
              }`}
            >
              <DietChip d={d} />
            </button>
          ))}
        </div>
      </div>

      {/* GUESTS SECTION */}
      <div className="mt-7 reveal" style={{ animationDelay: '240ms' }}>
        <div className="flex items-baseline justify-between">
          <div>
            <div className="section-title">Guests</div>
            <h2 className="mt-1 text-xl font-bold">
              Who's coming? <span className="text-neutral-400 font-normal text-base">({groupSize} so far)</span>
            </h2>
          </div>
          <button
            onClick={() => setOpenModal(true)}
            className="btn-secondary text-sm"
          >
            + Add guest
          </button>
        </div>

        {/* Counters */}
        {guests.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 animate-fade-in">
            <Counter emoji="👥" label="Total" value={groupSize} />
            <Counter emoji="🟢" label="Veg" value={vegCount} accent="text-green-700 bg-green-50" />
            <Counter emoji="🔴" label="Non-veg" value={nonVegCount} accent="text-red-700 bg-red-50" />
            {kidCount > 0 && <Counter emoji="🧒" label="Kids" value={kidCount} accent="text-amber-700 bg-amber-50" />}
          </div>
        )}

        {/* Host card (always shown) */}
        <div className="mt-4 card p-3 flex items-center gap-3 border-orange-200 bg-orange-50/40">
          <MemberAvatar m={host} size={42} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold flex items-center gap-2">
              {host.name}
              <span className="chip chip-orange">Host</span>
            </div>
            <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 mt-0.5">
              <DietChip d={host.dietary} /> · always ready
            </div>
          </div>
          <span className="text-swiggy-green text-xs font-bold">✓ Ready</span>
        </div>

        {/* Guest list / empty state */}
        {guests.length === 0 ? (
          <EmptyGuestsState onClick={() => setOpenModal(true)} />
        ) : (
          <div className="mt-3 space-y-2">
            {guests.map((g, i) => (
              <GuestRow
                key={g.id}
                g={g}
                onRemove={() => removeGuest(g.id)}
                onToggleKid={() => updateGuest(g.id, { isKid: !g.isKid })}
                index={i}
              />
            ))}
          </div>
        )}
      </div>

      {/* Invite link */}
      {guests.length > 0 && (
        <div className="card p-4 mt-5 reveal animate-fade-in-up">
          <div className="flex items-baseline justify-between">
            <div className="font-semibold text-sm">Invite link</div>
            <span className="chip chip-orange">{guests.length} sent</span>
          </div>
          <div className="mt-2 p-3 bg-neutral-50 rounded-lg flex items-center gap-2">
            <span className="text-sm">🔗</span>
            <code className="flex-1 text-xs text-neutral-700 truncate">{inviteLink}</code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(inviteLink);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="text-xs font-semibold px-3 py-1.5 rounded-md bg-swiggy-orange text-white"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Preview-as-guest demo */}
          <div className="mt-3 bg-purple-50/60 border border-purple-100 rounded-lg p-3">
            <div className="text-xs font-semibold text-swiggy-mart flex items-center gap-1">
              👀 Preview as a guest
            </div>
            <div className="text-[11px] text-neutral-600 mt-0.5 mb-2">
              See exactly what your invitees will see when they tap the link.
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={previewAs}
                onChange={(e) => setPreviewAs(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-md bg-white border border-neutral-200 outline-none"
              >
                <option value="">Choose guest…</option>
                {guests.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}{g.isKid ? ' 🧒' : ''}</option>
                ))}
              </select>
              <Link
                to={`/invite/${inviteToken}${previewAs ? `?as=${previewAs}` : ''}`}
                className={`text-xs font-bold px-3 py-1.5 rounded-md transition ${
                  previewAs
                    ? 'bg-swiggy-mart text-white'
                    : 'bg-neutral-200 text-neutral-400 pointer-events-none'
                }`}
              >
                Open invite link →
              </Link>
            </div>
          </div>
        </div>
      )}

      {openModal && <AddGuestModal onClose={() => setOpenModal(false)} />}

      {/* Sticky footer */}
      <div className="fixed inset-x-0 bottom-0 sticky-blur border-t border-neutral-200 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1 text-xs text-neutral-600">
            {canContinue
              ? <>You + <b>{guests.length}</b> guest{guests.length === 1 ? '' : 's'}</>
              : <span className="text-neutral-500">Add at least 1 guest to continue.</span>}
          </div>
          <button
            disabled={!canContinue}
            onClick={() => nav('/group')}
            className="btn-primary disabled:opacity-50 disabled:saturate-50"
          >
            Continue to menu →
          </button>
        </div>
      </div>
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

function Counter({ emoji, label, value, accent }: {
  emoji: string; label: string; value: number; accent?: string;
}) {
  return (
    <div className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${accent ?? 'bg-neutral-100 text-neutral-700'}`}>
      <span>{emoji}</span>
      <span>{label}</span>
      <span className="bg-white/70 rounded px-1 tabular-nums">{value}</span>
    </div>
  );
}

function EmptyGuestsState({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-4 w-full p-6 rounded-2xl border-2 border-dashed border-neutral-200 hover:border-swiggy-orange hover:bg-orange-50/40 transition group text-center"
    >
      <div className="text-4xl mb-2 group-hover:animate-float">👯</div>
      <div className="font-semibold">No guests yet</div>
      <div className="text-xs text-neutral-500 mt-1">
        Tap to add your first guest from friends, email, or phone.
      </div>
      <span className="inline-flex items-center gap-1 mt-3 text-xs font-bold text-swiggy-orange">
        + Add a guest
      </span>
    </button>
  );
}

function GuestRow({
  g, onRemove, onToggleKid, index,
}: { g: Member; onRemove: () => void; onToggleKid: () => void; index: number }) {
  const status = g.status ?? 'invited';
  const statusMeta: Record<string, { label: string; emoji: string; cls: string }> = {
    invited: { label: 'Invite sent', emoji: '✉️', cls: 'text-neutral-500' },
    joined:  { label: 'Joined',     emoji: '👋', cls: 'text-blue-600' },
    picking: { label: 'Picking…',   emoji: '⏳', cls: 'text-amber-600' },
    ready:   { label: 'Ready',      emoji: '✓',  cls: 'text-swiggy-green' },
  };
  const sm = statusMeta[status];

  return (
    <div className="card p-3 flex items-center gap-3 reveal" style={{ animationDelay: `${index * 40}ms` }}>
      <MemberAvatar m={g} size={40} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold leading-tight truncate flex items-center gap-1.5">
          {g.name}
          {g.isKid && <span className="text-xs">🧒</span>}
          {g.fromFriend && <span className="text-[10px] text-neutral-400">· friend</span>}
        </div>
        <div className="text-[11px] text-neutral-500 truncate flex items-center gap-1 mt-0.5">
          {g.contact?.type === 'email' ? '📧' : '📱'} {g.contact?.value}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <DietChip d={g.dietary} />
          <span className={`text-[10px] font-semibold flex items-center gap-1 ${sm.cls}`}>
            {sm.emoji} {sm.label}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <button
          onClick={onToggleKid}
          title={g.isKid ? 'Mark as adult' : 'Mark as kid'}
          className={`text-[11px] px-2 py-1 rounded-md font-semibold transition ${
            g.isKid
              ? 'bg-amber-100 text-amber-700'
              : 'bg-neutral-100 text-neutral-500 hover:bg-amber-50 hover:text-amber-700'
          }`}
        >
          {g.isKid ? '🧒 Kid' : '+ Kid'}
        </button>
        <button
          onClick={onRemove}
          className="text-[11px] text-red-500 hover:text-red-700 px-2 py-1 rounded-md hover:bg-red-50"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
