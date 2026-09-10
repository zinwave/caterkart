/**
 * Guest invite flow — /invite/:token
 *
 * This page is STANDALONE. A guest has no account and no Swiggy login: the
 * token in the URL IS their credential. Everything (occasion, restaurants,
 * menus, picks) is served by our backend, which brokers Swiggy with the HOST's
 * grant. That is why this file must never touch CelebrationContext / SwiggyContext /
 * mock data — those all assume the host's session and only live in the host's
 * browser, so a guest on another device would see nothing.
 *
 * State that must survive a reload lives in localStorage keyed by the token, so
 * a returning guest is still themselves and never re-joins as a duplicate.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import type { GuestPick, InvitePreview } from '../lib/api';
import type { Dish, Menu, Product, Restaurant } from '../lib/mcp/types';
import { occasions } from '../data/mock';
import RestaurantCard, { FoodImage } from '../components/RestaurantCard';
import DishRow from '../components/DishRow';
import FilterBar from '../components/FilterBar';
import {
  applyToDishes,
  applyToRestaurants,
  cuisinesOf,
  defaultFilters,
  type RestaurantFilters,
} from '../utils/filters';
import {
  IconAlertTriangle,
  IconBolt,
  IconCheck,
  IconClock,
  IconClose,
  IconGift,
  IconLeaf,
  IconMapPin,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconStar,
  IconStore,
  IconUsers,
  IconUtensils,
  IconWallet,
  LogoMark,
  SwiggyMark,
} from '../components/icons/Icons';

type IconType = ComponentType<{ size?: number; className?: string }>;

type Step = 'landing' | 'rsvp' | 'menu' | 'thanks';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Mirrors the host-side dietary vocabulary without importing mock data. */
type Diet = 'veg' | 'non-veg' | 'jain' | 'vegan';
const DIETS: Diet[] = ['veg', 'non-veg', 'jain', 'vegan'];
const isVegDiet = (d: Diet) => d !== 'non-veg';

const DIET_LABEL: Record<Diet, string> = {
  veg: 'Veg',
  'non-veg': 'Non-veg',
  jain: 'Jain',
  vegan: 'Vegan',
};

function toDiet(value?: string | null): Diet {
  return DIETS.includes(value as Diet) ? (value as Diet) : 'non-veg';
}

function errMessage(e: unknown): string {
  // Never surface raw Swiggy/MCP text to a guest — log it, show a calm line.
  try {
    // eslint-disable-next-line no-console
    console.warn('[caterkart] guest error:', e);
  } catch {
    /* ignore */
  }
  return 'Something went wrong — please try again in a moment.';
}

const firstName = (n: string) => n.trim().split(/\s+/)[0] || n;
const initialsOf = (n: string) => {
  const p = n.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '?') + (p[1]?.[0] ?? '')).toUpperCase();
};

// ── who-am-I, persisted per invite token ─────────────────────────────────────
// Keeps the guest's identity AND their in-progress cart across reloads. The
// backend has no session for a guest, so without this a refresh would send them
// back through RSVP and mint a duplicate member.

type StoredGuest = {
  memberId: string;
  name: string;
  dietary: Diet;
  isKid: boolean;
  picks: GuestPick[];
};

const storageKey = (token: string) => `caterkart_guest_${token}`;

function loadStored(token: string): StoredGuest | null {
  try {
    const raw = localStorage.getItem(storageKey(token));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<StoredGuest>;
    if (!p || typeof p.memberId !== 'string' || !p.memberId) return null;
    return {
      memberId: p.memberId,
      name: typeof p.name === 'string' ? p.name : '',
      dietary: toDiet(p.dietary),
      isKid: !!p.isKid,
      picks: Array.isArray(p.picks) ? p.picks : [],
    };
  } catch {
    return null;
  }
}

function saveStored(token: string, g: StoredGuest) {
  try {
    localStorage.setItem(storageKey(token), JSON.stringify(g));
  } catch {
    /* private mode / quota — the backend still has their picks */
  }
}

function clearStored(token: string) {
  try {
    localStorage.removeItem(storageKey(token));
  } catch {
    /* ignore */
  }
}

/** Debounce a fast-changing value (the search box) before hitting Swiggy. */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

