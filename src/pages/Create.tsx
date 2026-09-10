import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCelebration } from '../state/CelebrationContext';
import { useSwiggy } from '../state/SwiggyContext';
import { MemberAvatar } from '../components/MemberAvatar';
import { OccasionIcon } from '../components/OccasionIcon';
import AddGuestModal from '../components/AddGuestModal';
import { Select, DatePicker, TimePicker } from '../components/common';
import { GuestStatus, Member } from '../data/mock';
import {
  IconPlus, IconCheck, IconArrowRight, IconUsers,
  IconLink, IconMapPin, IconClose, IconGift, IconRefresh,
} from '../components/icons/Icons';

/**
 * Step 1 — set up the celebration and invite people.
 *
 * One list, one truth: each guest row carries their live status AND their real
 * invite link. (The old page listed every guest twice — once as a row, then
 * again in a separate "invite links" card.)
 */
export default function Create() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const {
    occasion, setOccasion, occasions,
    eventName, setEventName,
    date, setDate, time, setTime,
    host,
    guests, removeGuest,
    inviteLinks, shareLink, createShareLink, syncing,
    groupSize,
  } = useCelebration();
  const { addresses, addressId, setAddressId, address, refresh, loadingAddresses } = useSwiggy();

  const [openModal, setOpenModal] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);


  // Occasion isn't asked for any more, but downstream pages read it — default it.
  useEffect(() => {
    const oId = params.get('occasion');
    const o = oId ? occasions.find((x) => x.id === oId) : null;
    if (o) setOccasion(o);
    else if (!occasion) setOccasion(occasions[0]);
  }, [params]);

  const readyCount = guests.filter((g) => g.status === 'ready').length;
  const canContinue = guests.length > 0 && !!addressId;

  return (
    <div className="max-w-5xl mx-auto px-5 py-5 pb-24">
      {/* ── Header ── */}
      <header className="reveal">
        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white border border-line-default shadow-card">
          <span className="w-1.5 h-1.5 rounded-full bg-swiggy-orange animate-pulse-soft" />
          <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-ink-secondary">
            Step 1 of 3 · Set up
          </span>
        </div>
        <h1 className="mt-2 text-[26px] sm:text-4xl font-black tracking-tight text-ink-primary leading-[1.05]">
          Plan the <span className="text-navy-orange">get-together</span>
        </h1>
        <p className="mt-1.5 text-[13px] text-ink-secondary max-w-xl leading-snug">
          House party, birthday, a trip — pick when and where, invite the crew.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]">
          <span className="font-bold text-swiggy-orange bg-orange-50 rounded-md px-2 py-0.5">
            Everyone orders their own
          </span>
          <span className="font-bold text-swiggy-green bg-green-50 rounded-md px-2 py-0.5">
            Arrives together
          </span>
          <span className="font-bold text-blue-600 bg-blue-50 rounded-md px-2 py-0.5">
            Easy bill split
          </span>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-4 mt-4 items-start">
      {/* ── When & where ── */}
      <section className="card p-4 reveal lg:sticky lg:top-24" style={{ animationDelay: '60ms' }}>
        {/* Name this event — free text, falls back to the event type */}
        <div className="mb-3">
          <Labelled label="Event name">
            <input
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder={occasion ? `e.g. ${occasion.name} with friends` : 'Name your event'}
              maxLength={60}
              className="w-full rounded-lg border border-line-default px-3 py-2.5 text-sm outline-none focus:border-swiggy-orange focus:ring-2 focus:ring-orange-100 placeholder:text-ink-tertiary"
            />
          </Labelled>
        </div>

        {/* What are we celebrating — drives the Instamart essentials shelf */}
        <div className="mb-3">
          <Labelled label="Event type">
            <Select
              value={occasion?.id ?? ''}
              onChange={(id) => {
                const o = occasions.find((x) => x.id === id);
                if (o) setOccasion(o);
              }}
              title="Event type"
              icon={
                occasion ? (
                  <OccasionIcon icon={occasion.icon} size={16} />
                ) : (
                  <IconGift size={15} />
                )
              }
              placeholder="Pick an event type"
              options={occasions.map((o) => ({
                value: o.id,
                label: o.name,
                sublabel: o.blurb,
                icon: <OccasionIcon icon={o.icon} size={16} />,
              }))}
            />
          </Labelled>
          {occasion?.essentials?.length ? (
            <p className="text-[11px] text-ink-tertiary mt-1.5 leading-snug">
              We'll pre-load {occasion.name.toLowerCase()} essentials on the Instamart step.
            </p>
          ) : null}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Labelled label="Date">
            <DatePicker value={date} onChange={setDate} />
          </Labelled>
          <Labelled label="Time">
            <TimePicker value={time} onChange={setTime} />
          </Labelled>
        </div>

        <div className="mt-3">
          <div className="mb-1.5">
            <span className="text-[11px] uppercase tracking-[0.12em] font-bold text-ink-tertiary">
              Delivery address
            </span>
          </div>

          {addresses.length === 0 ? (
            <div className="text-sm text-ink-tertiary py-2">
              No saved addresses on your Swiggy account yet — add one in Swiggy, then reload below.
            </div>
          ) : (
            <Select
              value={addressId}
              onChange={setAddressId}
              title="Delivery address"
              icon={<IconMapPin size={15} />}
              placeholder="Choose an address"
              searchable={addresses.length > 8}
              options={addresses.map((a) => ({
                value: a.id,
                label: a.label,
                sublabel: a.display,
              }))}
            />
          )}

          {/* Swiggy has no add-address API — addresses can only be created in the
              Swiggy app. So: open Swiggy to add one, then reload the list. */}
          <div className="mt-1.5 flex items-center gap-2 text-[11px]">
            <a
              href="https://www.swiggy.com/my-account"
              target="_blank"
              rel="noreferrer"
              className="font-bold text-swiggy-orange hover:text-cater-600 inline-flex items-center gap-1"
            >
              <IconPlus size={12} /> Add address in Swiggy
            </a>
            <span className="text-line-default">·</span>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loadingAddresses}
              className="font-semibold text-ink-tertiary hover:text-ink-secondary inline-flex items-center gap-1 disabled:opacity-50"
            >
              {loadingAddresses ? (
                <span className="w-3 h-3 rounded-full border-2 border-line-default border-t-swiggy-orange animate-spin-slow" />
              ) : (
                <IconRefresh size={12} />
              )}
              {loadingAddresses ? 'Reloading…' : 'Reload'}
            </button>
          </div>

          {address && (
            <p className="text-[11px] text-ink-tertiary mt-1.5 leading-snug">
              Every restaurant, price and delivery time comes from this address.
            </p>
          )}
        </div>

      </section>

      {/* ── Guests ── */}
      <section className="reveal min-w-0" style={{ animationDelay: '110ms' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-black tracking-tight text-ink-primary">Who's coming?</h2>
            <p className="text-[12px] text-ink-tertiary mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>
                {groupSize} {groupSize === 1 ? 'person' : 'people'}
              </span>
              {guests.length > 0 && (
                <>
                  <span className="text-line-default">·</span>
                  <span className="inline-flex items-center gap-1">
                    {syncing && (
                      <span className="w-2.5 h-2.5 rounded-full border-2 border-orange-200 border-t-swiggy-orange animate-spin-slow" />
                    )}
                    {readyCount}/{guests.length} ready
                  </span>
                </>
              )}
            </p>
          </div>
          <button onClick={() => setOpenModal(true)} className="btn-secondary text-sm shrink-0">
            <IconPlus size={16} /> Add guest
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {/* Host */}
          <div className="card p-3 flex items-center gap-3 border-orange-200 bg-orange-50/40">
            <MemberAvatar m={host} size={40} />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-ink-primary text-sm flex items-center gap-2 truncate">
                <span className="truncate">{host.name}</span>
                <span className="chip chip-orange shrink-0">Host</span>
              </div>
              <div className="text-[11px] text-ink-tertiary truncate mt-0.5">
                {host.contact?.value ?? 'You'}
              </div>
            </div>
            <span className="text-swiggy-green text-[11px] font-bold inline-flex items-center gap-1 shrink-0">
              <IconCheck size={13} /> Ready
            </span>
          </div>

          {/* Guests — status + their real invite link, in one row */}
          {guests.map((g, i) => (
            <GuestRow
              key={g.id}
              g={g}
              index={i}
              link={inviteLinks[g.id]}
              onRemove={() => removeGuest(g.id)}
            />
          ))}

          {guests.length === 0 && <EmptyGuests onClick={() => setOpenModal(true)} />}
        </div>

        {/* One link anyone can open */}
        {guests.length > 0 && (
          <div className="mt-3">
            {shareLink ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-secondary border border-line-subtle">
                <IconLink size={15} className="text-ink-tertiary shrink-0" />
                <code className="flex-1 text-[11px] text-ink-secondary truncate">{shareLink}</code>
                <CopyBtn value={shareLink} label="Copy" />
              </div>
            ) : (
              <button
                onClick={async () => {
                  setLinkBusy(true);
                  try {
                    await createShareLink();
                  } finally {
                    setLinkBusy(false);
                  }
                }}
                disabled={linkBusy}
                className="w-full text-[12px] font-semibold text-ink-tertiary hover:text-swiggy-orange transition inline-flex items-center justify-center gap-1.5 py-2 disabled:opacity-50"
              >
                <IconLink size={14} />
                {linkBusy ? 'Creating…' : 'Or create one link anyone can open'}
              </button>
            )}
          </div>
        )}
      </section>

      </div>

      {openModal && <AddGuestModal onClose={() => setOpenModal(false)} />}

      {/* ── Sticky footer ── */}
      <div className="fixed inset-x-0 bottom-0 sticky-blur border-t border-line-default z-20">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-3">
          <div className="flex-1 text-xs text-ink-secondary min-w-0">
            {!addressId ? (
              <span className="text-ink-tertiary">Pick a delivery address to continue.</span>
            ) : canContinue ? (
              <>
                You + <b className="text-ink-primary">{guests.length}</b>{' '}
                guest{guests.length === 1 ? '' : 's'}
              </>
            ) : (
              <span className="text-ink-tertiary">Invite at least one guest to continue.</span>
            )}
          </div>
          <button
            disabled={!canContinue}
            onClick={() => nav('/group')}
            className="btn-primary disabled:opacity-50 disabled:saturate-50 shrink-0"
          >
            Continue to menu <IconArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── pieces ───────────────────────── */

function Labelled({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.12em] font-bold text-ink-tertiary inline-flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function GuestRow({
  g,
  index,
  link,
  onRemove,
}: {
  g: Member;
  index: number;
  link?: string;
  onRemove: () => void;
}) {
  return (
    <div
      className="card p-3 flex items-center gap-3 reveal group"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <MemberAvatar m={g} size={40} />

      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-ink-primary truncate">{g.name}</div>
        <div className="text-[11px] text-ink-tertiary truncate mt-0.5">
          {g.contact?.value ?? 'No contact'}
        </div>
        <div className="mt-1.5">
          <StatusPill status={g.status} />
        </div>
      </div>

      {/* Actions — the invite link lives right here, on the person it belongs to */}
      <div className="flex items-center gap-1 shrink-0">
        {link && <CopyBtn value={link} label="Link" />}
        <button
          onClick={onRemove}
          title="Remove guest"
          className="w-8 h-8 rounded-lg grid place-items-center text-ink-tertiary hover:bg-red-50 hover:text-red-600 transition"
        >
          <IconClose size={14} />
        </button>
      </div>
    </div>
  );
}

/** What the guest has actually done with their link — polled from the backend. */
function StatusPill({ status }: { status?: GuestStatus }) {
  const meta: Record<string, { label: string; cls: string }> = {
    invited: { label: 'Invite sent', cls: 'bg-neutral-100 text-neutral-500' },
    joined: { label: 'Opened', cls: 'bg-blue-50 text-blue-600' },
    picking: { label: 'Picking…', cls: 'bg-amber-50 text-amber-700' },
    ready: { label: 'Ready', cls: 'bg-green-50 text-swiggy-green' },
  };
  const m = meta[status ?? 'invited'];
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${m.cls}`}>{m.label}</span>
  );
}

function CopyBtn({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      title="Copy invite link"
      className={`h-8 px-2.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition ${
        done
          ? 'bg-green-50 text-swiggy-green'
          : 'bg-surface-secondary text-ink-secondary hover:bg-orange-50 hover:text-swiggy-orange'
      }`}
    >
      {done ? <IconCheck size={13} /> : <IconLink size={13} />}
      {done ? 'Copied' : label}
    </button>
  );
}

function EmptyGuests({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full p-8 rounded-2xl border-2 border-dashed border-line-default hover:border-swiggy-orange hover:bg-orange-50/40 transition group text-center"
    >
      <div className="w-12 h-12 rounded-2xl bg-orange-50 text-swiggy-orange grid place-items-center mx-auto group-hover:animate-float">
        <IconUsers size={22} />
      </div>
      <div className="font-bold text-ink-primary mt-2.5">No guests yet</div>
      <div className="text-xs text-ink-tertiary mt-1 max-w-xs mx-auto leading-relaxed">
        Invite by email or phone. They get a link, pick their own food, and it lands in your cart.
      </div>
      <span className="inline-flex items-center gap-1 mt-3 text-xs font-bold text-swiggy-orange">
        <IconPlus size={13} /> Add your first guest
      </span>
    </button>
  );
}
