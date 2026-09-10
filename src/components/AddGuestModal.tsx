import { useMemo, useState, ComponentType } from 'react';
import { DietaryPref } from '../data/mock';
import { useCelebration } from '../state/CelebrationContext';
import type { Contact } from '../lib/api';
import { MemberAvatar } from './MemberAvatar';
import { DietMark } from './DietMark';
import {
  IconUsers, IconMail, IconPhone, IconClose, IconSearch, IconCheck, IconPlus,
  IconLink,
} from './icons/Icons';

type IconType = ComponentType<{ size?: number; className?: string }>;
type Tab = 'recent' | 'email' | 'phone';

const initialsFor = (name: string) => {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '?') + (p[1]?.[0] ?? '')).toUpperCase();
};

/**
 * Invite a guest.
 *
 * "Recent" is the host's REAL address book — everyone they have actually invited
 * to a past celebration (GET /api/celebrations/contacts). There is no seeded
 * friends list: a brand-new host sees an honest empty state and invites their
 * first guest by email or phone.
 *
 * Adding a guest creates them on the backend and mints a REAL invite link, which
 * we show for copying — that link is what the guest opens on their own phone.
 */
export default function AddGuestModal({ onClose }: { onClose: () => void }) {
  const { guests, contacts, contactsLoading, addGuestByContact } = useCelebration();

  const [tab, setTab] = useState<Tab>('recent');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** the link we just minted, shown so the host can send it */
  const [minted, setMinted] = useState<{
    name: string;
    url: string;
    contact: { type: 'email' | 'phone'; value: string };
  } | null>(null);

  const addedContacts = useMemo(
    () =>
      new Set(
        guests
          .map((g) => (g.contact?.value ?? g.name).toLowerCase())
          .filter(Boolean),
      ),
    [guests],
  );

  async function add(d: { name: string; contact: { type: 'email' | 'phone'; value: string } }) {
    setBusy(true);
    setError(null);
    try {
      const { inviteUrl } = await addGuestByContact(d);
      setMinted({ name: d.name, url: inviteUrl, contact: d.contact });
    } catch (e) {
      setError(
        e instanceof Error
          ? 'Could not create the invite. Is the API running?'
          : 'Could not create the invite.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/45 grid place-items-end sm:place-items-center animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:w-[520px] sm:rounded-2xl rounded-t-3xl max-h-[90vh] overflow-y-auto animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-100 sticky top-0 bg-white flex items-start gap-3 z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-50 to-rose-50 grid place-items-center text-swiggy-orange">
            <IconUsers size={22} />
          </div>
          <div className="flex-1">
            <div className="font-bold text-lg leading-tight">Invite a guest</div>
            <div className="text-xs text-neutral-500 mt-0.5">
              Pick someone you've invited before, or invite by email or phone.
            </div>
          </div>
          <button
            onClick={onClose}
            className="leading-none w-8 h-8 grid place-items-center rounded-full hover:bg-neutral-100"
          >
            <IconClose size={20} />
          </button>
        </div>

        {/* The link we just created — this is the whole point of the flow. */}
        {minted ? (
          <MintedLink
            name={minted.name}
            url={minted.url}
            contact={minted.contact}
            onAddAnother={() => setMinted(null)}
            onDone={onClose}
          />
        ) : (
          <>
            <div className="px-5 pt-4">
              <div className="inline-flex bg-neutral-100 rounded-xl p-1 w-full">
                <TabBtn
                  label="Recent"
                  icon={IconUsers}
                  active={tab === 'recent'}
                  onClick={() => setTab('recent')}
                />
                <TabBtn
                  label="Email"
                  icon={IconMail}
                  active={tab === 'email'}
                  onClick={() => setTab('email')}
                />
                <TabBtn
                  label="Phone"
                  icon={IconPhone}
                  active={tab === 'phone'}
                  onClick={() => setTab('phone')}
                />
              </div>
            </div>

            <div className="p-5">
              {error && (
                <div className="mb-3 text-[12px] font-semibold text-swiggy-red bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {tab === 'recent' && (
                <RecentTab
                  contacts={contacts}
                  loading={contactsLoading}
                  busy={busy}
                  addedContacts={addedContacts}
                  onPick={(c) =>
                    add({
                      name: c.name,
                      contact: c.email
                        ? { type: 'email', value: c.email }
                        : { type: 'phone', value: c.phone ?? '' },
                    })
                  }
                  onInviteNew={() => setTab('email')}
                />
              )}

              {(tab === 'email' || tab === 'phone') && (
                <ContactTab type={tab} busy={busy} onAdd={add} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TabBtn({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: IconType;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
        active ? 'bg-white shadow-card text-neutral-900' : 'text-neutral-600'
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

// ============ The real invite link ============
function MintedLink({
  name,
  url,
  contact,
  onAddAnother,
  onDone,
}: {
  name: string;
  url: string;
  contact: { type: 'email' | 'phone'; value: string };
  onAddAnother: () => void;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const message = `Hey ${name}! Join my celebration — pick your dishes here: ${url}`;
  // If we have their number, deep-link straight to that chat; else open a share.
  const digits = contact.value.replace(/[^0-9]/g, '');
  const whatsappHref =
    contact.type === 'phone' && digits
      ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
  const emailHref =
    `mailto:${contact.type === 'email' ? contact.value : ''}` +
    `?subject=${encodeURIComponent('Join my celebration')}&body=${encodeURIComponent(message)}`;

  return (
    <div className="p-5">
      <div className="w-12 h-12 rounded-2xl bg-green-50 text-swiggy-green grid place-items-center">
        <IconCheck size={24} />
      </div>
      <h3 className="mt-3 font-black text-lg tracking-tight">{name} is invited</h3>
      <p className="text-sm text-neutral-600 mt-1 leading-relaxed">
        Send them this link. They'll open it on their own phone — no app, no account — pick their
        dishes and set their own food preference, and their choices appear in your cart.
      </p>

      <div className="mt-4 flex gap-2">
        <div className="flex-1 min-w-0 bg-neutral-100 rounded-xl px-3 py-2.5 text-[12px] font-mono text-neutral-600 truncate">
          {url}
        </div>
        <button onClick={copy} className="btn-primary shrink-0 px-4">
          {copied ? (
            <>
              <IconCheck size={15} /> Copied
            </>
          ) : (
            <>
              <IconLink size={15} /> Copy
            </>
          )}
        </button>
      </div>

      {/* Send the link straight over WhatsApp or email */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] text-white font-bold text-sm py-2.5 hover:brightness-95 active:scale-[0.98] transition"
        >
          <IconPhone size={15} /> WhatsApp
        </a>
        <a
          href={emailHref}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border-2 border-line-default text-ink-primary font-bold text-sm py-2.5 hover:border-orange-200 active:scale-[0.98] transition"
        >
          <IconMail size={15} /> Email
        </a>
      </div>

      <div className="mt-5 flex gap-2">
        <button onClick={onAddAnother} className="btn-ghost flex-1">
          <IconPlus size={15} /> Invite another
        </button>
        <button onClick={onDone} className="btn-primary flex-1">
          Done
        </button>
      </div>
    </div>
  );
}

// ============ Recent (the host's REAL address book) ============
function RecentTab({
  contacts,
  loading,
  busy,
  addedContacts,
  onPick,
  onInviteNew,
}: {
  contacts: Contact[];
  loading: boolean;
  busy: boolean;
  addedContacts: Set<string>;
  onPick: (c: Contact) => void;
  onInviteNew: () => void;
}) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const lc = q.trim().toLowerCase();
    if (!lc) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(lc) ||
        (c.email ?? '').toLowerCase().includes(lc) ||
        (c.phone ?? '').includes(lc),
    );
  }, [q, contacts]);

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-neutral-500 flex items-center justify-center gap-2">
        <span className="w-4 h-4 rounded-full border-2 border-neutral-200 border-t-swiggy-orange animate-spin-slow" />
        Loading your contacts…
      </div>
    );
  }

  // An honest empty state — we do not invent friends.
  if (contacts.length === 0) {
    return (
      <div className="py-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-neutral-100 text-neutral-400 grid place-items-center mx-auto">
          <IconUsers size={26} />
        </div>
        <div className="mt-3 font-bold text-neutral-800">No one here yet</div>
        <p className="text-[13px] text-neutral-500 mt-1 max-w-xs mx-auto leading-relaxed">
          People you invite will show up here next time, so you can re-invite them in one tap.
        </p>
        <button onClick={onInviteNew} className="btn-primary mt-4">
          <IconMail size={15} /> Invite by email or phone
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search people you've invited…"
          className="w-full bg-neutral-100 rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-swiggy-orange/30 transition"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
          <IconSearch size={16} />
        </span>
      </div>

      <div className="space-y-1.5 max-h-[320px] overflow-y-auto -mx-1 px-1">
        {list.map((c) => {
          const key = (c.email || c.phone || c.name).toLowerCase();
          const added = addedContacts.has(key);
          return (
            <div
              key={key}
              className={`flex items-center gap-3 p-2 rounded-xl transition ${
                added ? 'bg-green-50/60' : 'hover:bg-neutral-50'
              }`}
            >
              <MemberAvatar
                m={{
                  id: key,
                  name: c.name,
                  initials: initialsFor(c.name),
                  color: 'bg-neutral-400',
                }}
                size={38}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold leading-tight">{c.name}</div>
                <div className="text-[11px] text-neutral-500 truncate">
                  {c.email || c.phone || 'No contact saved'}
                  {c.times > 1 && <> · {c.times} celebrations</>}
                </div>
              </div>
              <button
                onClick={() => !added && !busy && onPick(c)}
                disabled={added || busy}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition inline-flex items-center gap-1 disabled:opacity-60 ${
                  added
                    ? 'bg-swiggy-green text-white cursor-default'
                    : 'bg-white border-2 border-swiggy-orange text-swiggy-orange hover:bg-orange-50'
                }`}
              >
                {added ? (
                  <>
                    <IconCheck size={13} /> Added
                  </>
                ) : (
                  <>
                    <IconPlus size={13} /> Invite
                  </>
                )}
              </button>
            </div>
          );
        })}

        {list.length === 0 && (
          <div className="text-center text-sm text-neutral-500 py-8">
            No one matches "{q}".
            <br />
            <span className="text-xs">Try the email or phone tab.</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Email / Phone tab ============
function ContactTab({
  type,
  busy,
  onAdd,
}: {
  type: 'email' | 'phone';
  busy: boolean;
  onAdd: (d: { name: string; contact: { type: 'email' | 'phone'; value: string } }) => void;
}) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const valid = name.trim().length > 1 && value.trim().length > 4;

  // Contact Picker API — mobile browsers only (Android Chrome). Lets the host
  // pull a name + number straight from their phone book.
  const pickFromPhoneBook = async () => {
    setNote(null);
    const nav = navigator as unknown as {
      contacts?: { select?: (p: string[], o: { multiple: boolean }) => Promise<any[]> };
    };
    if (!nav.contacts?.select) {
      setNote('Phone-book access needs a mobile browser — type the number instead.');
      return;
    }
    try {
      const picked = await nav.contacts.select(['name', 'tel'], { multiple: false });
      const c = picked?.[0];
      if (c?.name?.[0]) setName(String(c.name[0]));
      if (c?.tel?.[0]) setValue(String(c.tel[0]));
    } catch {
      /* the host cancelled the picker */
    }
  };

  return (
    <div className="space-y-3">
      {type === 'phone' && (
        <button onClick={pickFromPhoneBook} className="btn-secondary w-full text-sm">
          <IconUsers size={15} /> Import from phone book
        </button>
      )}

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

      {note && <div className="text-[11px] text-ink-tertiary px-1">{note}</div>}

      <div className="text-[11px] text-neutral-500 bg-orange-50/60 border border-orange-100 rounded-lg p-2.5 leading-relaxed">
        We'll create a personal invite link. Send it over{' '}
        {type === 'email' ? 'email' : 'WhatsApp'} — they open it, pick dishes and set their own food
        preference, and their choices land in your cart. No app, no account.
      </div>

      <button
        disabled={!valid || busy}
        onClick={() => onAdd({ name: name.trim(), contact: { type, value: value.trim() } })}
        className="btn-primary w-full disabled:opacity-50 disabled:saturate-50 inline-flex items-center justify-center gap-1.5"
      >
        {busy ? (
          <>
            <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin-slow" />
            Creating invite…
          </>
        ) : (
          <>
            Create invite link {type === 'email' ? <IconMail size={16} /> : <IconPhone size={16} />}
          </>
        )}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card p-3">
      <div className="text-[11px] text-neutral-500 font-semibold uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function DietChip({ d }: { d?: DietaryPref }) {
  if (!d) return null;
  const map: Record<DietaryPref, { label: string; cls: string }> = {
    veg: { label: 'Veg', cls: 'bg-green-50 text-green-700' },
    'non-veg': { label: 'Non-veg', cls: 'bg-red-50 text-red-700' },
    jain: { label: 'Jain', cls: 'bg-amber-50 text-amber-700' },
    vegan: { label: 'Vegan', cls: 'bg-lime-50 text-lime-700' },
  };
  const m = map[d];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-semibold ${m.cls}`}
    >
      <DietMark d={d} size={11} />
      {m.label}
    </span>
  );
}