// =====================================================
// Page
// =====================================================
export default function InviteGuest() {
  const { token = '' } = useParams();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<{ kind: 'invalid' | 'error'; message: string } | null>(null);

  const [step, setStep] = useState<Step>('landing');
  const [memberId, setMemberId] = useState<string | null>(null);

  // RSVP form
  const [name, setName] = useState('');
  const [dietary, setDietary] = useState<Diet>('non-veg');
  const [isKid, setIsKid] = useState(false);
  const [phone, setPhone] = useState('');
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [rsvpError, setRsvpError] = useState<string | null>(null);

  // The guest's OWN cart. Not shared with the host's CelebrationContext.
  const [picks, setPicks] = useState<GuestPick[]>([]);
  const [save, setSave] = useState<SaveState>('idle');
  /** Only auto-save picks the guest actually touched — never PUT an empty cart
   *  on mount, which would wipe picks they made on another device. */
  const dirty = useRef(false);

  const [doneBusy, setDoneBusy] = useState(false);
  const [doneError, setDoneError] = useState<string | null>(null);

  // ── load the invite ────────────────────────────────────────────────────────
  const loadPreview = useCallback(async () => {
    if (!token) {
      setFatal({ kind: 'invalid', message: 'This link has no invite code in it.' });
      setLoading(false);
      return;
    }
    setLoading(true);
    setFatal(null);
    try {
      const p = await api.invites.preview(token);
      setPreview(p);

      // Returning guest? Only trust the stored id if the celebration still knows them.
      const stored = loadStored(token);
      const known = stored && p.members.some((m) => m.id === stored.memberId) ? stored : null;
      if (stored && !known) clearStored(token);

      // The SERVER is the source of truth for picks: this guest may have chosen
      // on a different phone. localStorage is only a convenience.
      const serverPicks =
        p.invitedMember && (!known || p.invitedMember.id === known.memberId)
          ? p.invitedMember.picks
          : [];

      if (known) {
        setMemberId(known.memberId);
        setName(known.name);
        setDietary(known.dietary);
        setIsKid(known.isKid);
        setPicks(serverPicks.length ? serverPicks : known.picks);
        dirty.current = false;
        const me = p.members.find((m) => m.id === known.memberId);
        setStep(me?.status === 'READY' ? 'thanks' : 'menu');
      } else if (p.invitedMember) {
        // The host invited this specific person — pre-fill what they already know.
        setName(p.invitedMember.name);
        setDietary(toDiet(p.invitedMember.dietary));
        setIsKid(p.invitedMember.isKid);

        // Already joined (on another device)? Resume them rather than making them
        // re-RSVP and re-pick everything.
        if (p.invitedMember.status !== 'INVITED') {
          setMemberId(p.invitedMember.id);
          setPicks(serverPicks);
          dirty.current = false;
          setStep(p.invitedMember.status === 'READY' ? 'thanks' : 'menu');
        }
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setFatal({ kind: 'invalid', message: 'This invite link is invalid or has expired.' });
      } else {
        setFatal({ kind: 'error', message: errMessage(e) });
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  // ── keep localStorage in step with who they are and what they picked ───────
  useEffect(() => {
    if (!memberId) return;
    saveStored(token, { memberId, name, dietary, isKid, picks });
  }, [token, memberId, name, dietary, isKid, picks]);

  // ── debounced auto-save so the host watches picks land live ────────────────
  useEffect(() => {
    if (!memberId || !dirty.current) return;
    let cancelled = false;
    setSave('saving');
    const t = window.setTimeout(() => {
      api.invites
        .savePicks(token, memberId, picks)
        .then(() => {
          if (!cancelled) setSave('saved');
        })
        .catch(() => {
          if (!cancelled) setSave('error');
        });
    }, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [picks, memberId, token]);

  const retrySave = useCallback(async () => {
    if (!memberId) return;
    setSave('saving');
    try {
      await api.invites.savePicks(token, memberId, picks);
      dirty.current = false;
      setSave('saved');
    } catch {
      setSave('error');
    }
  }, [token, memberId, picks]);

  // ── cart ops (GuestPick[]) ────────────────────────────────────────────────
  const mutate = useCallback((fn: (prev: GuestPick[]) => GuestPick[]) => {
    dirty.current = true;
    setPicks(fn);
  }, []);

  const addDish = useCallback(
    (r: Restaurant, d: Dish) => {
      if (!r.isOpen || !d.inStock) return; // Swiggy would refuse this line anyway
      mutate((prev) => {
        const i = prev.findIndex((p) => p.restaurantId === r.id && p.dishId === d.id);
        if (i >= 0) return prev.map((p, ix) => (ix === i ? { ...p, qty: p.qty + 1 } : p));
        return [
          ...prev,
          {
            restaurantId: r.id,
            restaurantName: r.name,
            dishId: d.id,
            dishName: d.name,
            price: d.price,
            qty: 1,
            veg: d.veg,
            imageUrl: d.imageUrl,
            // Carry the restaurant's ETA/area/rating so the host can show them.
            restaurantEtaMin: r.etaMin,
            restaurantEtaRange: r.etaRange,
            restaurantArea: r.areaName,
            restaurantRating: r.rating ?? undefined,
          },
        ];
      });
    },
    [mutate],
  );

  // Instamart products are stored as picks under the sentinel restaurantId
  // 'instamart', so they ride the same save/qty machinery as restaurant dishes.
  const addProduct = useCallback(
    (prod: Product) => {
      if (!prod.inStock) return;
      mutate((prev) => {
        const i = prev.findIndex((p) => p.restaurantId === 'instamart' && p.dishId === prod.id);
        if (i >= 0) return prev.map((p, ix) => (ix === i ? { ...p, qty: p.qty + 1 } : p));
        return [
          ...prev,
          {
            restaurantId: 'instamart',
            restaurantName: 'Instamart',
            dishId: prod.id,
            dishName: prod.brand ? `${prod.brand} · ${prod.name}` : prod.name,
            price: prod.price,
            qty: 1,
            veg: true,
            imageUrl: prod.imageUrl,
            kind: 'instamart',
          },
        ];
      });
    },
    [mutate],
  );

  const stepQty = useCallback(
    (restaurantId: string, dishId: string, delta: number) => {
      mutate((prev) =>
        prev.flatMap((p) => {
          if (p.restaurantId !== restaurantId || p.dishId !== dishId) return [p];
          const qty = p.qty + delta;
          return qty <= 0 ? [] : [{ ...p, qty }];
        }),
      );
    },
    [mutate],
  );

  const qtyOf = useCallback(
    (restaurantId: string, dishId: string) =>
      picks.find((p) => p.restaurantId === restaurantId && p.dishId === dishId)?.qty ?? 0,
    [picks],
  );

  const itemCount = useMemo(() => picks.reduce((s, p) => s + p.qty, 0), [picks]);
  const total = useMemo(() => picks.reduce((s, p) => s + p.price * p.qty, 0), [picks]);

  // ── RSVP ──────────────────────────────────────────────────────────────────
  async function submitRsvp() {
    const n = name.trim();
    if (!n) {
      setRsvpError('Please tell the host your name.');
      return;
    }
    setRsvpBusy(true);
    setRsvpError(null);
    try {
      const res = await api.invites.accept(token, {
        name: n,
        dietary,
        isKid,
        phone: phone.trim() || undefined,
      });
      setMemberId(res.member.id);
      setName(res.member.name || n);
      saveStored(token, { memberId: res.member.id, name: res.member.name || n, dietary, isKid, picks });
      setStep('menu');
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setFatal({ kind: 'invalid', message: 'This invite link is invalid or has expired.' });
      } else {
        setRsvpError(errMessage(e));
      }
    } finally {
      setRsvpBusy(false);
    }
  }

  // ── done ──────────────────────────────────────────────────────────────────
  async function markReady() {
    if (!memberId) return;
    setDoneBusy(true);
    setDoneError(null);
    try {
      // Flush before READY so the debounce can't lose the last tap.
      await api.invites.savePicks(token, memberId, picks);
      dirty.current = false;
      setSave('saved');
      await api.invites.ready(token, memberId);
      setStep('thanks');
    } catch (e) {
      setDoneError(errMessage(e));
    } finally {
      setDoneBusy(false);
    }
  }

  // ── shells ────────────────────────────────────────────────────────────────
  if (loading) return <LoadingShell />;

  if (fatal || !preview) {
    return (
      <FatalShell
        kind={fatal?.kind ?? 'error'}
        message={fatal?.message ?? 'We could not load this invite.'}
        onRetry={() => void loadPreview()}
      />
    );
  }

  const guestCount = preview.members.length;

  return (
    <div className="min-h-screen bg-surface-secondary">
      {step === 'landing' && (
        <Landing
          preview={preview}
          guestCount={guestCount}
          returning={!!memberId}
          onContinue={() => setStep(memberId ? 'menu' : 'rsvp')}
        />
      )}

      {step === 'rsvp' && (
        <Rsvp
          name={name}
          setName={setName}
          dietary={dietary}
          setDietary={setDietary}
          locked={!!preview.invitedMember}
          busy={rsvpBusy}
          error={rsvpError}
          onConfirm={() => void submitRsvp()}
          onBack={() => setStep('landing')}
        />
      )}

      {step === 'menu' && (
        <MenuPicker
          token={token}
          guestName={name}
          hostName={preview.hostName}
          occasionName={preview.occasion}
          hasAddress={preview.hasAddress}
          vegDefault={isVegDiet(dietary)}
          picks={picks}
          itemCount={itemCount}
          total={total}
          save={save}
          onRetrySave={() => void retrySave()}
          qtyOf={qtyOf}
          onAdd={addDish}
          onAddProduct={addProduct}
          onQty={stepQty}
          onDone={() => void markReady()}
          doneBusy={doneBusy}
          doneError={doneError}
          onRefreshInvite={() => void loadPreview()}
        />
      )}

      {step === 'thanks' && (
        <Thanks
          guestName={name}
          hostName={preview.hostName}
          picks={picks}
          itemCount={itemCount}
          total={total}
          onEdit={() => setStep('menu')}
        />
      )}
    </div>
  );
}

// =====================================================
// 1. Landing — the real celebration, from the token
// =====================================================
function Landing({
  preview,
  guestCount,
  returning,
  onContinue,
}: {
  preview: InvitePreview;
  guestCount: number;
  returning: boolean;
  onContinue: () => void;
}) {
  const invited = preview.invitedMember;
  const host = firstName(preview.hostName);

  return (
    <div className="relative min-h-screen">
      {/* Hero */}
      <div className="bg-mesh-warm bg-[length:200%_200%] animate-gradient-shift text-white px-5 pt-8 pb-16 relative overflow-hidden">
        <div className="absolute -top-24 -right-16 w-80 h-80 rounded-full bg-white/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-12 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative max-w-md mx-auto">
          <div className="flex items-center gap-2 text-white/95 text-[14px] font-black tracking-tight">
            <LogoMark size={24} />
            <span>
              Cater<span className="font-bold text-white/80">Kart</span>
            </span>
            <span className="text-[10px] font-semibold text-white/70 tracking-normal">
              powered by <SwiggyMark size={12} className="inline-block align-middle" />
            </span>
          </div>

          <div className="mt-6 inline-flex items-center gap-1.5 chip bg-white/15 backdrop-blur text-white border border-white/25">
            <IconGift size={14} /> You&rsquo;re invited
          </div>

          <h1 className="mt-3 text-[26px] sm:text-[30px] font-black leading-[1.12] tracking-tight">
            <b>{preview.hostName}</b> invited you to
            <br />
            <span className="underline decoration-white/50 decoration-4 underline-offset-2">
              {preview.occasion}
            </span>
          </h1>

          <div className="mt-5 space-y-2">
            <DetailRow icon={IconMapPin} label="Where">
              {preview.hasAddress ? preview.addressLabel : 'Address not set yet'}
            </DetailRow>

            {/* Who's coming — the actual list, not just a count */}
            <div className="rounded-xl bg-white/10 backdrop-blur border border-white/15 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-white/70 font-bold">
                <IconUsers size={13} /> Who&rsquo;s coming · {guestCount}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {preview.members.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/20 pl-1 pr-2.5 py-0.5"
                  >
                    <span className="w-5 h-5 rounded-full bg-white/25 grid place-items-center text-[9px] font-black text-white">
                      {initialsOf(m.name)}
                    </span>
                    <span className="text-[12px] font-semibold text-white">{firstName(m.name)}</span>
                    {m.isHost && (
                      <span className="text-[8px] font-black uppercase tracking-wide text-white/70">
                        host
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action card, pulled over the hero */}
      <div className="max-w-md mx-auto px-5 -mt-8 relative">
        <div className="card p-5 animate-fade-in-up">
          {invited && (
            <div className="text-xs uppercase tracking-wide font-semibold text-ink-tertiary">
              Hi, {firstName(invited.name)}
            </div>
          )}
          <p className="text-[15px] mt-1 leading-relaxed text-ink-secondary">
            {returning
              ? 'Welcome back — pick up right where you left off.'
              : `Choose exactly what you want to eat. ${host} adds it to one order for everyone.`}
          </p>

          <button onClick={onContinue} className="btn-primary w-full mt-4">
            {returning ? 'Back to my picks →' : 'Pick your dishes →'}
          </button>

          {!preview.hasAddress && (
            <div className="mt-3 text-[11px] text-ink-tertiary leading-relaxed">
              {host} hasn&rsquo;t set a delivery address yet, so the menu isn&rsquo;t open. You can
              still add your details now.
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="mt-5">
          <div className="section-title mb-2.5">How it works</div>
          <div className="card overflow-hidden p-0 bg-gradient-to-br from-orange-50/50 via-white to-purple-50/40">
            <div className="grid grid-cols-4 divide-x divide-line-subtle">
              {STEPS.map((s) => (
                <div
                  key={s.title}
                  className="flex flex-col items-center text-center gap-1.5 px-1 py-3.5"
                >
                  <div
                    className={`w-10 h-10 rounded-xl grid place-items-center text-white shadow-pop bg-gradient-to-br ${s.badge}`}
                  >
                    <s.Icon size={18} />
                  </div>
                  <div className="text-[9.5px] font-bold text-ink-primary leading-tight">
                    {s.title}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <footer className="max-w-md mx-auto px-5 py-8 text-center text-xs text-ink-tertiary">
        No app, no account. This link is yours.
      </footer>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: IconType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-white/10 backdrop-blur border border-white/15 px-3 py-2.5">
      <span className="mt-0.5 shrink-0 text-white/90">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.1em] text-white/70 font-bold">{label}</div>
        <div className="text-[13px] font-semibold leading-snug break-words text-white">
          {children}
        </div>
      </div>
    </div>
  );
}

/** The "how it works" flow shown on the invite landing — gradient badges. */
const STEPS: { Icon: IconType; title: string; badge: string }[] = [
  { Icon: IconUtensils, title: 'Any restaurant', badge: 'from-swiggy-orange to-cater-coral' },
  { Icon: IconClock, title: 'Arrives together', badge: 'from-blue-500 to-sky-400' },
  { Icon: IconBolt, title: '15-min Instamart', badge: 'from-swiggy-mart to-fuchsia-400' },
  { Icon: IconWallet, title: 'Easy split', badge: 'from-swiggy-green to-emerald-400' },
];

// =====================================================
// 2. RSVP → api.invites.accept
// =====================================================
function BrandHeader({ maxW = 'max-w-md' }: { maxW?: string }) {
  return (
    <header className="bg-white border-b border-line-subtle sticky top-0 z-20">
      <div className={`${maxW} mx-auto px-5 h-14 flex items-center gap-2.5`}>
        <LogoMark size={28} />
        <div className="leading-none">
          <div className="font-black text-[15px] tracking-tight text-ink-primary">
            Cater<span className="text-swiggy-orange">Kart</span>
          </div>
          <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-tertiary mt-1">
            powered by <SwiggyMark size={12} className="inline-block align-middle" />
          </div>
        </div>
      </div>
    </header>
  );
}

function Rsvp({
  name,
  setName,
  dietary,
  setDietary,
  locked,
  busy,
  error,
  onConfirm,
  onBack,
}: {
  name: string;
  setName: (v: string) => void;
  dietary: Diet;
  setDietary: (d: Diet) => void;
  locked: boolean;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <BrandHeader />

      {/* Warm accent strip so the form doesn't float on grey */}
      <div className="bg-gradient-to-b from-orange-50/70 to-transparent">
        <div className="max-w-md mx-auto px-5 pt-5 pb-2">
          <button
            onClick={onBack}
            className="text-sm font-semibold text-ink-tertiary hover:text-ink-secondary inline-flex items-center gap-1"
          >
            ← Back
          </button>
          <div className="mt-3 inline-flex items-center gap-1.5 chip chip-orange">
            <IconCheck size={12} /> Almost there
          </div>
          <h1 className="mt-2.5 text-[26px] font-black tracking-tight text-ink-primary leading-[1.1]">
            A few quick details
          </h1>
          <p className="text-[14px] text-ink-secondary mt-1.5 leading-relaxed">
            {locked
              ? 'The host already added you — just check the details below.'
              : 'This is how the host knows what to order for you.'}
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 pb-8">
        <div className="card p-4 space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-[0.1em] font-bold text-ink-tertiary">
              Your name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              className="mt-1.5 w-full rounded-lg border border-line-default px-3 py-2.5 text-sm outline-none focus:border-swiggy-orange focus:ring-2 focus:ring-orange-100 placeholder:text-ink-tertiary"
            />
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.1em] font-bold text-ink-tertiary mb-2">
              Dietary preference
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DIETS.map((d) => {
                const on = dietary === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDietary(d)}
                    aria-pressed={on}
                    className={`px-3 py-2.5 rounded-xl font-bold border-2 transition flex items-center justify-center gap-2 text-sm ${
                      on
                        ? 'border-swiggy-orange bg-orange-50 text-swiggy-orange shadow-card'
                        : 'border-line-default bg-white text-ink-secondary hover:border-orange-200'
                    }`}
                  >
                    <span
                      className={`inline-grid place-items-center w-3.5 h-3.5 border-[1.5px] ${
                        isVegDiet(d) ? 'border-swiggy-green' : 'border-swiggy-red'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isVegDiet(d) ? 'bg-swiggy-green' : 'bg-swiggy-red'
                        }`}
                      />
                    </span>
                    {DIET_LABEL[d]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 text-sm text-swiggy-red bg-red-50 border border-red-100 rounded-lg p-3">
            <IconAlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={onConfirm}
          disabled={busy || !name.trim()}
          className="btn-primary w-full mt-5 disabled:opacity-50 disabled:saturate-50"
        >
          {busy ? 'Joining…' : 'Confirm & pick dishes →'}
        </button>
        <p className="text-[11px] text-center text-ink-tertiary mt-3">
          No app, no account. This link is yours.
        </p>
      </div>
    </div>
  );
}


// =====================================================
// 3. Menu picking — REAL Swiggy, brokered by the token
// =====================================================
function MenuPicker({
  token,
  guestName,
  hostName,
  occasionName,
  hasAddress,
  vegDefault,
  picks,
  itemCount,
  total,
  save,
  onRetrySave,
  qtyOf,
  onAdd,
  onAddProduct,
  onQty,
  onDone,
  doneBusy,
  doneError,
  onRefreshInvite,
}: {
  token: string;
  guestName: string;
  hostName: string;
  occasionName: string;
  hasAddress: boolean;
  vegDefault: boolean;
  picks: GuestPick[];
  itemCount: number;
  total: number;
  save: SaveState;
  onRetrySave: () => void;
  qtyOf: (restaurantId: string, dishId: string) => number;
  onAdd: (r: Restaurant, d: Dish) => void;
  onAddProduct: (p: Product) => void;
  onQty: (restaurantId: string, dishId: string, delta: number) => void;
  onDone: () => void;
  doneBusy: boolean;
  doneError: string | null;
  onRefreshInvite: () => void;
}) {
  const [mode, setMode] = useState<'food' | 'instamart'>('food');

  // Event-type Instamart suggestions for the guest (never the host's personal
  // reorders). Match the event name to a type; fall back to House Party.
  const reco = useMemo(() => {
    const hp = occasions.find((o) => o.id === 'house-party') ?? null;
    const matched = occasions.find(
      (o) => o.name.toLowerCase() === occasionName.trim().toLowerCase(),
    );
    return matched?.essentials?.length ? matched : hp;
  }, [occasionName]);
  const essentialTerms = reco?.essentials ?? [];
  // Veg diet is a NUDGE — the filter starts on but the guest can switch it off.
  const [filters, setFilters] = useState<RestaurantFilters>(() => ({
    ...defaultFilters(),
    vegOnly: vegDefault,
  }));

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [rLoading, setRLoading] = useState(hasAddress);
  const [rError, setRError] = useState<string | null>(null);
  const [rNonce, setRNonce] = useState(0);

  const q = useDebounced(filters.q, 350);

  useEffect(() => {
    if (!hasAddress) {
      setRLoading(false);
      return;
    }
    let alive = true;
    setRLoading(true);
    setRError(null);
    api.invites
      .restaurants(token, q.trim())
      .then((rs) => {
        if (!alive) return;
        setRestaurants(rs);
        setRLoading(false);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setRError(errMessage(e));
        setRLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [token, q, hasAddress, rNonce]);

  // ── one restaurant's menu, fetched on open ────────────────────────────────
  const [open, setOpen] = useState<Restaurant | null>(null);
  const openId = open?.id ?? null;
  const [menu, setMenu] = useState<Menu | null>(null);
  const [mLoading, setMLoading] = useState(false);
  const [mError, setMError] = useState<string | null>(null);
  const [mNonce, setMNonce] = useState(0);

  useEffect(() => {
    if (!openId) {
      setMenu(null);
      setMError(null);
      return;
    }
    let alive = true;
    setMLoading(true);
    setMError(null);
    setMenu(null);
    api.invites
      .menu(token, openId)
      .then((m) => {
        if (!alive) return;
        setMenu(m);
        setMLoading(false);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setMError(errMessage(e));
        setMLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [token, openId, mNonce]);

  const shown = useMemo(() => applyToRestaurants(restaurants, filters), [restaurants, filters]);
  const cuisineOptions = useMemo(() => cuisinesOf(restaurants), [restaurants]);

  return (
    <>
    <BrandHeader maxW="max-w-5xl" />
    <div className="max-w-5xl mx-auto px-0 sm:px-5 pb-32">
      <div className="px-5 pt-6">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black tracking-tight">
              Your picks{guestName ? <>, {firstName(guestName)}</> : null}
            </h1>
            <p className="text-sm text-ink-secondary mt-1">
              Pick from any restaurant — {firstName(hostName)} places one order for everyone.
            </p>
          </div>
          <SaveBadge state={save} onRetry={onRetrySave} />
        </div>
      </div>

      {!hasAddress ? (
        <div className="px-5 mt-6">
          <HostSettingUp hostName={hostName} onRefresh={onRefreshInvite} />
        </div>
      ) : (
        <>
          {/* Restaurants ↔ Instamart */}
          <div className="px-5 mt-5">
            <GuestModeToggle mode={mode} setMode={setMode} />
          </div>

          {picks.length > 0 && (
            <div className="px-5 mt-4">
              <PicksSummary picks={picks} total={total} />
            </div>
          )}

          {mode === 'instamart' ? (
            <div className="px-5 mt-4">
              <InstamartPanel
                token={token}
                essentialTerms={essentialTerms}
                recoLabel={reco?.name ?? 'Party'}
                qtyOf={qtyOf}
                onAdd={onAddProduct}
                onQty={onQty}
              />
            </div>
          ) : (
            <>
              <div className="px-5 mt-4">
                <FilterBar filters={filters} setFilters={setFilters} cuisineOptions={cuisineOptions} />
                {vegDefault && filters.vegOnly && (
                  <div className="mt-2 text-[11px] text-ink-tertiary inline-flex items-center gap-1.5">
                    <IconLeaf size={12} className="text-swiggy-green" />
                    Veg filter is on because that&rsquo;s your preference — turn it off any time.
                  </div>
                )}
              </div>

              <div className="px-5 mt-5">
                {rError ? (
                  <ErrorCard
                    title="Swiggy didn't answer"
                    message={rError}
                    onRetry={() => setRNonce((n) => n + 1)}
                  />
                ) : rLoading && restaurants.length === 0 ? (
                  <>
                    <h2 className="section-title">Finding restaurants…</h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                      {[0, 1, 2].map((i) => (
                        <RestaurantSkeleton key={i} />
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="section-title">
                      {shown.length} restaurant{shown.length === 1 ? '' : 's'}
                    </h2>
                    {shown.length === 0 ? (
                      <EmptyResults
                        query={filters.q}
                        onClear={() => setFilters({ ...defaultFilters(), vegOnly: vegDefault })}
                      />
                    ) : (
                      <div
                        className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3 transition-opacity ${rLoading ? 'opacity-60' : ''}`}
                      >
                        {shown.map((r) => (
                          <RestaurantCard key={r.id} r={r} onClick={() => setOpen(r)} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* dish sheet — fixed-size flex modal so adding items scrolls the body
          instead of resizing the whole sheet (which read as a flicker). */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-ink-primary/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-6 animate-fade-in"
          onClick={() => setOpen(null)}
        >
          <div
            className="bg-white w-full sm:max-w-lg h-[88vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-floating animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* grab handle on mobile */}
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
              <span className="w-10 h-1.5 rounded-full bg-line-default" />
            </div>

            {/* header — fixed */}
            <div className="px-4 py-3 border-b border-line-subtle flex items-center gap-3 shrink-0">
              <FoodImage
                src={open.imageUrl}
                alt={open.name}
                className="w-12 h-12 rounded-xl shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="font-black text-ink-primary truncate leading-tight">{open.name}</div>
                <div className="text-xs text-ink-tertiary truncate mt-0.5 flex items-center gap-1.5">
                  {open.rating && (
                    <span className="inline-flex items-center gap-0.5 text-swiggy-green font-bold">
                      <IconStar size={11} /> {open.rating}
                    </span>
                  )}
                  <span className="truncate">
                    {open.cuisines.join(' · ')}
                    {open.etaMin > 0 && ` · ${open.etaMin} min`}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setOpen(null)}
                aria-label="Close menu"
                className="w-9 h-9 grid place-items-center rounded-full bg-surface-secondary text-ink-secondary hover:bg-surface-tertiary shrink-0"
              >
                <IconClose size={18} />
              </button>
            </div>

            {!open.isOpen && (
              <div className="mx-4 mt-3 flex items-start gap-2 text-xs bg-amber-50 border border-amber-100 text-amber-800 rounded-lg p-2.5 shrink-0">
                <IconClock size={14} />
                <span>
                  This kitchen is closed on Swiggy right now, so it can&rsquo;t be added to the
                  order. Browse away — check back when it reopens.
                </span>
              </div>
            )}

            {/* body — the only scroller */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <MenuBody
                menu={menu}
                loading={mLoading}
                error={mError}
                onRetry={() => setMNonce((n) => n + 1)}
                filters={filters}
                locked={!open.isOpen}
                qtyOf={(dishId) => qtyOf(open.id, dishId)}
                onAdd={(d) => onAdd(open, d)}
                onQty={(dishId, delta) => onQty(open.id, dishId, delta)}
              />
            </div>
          </div>
        </div>
      )}

      {/* sticky footer */}
      {hasAddress && (
        <div className="fixed inset-x-0 bottom-0 sticky-blur border-t border-line-default z-30">
          <div className="max-w-5xl mx-auto px-5 py-3">
            {doneError && (
              <div className="text-xs text-swiggy-red mb-2 flex items-center gap-1.5">
                <IconAlertTriangle size={13} /> {doneError}
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-xs text-ink-tertiary">
                  {itemCount} item{itemCount === 1 ? '' : 's'}
                </div>
                <div className="font-black text-lg tabular-nums">₹{total}</div>
              </div>
              <button
                disabled={picks.length === 0 || doneBusy}
                onClick={onDone}
                className="btn-primary disabled:opacity-50 disabled:saturate-50"
              >
                {doneBusy ? 'Saving…' : "I'm done · submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

function GuestModeToggle({
  mode,
  setMode,
}: {
  mode: 'food' | 'instamart';
  setMode: (m: 'food' | 'instamart') => void;
}) {
  const opts: { v: 'food' | 'instamart'; label: string; Icon: IconType; tone: string }[] = [
    { v: 'food', label: 'Restaurants', Icon: IconUtensils, tone: 'text-swiggy-orange' },
    { v: 'instamart', label: 'Instamart', Icon: IconBolt, tone: 'text-swiggy-mart' },
  ];
  return (
    <div className="inline-flex bg-surface-secondary rounded-xl p-1 w-full">
      {opts.map((o) => {
        const on = mode === o.v;
        return (
          <button
            key={o.v}
            onClick={() => setMode(o.v)}
            className={`flex-1 px-4 py-2 rounded-lg text-[13px] font-bold inline-flex items-center justify-center gap-1.5 transition ${
              on ? 'bg-white shadow-card text-ink-primary' : 'text-ink-secondary'
            }`}
          >
            <o.Icon size={15} className={on ? o.tone : ''} /> {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Guests browse Instamart too — brokered with the host's grant via the token. */
function InstamartPanel({
  token,
  essentialTerms,
  recoLabel,
  qtyOf,
  onAdd,
  onQty,
}: {
  token: string;
  essentialTerms: string[];
  recoLabel: string;
  qtyOf: (restaurantId: string, dishId: string) => number;
  onAdd: (p: Product) => void;
  onQty: (restaurantId: string, dishId: string, delta: number) => void;
}) {
  const [q, setQ] = useState('');
  const query = useDebounced(q, 350);
  const searching = query.trim().length > 0;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const termsKey = essentialTerms.join('|');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    const term = query.trim();
    const run = term
      ? // typed → a normal Instamart search
        api.invites.instamart(token, term)
      : // empty → EVENT-TYPE suggestions (never the host's personal reorders):
        // run each curated term and merge the top hits, deduped.
        Promise.all(
          essentialTerms.map((t) =>
            api.invites
              .instamart(token, t)
              .then((r) => r.slice(0, 2))
              .catch(() => [] as Product[]),
          ),
        ).then((groups) => {
          const seen = new Set<string>();
          const merged: Product[] = [];
          for (const g of groups)
            for (const p of g)
              if (!seen.has(p.id)) {
                seen.add(p.id);
                merged.push(p);
              }
          return merged;
        });

    run
      .then((ps) => {
        if (alive) {
          setProducts(ps);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (alive) {
          setError(errMessage(e));
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, query, nonce, termsKey]);

  return (
    <div>
      <div className="relative">
        <IconSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-tertiary" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Instamart — 'water', 'chips', 'ice'…"
          className="w-full bg-white rounded-xl pl-10 pr-9 py-2.5 text-sm shadow-card border border-line-subtle outline-none focus:border-swiggy-mart focus:ring-2 focus:ring-purple-100 transition placeholder:text-ink-tertiary"
        />
        {q && (
          <button
            onClick={() => setQ('')}
            aria-label="Clear"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center rounded-full bg-surface-tertiary text-ink-tertiary"
          >
            <IconClose size={13} />
          </button>
        )}
      </div>

      <div className="mt-2.5 text-[11px] font-semibold text-ink-secondary inline-flex items-center gap-1.5">
        <IconBolt size={12} className="text-swiggy-mart" />
        {searching ? `Instamart results for “${query.trim()}”` : `Popular for ${recoLabel}`}
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <ErrorCard
            title="Instamart didn't answer"
            message={error}
            onRetry={() => setNonce((n) => n + 1)}
          />
        ) : products.length === 0 ? (
          <div className="card p-8 text-center text-sm text-ink-tertiary">
            {q.trim()
              ? `Nothing on Instamart for “${q.trim()}”.`
              : 'Search for what you need — water, snacks, ice, plates…'}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {products.map((p) => (
              <GuestProductCard
                key={p.id}
                p={p}
                qty={qtyOf('instamart', p.id)}
                onAdd={() => onAdd(p)}
                onInc={() => onQty('instamart', p.id, 1)}
                onDec={() => onQty('instamart', p.id, -1)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GuestProductCard({
  p,
  qty,
  onAdd,
  onInc,
  onDec,
}: {
  p: Product;
  qty: number;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
}) {
  const inCart = qty > 0;
  return (
    <div className="card p-3 flex items-center gap-3">
      <FoodImage src={p.imageUrl} alt="" className="w-14 h-14 rounded-xl shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-ink-primary leading-tight line-clamp-2">
          {p.brand ? `${p.brand} · ${p.name}` : p.name}
        </div>
        {p.unit && <div className="text-[11px] text-ink-tertiary mt-0.5">{p.unit}</div>}
        <div className="text-sm font-bold text-ink-primary mt-1 tabular-nums">
          ₹{p.price}
          {p.mrp > p.price && (
            <span className="ml-1.5 text-[11px] text-ink-tertiary line-through">₹{p.mrp}</span>
          )}
        </div>
      </div>
      {!p.inStock ? (
        <span className="text-[11px] font-bold text-ink-tertiary shrink-0">Sold out</span>
      ) : inCart ? (
        <div className="flex items-center rounded-lg bg-white border border-swiggy-mart shadow-card overflow-hidden shrink-0">
          <button onClick={onDec} className="px-2.5 py-1.5 text-swiggy-mart font-black leading-none">−</button>
          <span className="px-1 min-w-[1.5rem] text-center text-sm font-black text-swiggy-mart tabular-nums leading-none">
            {qty}
          </span>
          <button onClick={onInc} className="px-2.5 py-1.5 text-swiggy-mart font-black leading-none">+</button>
        </div>
      ) : (
        <button
          onClick={onAdd}
          className="shrink-0 inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-white border border-swiggy-mart text-swiggy-mart text-sm font-black uppercase tracking-wide shadow-pop hover:bg-purple-50 active:scale-95 transition"
        >
          Add <IconPlus size={14} />
        </button>
      )}
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="card p-3 flex items-center gap-3 animate-pulse">
      <div className="w-14 h-14 rounded-xl bg-surface-secondary shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-3/4 rounded bg-surface-secondary" />
        <div className="h-2.5 w-1/3 rounded bg-surface-secondary" />
        <div className="h-3 w-1/4 rounded bg-surface-secondary" />
      </div>
    </div>
  );
}

/** The real Swiggy menu for one restaurant, in its own categories. */
function MenuBody({
  menu,
  loading,
  error,
  onRetry,
  filters,
  locked,
  qtyOf,
  onAdd,
  onQty,
}: {
  menu: Menu | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  filters: RestaurantFilters;
  locked: boolean;
  qtyOf: (dishId: string) => number;
  onAdd: (d: Dish) => void;
  onQty: (dishId: string, delta: number) => void;
}) {
  const sections = useMemo(() => {
    if (!menu) return [];
    return menu.categories
      .map((c) => ({ title: c.title, items: applyToDishes(c.items, filters) }))
      .filter((c) => c.items.length > 0);
  }, [menu, filters]);

  const totalItems = menu ? menu.categories.reduce((s, c) => s + c.items.length, 0) : 0;
  const shownItems = sections.reduce((s, c) => s + c.items.length, 0);
  const filtered = !!(filters.vegOnly || filters.bestsellerOnly || filters.q.trim());

  if (loading) {
    return (
      <div className="px-4 divide-y divide-line-subtle">
        {[0, 1, 2, 3].map((i) => (
          <DishSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-10">
        <ErrorCard title="Couldn't load this menu" message={error} onRetry={onRetry} />
      </div>
    );
  }

  if (!menu || totalItems === 0) {
    return (
      <div className="py-12 text-center text-sm text-ink-tertiary">
        Swiggy has no menu for this restaurant right now.
      </div>
    );
  }

  return (
    <div className="px-4 pb-6">
      {filtered && (
        <div className="mt-3 mb-1 text-[11px] text-ink-tertiary flex items-center gap-2">
          <span>Showing dishes matching your filters</span>
          <span className="chip chip-orange">
            {shownItems} of {totalItems}
          </span>
        </div>
      )}

      {shownItems === 0 ? (
        <div className="py-12 text-center text-sm text-ink-tertiary">
          No dishes here match your filters.
        </div>
      ) : (
        sections.map((c) => (
          <div key={c.title} className="mt-2">
            <div className="flex items-center gap-2 py-2 sticky top-0 bg-white/95 backdrop-blur z-[1]">
              <span className="text-[13px] font-black tracking-tight">{c.title}</span>
              <span className="flex-1 h-px bg-line-subtle" />
              <span className="text-[11px] text-ink-tertiary tabular-nums">{c.items.length}</span>
            </div>
            <div className="divide-y divide-line-subtle">
              {c.items.map((d) => (
                <DishRow
                  key={d.id}
                  dish={d}
                  qty={qtyOf(d.id)}
                  disabled={locked}
                  onAdd={() => onAdd(d)}
                  onInc={() => onQty(d.id, 1)}
                  onDec={() => onQty(d.id, -1)}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function PicksSummary({ picks, total }: { picks: GuestPick[]; total: number }) {
  // Group by restaurant — the guest can pick across several.
  const groups = useMemo(() => {
    const m = new Map<string, { name: string; lines: GuestPick[] }>();
    picks.forEach((p) => {
      const g = m.get(p.restaurantId) ?? { name: p.restaurantName, lines: [] };
      g.lines.push(p);
      m.set(p.restaurantId, g);
    });
    return [...m.values()];
  }, [picks]);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-tertiary">
          Your picks
        </div>
        <div className="font-black text-base tabular-nums text-ink-primary">₹{total}</div>
      </div>

      <div className="mt-3 divide-y divide-line-subtle">
        {groups.map((g) => (
          <div key={g.name} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-1.5 mb-2.5">
              <IconStore size={12} className="text-ink-tertiary shrink-0" />
              <span className="text-[11px] font-bold text-ink-secondary truncate">{g.name}</span>
            </div>
            <div className="space-y-2.5">
              {g.lines.map((l) => (
                <div key={l.dishId} className="flex items-center gap-3">
                  <FoodImage src={l.imageUrl} alt="" className="w-10 h-10 rounded-lg shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-ink-primary leading-snug line-clamp-1">
                      {l.dishName}
                    </div>
                    <div className="text-[11px] text-ink-tertiary mt-0.5">
                      Qty {l.qty} · ₹{l.price}
                    </div>
                  </div>
                  <div className="font-bold text-[13px] tabular-nums text-ink-primary shrink-0">
                    ₹{l.price * l.qty}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SaveBadge({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === 'idle') return null;
  if (state === 'saving') {
    return (
      <span className="chip bg-surface-secondary text-ink-tertiary shrink-0 mt-1">Saving…</span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="chip chip-green shrink-0 mt-1 inline-flex items-center gap-1">
        <IconCheck size={12} /> Saved
      </span>
    );
  }
  return (
    <button
      onClick={onRetry}
      className="chip bg-red-50 text-swiggy-red shrink-0 mt-1 inline-flex items-center gap-1"
    >
      <IconRefresh size={12} /> Not saved · retry
    </button>
  );
}

// =====================================================
// 4. Thanks
// =====================================================
function Thanks({
  guestName,
  hostName,
  picks,
  itemCount,
  total,
  onEdit,
}: {
  guestName: string;
  hostName: string;
  picks: GuestPick[];
  itemCount: number;
  total: number;
  onEdit: () => void;
}) {
  return (
    <div>
      <BrandHeader />

      {/* Success hero */}
      <div className="bg-mesh-warm bg-[length:200%_200%] animate-gradient-shift text-white text-center px-5 pt-9 pb-16 relative overflow-hidden">
        <div className="absolute -top-20 -right-12 w-72 h-72 rounded-full bg-white/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-12 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative max-w-md mx-auto">
          <div className="w-20 h-20 mx-auto rounded-full bg-white grid place-items-center text-swiggy-green shadow-glow animate-float">
            <IconCheck size={40} />
          </div>
          <h1 className="mt-4 text-[26px] font-black tracking-tight leading-tight">
            You&rsquo;re all set{guestName ? <>, {firstName(guestName)}</> : null}!
          </h1>
          <p className="mt-1.5 text-[14px] text-white/90 leading-relaxed">
            Your{' '}
            <b className="text-white">
              {itemCount} item{itemCount === 1 ? '' : 's'}
            </b>{' '}
            are with {firstName(hostName)} — you&rsquo;re on the order.
          </p>
          <span className="mt-3.5 inline-flex items-center gap-1.5 chip bg-white/15 backdrop-blur text-white border border-white/25 font-bold">
            <IconCheck size={13} /> You&rsquo;re Ready
          </span>
        </div>
      </div>

      {/* Picks, pulled over the hero */}
      <div className="max-w-md mx-auto px-5 -mt-8 relative pb-10">
        {picks.length > 0 && (
          <div className="animate-fade-in-up">
            <PicksSummary picks={picks} total={total} />
          </div>
        )}

        <button onClick={onEdit} className="btn-secondary w-full mt-4">
          Change my picks
        </button>
        <p className="mt-2.5 text-[11px] text-center text-ink-tertiary">
          You can keep editing until {firstName(hostName)} places the order.
        </p>
      </div>
    </div>
  );
}

// =====================================================
// States
// =====================================================
function LoadingShell() {
  return (
    <div className="min-h-screen bg-surface-secondary">
      <div className="bg-mesh-warm h-56 animate-pulse" />
      <div className="max-w-md mx-auto px-5 -mt-6">
        <div className="card p-4 space-y-3 animate-pulse">
          <div className="h-3 w-24 rounded bg-surface-secondary" />
          <div className="h-4 w-full rounded bg-surface-secondary" />
          <div className="h-4 w-2/3 rounded bg-surface-secondary" />
          <div className="h-10 w-full rounded-lg bg-surface-secondary" />
        </div>
      </div>
      <div className="sr-only" role="status">
        Loading your invite
      </div>
    </div>
  );
}

function FatalShell({
  kind,
  message,
  onRetry,
}: {
  kind: 'invalid' | 'error';
  message: string;
  onRetry: () => void;
}) {
  const invalid = kind === 'invalid';
  return (
    <div className="min-h-screen bg-surface-secondary grid place-items-center px-5">
      <div className="max-w-md w-full card p-8 text-center animate-fade-in">
        <div
          className={`w-16 h-16 rounded-2xl grid place-items-center mx-auto mb-3 ${
            invalid ? 'bg-surface-secondary text-ink-tertiary' : 'bg-red-50 text-swiggy-red'
          }`}
        >
          {invalid ? <IconSearch size={30} /> : <IconAlertTriangle size={30} />}
        </div>
        <h1 className="text-xl font-bold">
          {invalid ? 'This invite link is not valid' : "We couldn't load this invite"}
        </h1>
        <p className="text-sm text-ink-tertiary mt-2 leading-relaxed">{message}</p>
        {invalid ? (
          <p className="text-xs text-ink-tertiary mt-4">
            Ask the host to send you a fresh link — invites expire once the order is placed.
          </p>
        ) : (
          <button onClick={onRetry} className="btn-secondary mt-5 inline-flex">
            <IconRefresh size={16} /> Try again
          </button>
        )}
      </div>
    </div>
  );
}

/** hasAddress === false — the backend cannot resolve any Swiggy menu yet. */
function HostSettingUp({ hostName, onRefresh }: { hostName: string; onRefresh: () => void }) {
  return (
    <div className="card p-8 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-surface-secondary grid place-items-center text-ink-tertiary mx-auto mb-3">
        <IconMapPin size={30} />
      </div>
      <div className="font-semibold">{firstName(hostName)} is still setting up</div>
      <div className="text-xs text-ink-tertiary mt-1 mb-4 leading-relaxed">
        They haven&rsquo;t picked a delivery address yet, so Swiggy can&rsquo;t show restaurants
        near the party. You&rsquo;re on the guest list — come back to this link in a bit.
      </div>
      <button onClick={onRefresh} className="btn-secondary inline-flex">
        <IconRefresh size={16} /> Check again
      </button>
    </div>
  );
}

function ErrorCard({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="card p-8 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-red-50 grid place-items-center text-swiggy-red mx-auto mb-3">
        <IconAlertTriangle size={30} />
      </div>
      <div className="font-semibold">{title}</div>
      <div className="text-xs text-ink-tertiary mt-1 mb-4 break-words">{message}</div>
      <button onClick={onRetry} className="btn-secondary inline-flex">
        <IconRefresh size={16} /> Try again
      </button>
    </div>
  );
}

function EmptyResults({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="card p-8 text-center mt-3 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-surface-secondary grid place-items-center text-ink-tertiary mx-auto mb-3">
        <IconSearch size={32} />
      </div>
      <div className="font-semibold">
        {query.trim() ? `Nothing for “${query.trim()}”` : 'No restaurants match'}
      </div>
      <div className="text-xs text-ink-tertiary mt-1 mb-4">
        Swiggy found nothing delivering here with those filters.
      </div>
      <button onClick={onClear} className="btn-secondary inline-flex">
        Clear filters
      </button>
    </div>
  );
}

function RestaurantSkeleton() {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="aspect-[16/10] bg-surface-secondary" />
      <div className="p-3 space-y-2">
        <div className="h-3.5 w-2/3 rounded bg-surface-secondary" />
        <div className="h-3 w-1/2 rounded bg-surface-secondary" />
      </div>
    </div>
  );
}

function DishSkeleton() {
  return (
    <div className="flex items-start gap-4 py-4 animate-pulse">
      <div className="flex-1 space-y-2">
        <div className="h-3 w-16 rounded bg-surface-secondary" />
        <div className="h-4 w-2/3 rounded bg-surface-secondary" />
        <div className="h-3 w-12 rounded bg-surface-secondary" />
      </div>
      <div className="w-24 h-24 rounded-2xl bg-surface-secondary shrink-0" />
    </div>
  );
}
