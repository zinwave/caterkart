import {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  DietaryPref,
  GuestStatus,
  Member,
  Occasion,
  guestColors,
  occasions,
} from '../data/mock';
import type { Dish, Product, Restaurant } from '../lib/mcp/types';
import { api } from '../lib/api';
import type { CelebrationMember, Contact, GuestInput } from '../lib/api';
import { usePersonalAuth, initialsFor as authInitials } from '../state/PersonalAuthContext';
import { useSwiggy } from './SwiggyContext';

export type CartLine = {
  dish: Dish;
  qty: number;
  pickedBy: Member;
  restaurantId: string;
};

/** One Instamart add-on and how many of it are in the basket. */
export type AddonLine = {
  product: Product;
  qty: number;
};

/**
 * One real Swiggy order that has been placed, recorded onto the event's running
 * tab. The event stays open across many of these ("rounds") until the host
 * settles up — a Splitwise-style ledger for the whole party.
 */
export type LedgerOrder = {
  key: string;
  round: number;
  restaurantName: string;
  /** 'food' (a restaurant order) or 'instamart' (the supplies order). */
  kind: 'food' | 'instamart';
  /** Present when Swiggy accepted the order; otherwise `error` explains why. */
  orderId?: string;
  error?: string;
  /** Swiggy's real to-pay for this order (taxes + delivery included). */
  toPay: number;
};

type AddByContact = {
  name: string;
  contact: { type: 'email' | 'phone'; value: string };
  /** Optional — the guest sets their own diet on their invite link. */
  dietary?: DietaryPref;
  isKid?: boolean;
};

type Ctx = {
  // ----- Plan setup -----
  occasion: Occasion | null;
  setOccasion: (o: Occasion | null) => void;
  /** Host-given name for this event (e.g. "Riya's 25th"). Optional. */
  eventName: string;
  setEventName: (v: string) => void;
  /** What to show as the event's title: the custom name, else the event type. */
  eventTitle: string;
  date: string;
  setDate: (d: string) => void;
  time: string;
  setTime: (t: string) => void;

  /**
   * Stagger placement so every restaurant ARRIVES together (slowest kitchen
   * ordered first, quicker ones held back). Swiggy has no scheduled delivery, so
   * this is the only way to sync — and it means the browser must stay open while
   * the held-back orders wait. Off = place everything immediately.
   */
  syncedDelivery: boolean;
  setSyncedDelivery: (v: boolean) => void;

  // ----- People -----
  host: Member;
  setHostDietary: (d: DietaryPref) => void;
  guests: Member[];
  members: Member[]; // [host, ...guests]
  inviteToken: string;

  /**
   * Adds the guest on the BACKEND and returns their personal invite link.
   * Creates the celebration first if this is the first guest.
   */
  addGuestByContact: (g: AddByContact) => Promise<{ member: Member; inviteUrl: string }>;
  removeGuest: (id: string) => void;
  updateGuest: (id: string, patch: Partial<Member>) => void;
  setGuestStatus: (id: string, status: GuestStatus) => void;

  /** The host's real address book: people they have actually invited before. */
  contacts: Contact[];
  contactsLoading: boolean;

  /** Backend id — null until the first guest is invited (created lazily). */
  celebrationId: string | null;
  /** A link anyone can open (as opposed to a guest's personal link). */
  shareLink: string | null;
  createShareLink: () => Promise<string>;
  /** Personal invite link per guest id. */
  inviteLinks: Record<string, string>;

  /** Lines guests picked, mirrored from the backend. Read-only for the host. */
  guestLines: CartLine[];
  /** Host's own picks + every guest's picks — what actually gets ordered. */
  allLines: CartLine[];
  syncing: boolean;
  refreshGuests: () => Promise<void>;

  // derived
  groupSize: number;
  vegCount: number;
  nonVegCount: number;
  kidCount: number;

  // ----- Cart -----
  carts: CartLine[];
  /** Pass the whole Restaurant: Swiggy menus are fetched per-restaurant, so the
   *  context keeps a registry of the ones seen rather than a global catalogue. */
  addLine: (dish: Dish, restaurant: Restaurant, member: Member) => void;
  removeLine: (lineIndex: number) => void;
  changeQty: (lineIndex: number, delta: number) => void;
  cuisinesInCart: Set<string>;
  restaurantsInCart: Restaurant[];
  restaurantById: (id: string) => Restaurant | undefined;
  foodTotal: number;

  // ----- Instamart add-ons -----
  /** One entry per distinct product; `qty` carries how many. */
  addonSelections: AddonLine[];
  /** Instamart items guests added (read-only). */
  guestAddons: AddonLine[];
  /** Host + guest Instamart items merged — the single Instamart order. */
  allAddons: AddonLine[];
  /** Add the product, or bump its qty by one if it's already in. */
  addAddon: (a: Product) => void;
  /** Set an exact qty. 0 (or less) removes the line. Keyed by `Product.id` — the spinId. */
  setAddonQty: (productId: string, qty: number) => void;
  /** All-or-nothing: adds one if absent, drops the whole line (any qty) if present. */
  toggleAddon: (a: Product) => void;
  /** Σ price × qty. */
  addonTotal: number;
  /** Σ qty — total units, not distinct lines. */
  addonCount: number;

  // ----- Event ledger (the open "tab") -----
  /** Every order placed for this event so far, across all rounds. */
  ledger: LedgerOrder[];
  /** Which round the host is currently building (1-based). */
  round: number;
  /** Food spend per memberId, accumulated across rounds — drives by-item split. */
  spendByMember: Record<string, number>;
  /** Append a placed round to the tab (orders + who spent what this round). */
  recordRound: (orders: LedgerOrder[], roundSpendByMember: Record<string, number>) => void;
  /** Mark the guests' pending picks as placed so the next round starts fresh. */
  commitPlaced: () => void;
  /** Keep the event + guests, clear the current cart so a new order can be built. */
  startNewRound: () => void;
  /** Wipe the whole event (tab, cart, round) — for starting fresh. */
  resetEvent: () => void;
  /** Σ to-pay across successfully placed orders. */
  eventTotal: number;

  occasions: Occasion[];
};

const C = createContext<Ctx | null>(null);

let _seq = 0;
const nextId = () => `g_${Date.now().toString(36)}_${(++_seq).toString(36)}`;

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Stable identity for a guest's pick line — used to track what's been placed. */
const guestKey = (l: CartLine) => `${l.restaurantId}|${l.dish.id}|${l.pickedBy.id}`;

/**
 * Invite links are minted with the server's configured WEB_ORIGIN (e.g. :5173),
 * which won't match the port Vite actually serves on (:5174 when 5173 is taken).
 * Rewrite the origin to the live app so the link always opens THIS running app.
 */
function toAppUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${window.location.origin}${u.pathname}${u.search}${u.hash}`;
  } catch {
    return url;
  }
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  // plan
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [eventName, setEventName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('20:00');
  const [syncedDelivery, setSyncedDelivery] = useState(true);

  // ── Host — the REAL signed-in user (Swiggy session), not a seeded mock.
  const { user } = usePersonalAuth();
  const { addressId, address } = useSwiggy();
  const [hostDietary, setHostDietaryState] = useState<DietaryPref>('non-veg');

  const host: Member = useMemo(
    () => ({
      id: 'host',
      name: user?.name ?? 'You',
      initials: user ? authInitials(user.name) : 'Y',
      color: 'bg-swiggy-orange',
      isHost: true,
      dietary: hostDietary,
      // Swiggy does not always hand back a phone hint, and the host's contact
      // is only ever used to show them to their own guests — so no hint simply
      // means no contact line, not a broken member.
      contact: user?.phone ? { type: 'phone' as const, value: user.phone } : undefined,
    }),
    [user, hostDietary],
  );
  const setHostDietary = useCallback((d: DietaryPref) => setHostDietaryState(d), []);

  // The event's display title: the host's custom name if given, else the type.
  const eventTitle = eventName.trim() || occasion?.name || 'Celebration';

  // ── Backend celebration (created lazily, on the first invite) ────────────
  const [celebrationId, setCelebrationId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({});
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [guestPicks, setGuestPicks] = useState<CartLine[]>([]);

  // guests — starts EMPTY
  const [guests, setGuests] = useState<Member[]>([]);

  // mock invite token (per celebration)
  const [inviteToken] = useState(
    () => Math.random().toString(36).slice(2, 8).toUpperCase()
  );

  // cart — starts EMPTY
  const [carts, setCarts] = useState<CartLine[]>([]);
  const [addonSelections, setAddonSelections] = useState<AddonLine[]>([]);
  // Instamart items guests added on their own devices (read-only for the host).
  const [guestAddonsRaw, setGuestAddonsRaw] = useState<AddonLine[]>([]);

  // Guest picks persist on the backend, so once a round is PLACED we remember
  // how much of each was ordered and subtract it — otherwise "Add another order"
  // would re-place the same guest dishes/Instamart items every round.
  const [placedGuestFood, setPlacedGuestFood] = useState<Record<string, number>>({});
  const [placedGuestAddons, setPlacedGuestAddons] = useState<Record<string, number>>({});

  // event ledger — the running tab across rounds
  const [ledger, setLedger] = useState<LedgerOrder[]>([]);
  const [round, setRound] = useState(1);
  const [spendByMember, setSpendByMember] = useState<Record<string, number>>({});

  // Swiggy has no bulk-catalogue call — restaurants arrive one search at a time.
  // Remember the ones we've put in the cart so we can render them later without
  // refetching (the old code could just look them up in a global mock array).
  const [seenRestaurants, setSeenRestaurants] = useState<Record<string, Restaurant>>({});

  // ── The host's real address book. Empty for a brand-new host — we never
  //    invent friends.
  useEffect(() => {
    // Only the signed-in host has an address book. The guest invite page is
    // wrapped by this provider too, so without this guard it would fire a
    // pointless host-scoped request.
    if (!user) {
      setContacts([]);
      return;
    }
    let alive = true;
    setContactsLoading(true);
    api.celebrations
      .contacts()
      .then((c) => alive && setContacts(c))
      .catch(() => alive && setContacts([]))
      .finally(() => alive && setContactsLoading(false));
    return () => {
      alive = false;
    };
  }, [user]);

  /**
   * The celebration only needs to exist on the server once someone is invited —
   * that's the first moment a guest could open a link. Created lazily so a host
   * just browsing never writes a row.
   */
  const ensureCelebration = useCallback(async (): Promise<string> => {
    if (celebrationId) return celebrationId;
    const c = await api.celebrations.create({
      occasion: eventTitle,
      hostName: user?.name,
      addressLabel: address ? `${address.label} · ${address.display}` : 'Address not set',
      swiggyAddressId: addressId ?? undefined,
      members: [{ name: user?.name ?? 'Host', phone: user?.phone ?? undefined, isHost: true }],
    });
    setCelebrationId(c.id);
    return c.id;
  }, [celebrationId, eventTitle, user, address, addressId]);

  /** Map a backend member onto the UI's Member shape (colour/initials are ours). */
  const toMember = useCallback((m: CelebrationMember, i: number): Member => {
    const statusMap: Record<string, GuestStatus> = {
      INVITED: 'invited',
      JOINED: 'joined',
      PICKING: 'picking',
      READY: 'ready',
    };
    return {
      id: m.id,
      name: m.name,
      initials: initialsFor(m.name),
      color: guestColors[i % guestColors.length],
      contact: m.email
        ? { type: 'email', value: m.email }
        : m.phone
          ? { type: 'phone', value: m.phone }
          : undefined,
      dietary: (m.dietary as DietaryPref) ?? undefined,
      isKid: m.isKid,
      status: statusMap[m.status] ?? 'invited',
    };
  }, []);

  /** Pull guests AND their picks from the backend — this is how the host sees
   *  what people chose on their own phones. */
  const refreshGuests = useCallback(async () => {
    if (!celebrationId) return;
    setSyncing(true);
    try {
      const c = await api.celebrations.get(celebrationId);
      const nonHost = c.members.filter((m) => !m.isHost);
      setGuests(nonHost.map(toMember));

      const lines: CartLine[] = [];
      const addonLines: AddonLine[] = [];
      nonHost.forEach((m, i) => {
        const picker = toMember(m, i);
        (m.picks ?? []).forEach((p) => {
          // Instamart picks ride the same storage under a sentinel restaurantId.
          if (p.restaurantId === 'instamart') {
            addonLines.push({
              product: {
                id: p.dishId,
                productId: p.dishId,
                name: p.dishName,
                unit: '',
                price: p.price,
                mrp: p.price,
                imageUrl: p.imageUrl,
                inStock: true,
              },
              qty: p.qty,
            });
            return;
          }
          // Rebuild a Dish from the snapshot the guest saved.
          const dish: Dish = {
            id: p.dishId,
            name: p.dishName,
            price: p.price,
            veg: !!p.veg,
            bestseller: false,
            imageUrl: p.imageUrl,
            inStock: true,
            hasVariants: false,
            hasAddons: false,
          };
          lines.push({ dish, qty: p.qty, pickedBy: picker, restaurantId: p.restaurantId });
          // The host may never have opened this restaurant, so register a stub so
          // it still renders and can be priced. (Swiggy re-prices it for real at
          // checkout, so a missing ETA only softens the delivery-sync estimate.)
          setSeenRestaurants((prev) =>
            prev[p.restaurantId]
              ? prev
              : {
                  ...prev,
                  [p.restaurantId]: {
                    id: p.restaurantId,
                    name: p.restaurantName,
                    // The pick carries no restaurant photo, so use the dish image
                    // as a stand-in thumbnail instead of the empty placeholder.
                    imageUrl: p.imageUrl,
                    cuisines: [],
                    // ETA / area / rating ride along on the pick so the host — who
                    // never opened this restaurant — can still show them.
                    rating: p.restaurantRating ?? null,
                    ratingCount: '',
                    etaMin: p.restaurantEtaMin ?? 0,
                    etaRange: p.restaurantEtaRange ?? '',
                    costForTwo: '',
                    areaName: p.restaurantArea ?? '',
                    distanceKm: null,
                    isOpen: true,
                  },
                },
          );
        });
      });
      setGuestPicks(lines);
      setGuestAddonsRaw(addonLines);
    } finally {
      setSyncing(false);
    }
  }, [celebrationId, toMember]);

  // Poll while a celebration is live so guests appear as they join and pick.
  const pollRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!celebrationId) return;
    void refreshGuests();
    pollRef.current = window.setInterval(() => void refreshGuests(), 8000);
    return () => window.clearInterval(pollRef.current);
  }, [celebrationId, refreshGuests]);

  // ----- Guests mutations (backed by the API) -----
  const addGuestByContact = useCallback(
    async (data: AddByContact): Promise<{ member: Member; inviteUrl: string }> => {
      const id = await ensureCelebration();
      const payload: GuestInput = {
        name: data.name,
        // Diet is the guest's to set on their invite link; don't presume it.
        ...(data.dietary ? { dietary: data.dietary } : {}),
        isKid: data.isKid ?? false,
        ...(data.contact.type === 'email'
          ? { email: data.contact.value }
          : { phone: data.contact.value }),
      };
      const { member, invite } = await api.celebrations.addGuest(id, payload);
      const m = toMember(member, guests.length);
      setGuests((prev) => [...prev, m]);
      const url = toAppUrl(invite.url);
      setInviteLinks((prev) => ({ ...prev, [m.id]: url }));
      return { member: m, inviteUrl: url };
    },
    [ensureCelebration, toMember, guests.length],
  );

  const createShareLink = useCallback(async (): Promise<string> => {
    const id = await ensureCelebration();
    const invite = await api.celebrations.invite(id);
    const url = toAppUrl(invite.url);
    setShareLink(url);
    return url;
  }, [ensureCelebration]);

  const removeGuest = useCallback(
    (id: string) => {
      setGuests((prev) => prev.filter((g) => g.id !== id));
      setCarts((prev) => prev.filter((l) => l.pickedBy.id !== id));
      setGuestPicks((prev) => prev.filter((l) => l.pickedBy.id !== id));
      if (celebrationId) void api.celebrations.removeGuest(celebrationId, id).catch(() => undefined);
    },
    [celebrationId],
  );

  const updateGuest = useCallback(
    (id: string, patch: Partial<Member>) => {
      setGuests((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
      if (celebrationId && (patch.name || patch.dietary || patch.isKid !== undefined)) {
        void api.celebrations
          .updateGuest(celebrationId, id, {
            name: patch.name,
            dietary: patch.dietary,
            isKid: patch.isKid,
          })
          .catch(() => undefined);
      }
    },
    [celebrationId],
  );

  const setGuestStatus = useCallback(
    (id: string, status: GuestStatus) => updateGuest(id, { status }),
    [updateGuest]
  );

  // ----- Cart mutations -----
  const addLine = useCallback((dish: Dish, restaurant: Restaurant, member: Member) => {
    setSeenRestaurants((prev) =>
      prev[restaurant.id] ? prev : { ...prev, [restaurant.id]: restaurant },
    );
    setCarts((prev) => {
      const idx = prev.findIndex(
        (l) => l.dish.id === dish.id && l.pickedBy.id === member.id
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { dish, qty: 1, pickedBy: member, restaurantId: restaurant.id }];
    });
  }, []);

  const removeLine = useCallback((i: number) => {
    setCarts((prev) => prev.filter((_, idx) => idx !== i));
  }, []);

  const changeQty = useCallback((i: number, delta: number) => {
    setCarts((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], qty: Math.max(0, next[i].qty + delta) };
      return next.filter((l) => l.qty > 0);
    });
  }, []);

  // ----- Instamart add-on mutations -----
  // Keyed on Product.id (the spinId) — the same identity the Instamart cart uses.
  const addAddon = useCallback((a: Product) => {
    setAddonSelections((prev) => {
      const idx = prev.findIndex((l) => l.product.id === a.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      // Re-store the product on every add: prices and stock come from a live
      // Instamart fetch, so the freshest copy wins.
      return [...prev, { product: a, qty: 1 }];
    });
  }, []);

  const setAddonQty = useCallback((productId: string, qty: number) => {
    const clamped = Math.max(0, Math.floor(qty));
    setAddonSelections((prev) =>
      prev.flatMap((l) =>
        l.product.id === productId
          ? clamped === 0
            ? [] // 0 removes the line
            : [{ ...l, qty: clamped }]
          : [l]
      )
    );
  }, []);

  const toggleAddon = useCallback((a: Product) => {
    setAddonSelections((prev) =>
      prev.some((l) => l.product.id === a.id)
        ? prev.filter((l) => l.product.id !== a.id)
        : [...prev, { product: a, qty: 1 }]
    );
  }, []);

  // ----- Event ledger mutations -----
  const recordRound = useCallback(
    (orders: LedgerOrder[], roundSpendByMember: Record<string, number>) => {
      setLedger((prev) => [...prev, ...orders]);
      setSpendByMember((prev) => {
        const next = { ...prev };
        for (const [id, amt] of Object.entries(roundSpendByMember)) {
          next[id] = (next[id] ?? 0) + amt;
        }
        return next;
      });
    },
    [],
  );

  const startNewRound = useCallback(() => {
    // Keep the event, guests and tab; just clear the basket for a fresh order.
    setCarts([]);
    setAddonSelections([]);
    setRound((r) => r + 1);
  }, []);

  const resetEvent = useCallback(() => {
    setLedger([]);
    setSpendByMember({});
    setRound(1);
    setCarts([]);
    setAddonSelections([]);
    setPlacedGuestFood({});
    setPlacedGuestAddons({});
  }, []);

  const eventTotal = useMemo(
    () => ledger.reduce((s, o) => s + (o.orderId ? o.toPay : 0), 0),
    [ledger],
  );

  // ----- Derived -----
  const members = useMemo(() => [host, ...guests], [host, guests]);

  const cuisinesInCart = useMemo(() => {
    const s = new Set<string>();
    carts.forEach((l) => {
      seenRestaurants[l.restaurantId]?.cuisines.forEach((c) => s.add(c));
    });
    return s;
  }, [carts, seenRestaurants]);

  /**
   * The host's own picks PLUS everything the guests chose on their phones. This
   * — not `carts` — is what actually gets ordered. `carts` stays host-only
   * because GroupCart mutates it by index; guest lines are backend-owned.
   */
  // Guests' picks minus what's already been placed in earlier rounds. (The
  // host's own `carts` are cleared each round by startNewRound, so only the
  // backend-owned guest picks need this subtraction.)
  const guestLines = useMemo(
    () =>
      guestPicks
        .map((l) => {
          const placed = placedGuestFood[guestKey(l)] ?? 0;
          return placed > 0 ? { ...l, qty: l.qty - placed } : l;
        })
        .filter((l) => l.qty > 0),
    [guestPicks, placedGuestFood],
  );
  const allLines = useMemo(() => [...carts, ...guestLines], [carts, guestLines]);

  const pendingGuestAddons = useMemo(
    () =>
      guestAddonsRaw
        .map((l) => {
          const placed = placedGuestAddons[l.product.id] ?? 0;
          return placed > 0 ? { ...l, qty: l.qty - placed } : l;
        })
        .filter((l) => l.qty > 0),
    [guestAddonsRaw, placedGuestAddons],
  );

  /** Mark the guests' currently-pending picks as placed (after a round goes out). */
  const commitPlaced = useCallback(() => {
    setPlacedGuestFood((prev) => {
      const next = { ...prev };
      for (const l of guestLines) {
        const k = guestKey(l);
        next[k] = (next[k] ?? 0) + l.qty;
      }
      return next;
    });
    setPlacedGuestAddons((prev) => {
      const next = { ...prev };
      for (const l of pendingGuestAddons) next[l.product.id] = (next[l.product.id] ?? 0) + l.qty;
      return next;
    });
  }, [guestLines, pendingGuestAddons]);

  const restaurantsInCart = useMemo(() => {
    const ids = [...new Set(allLines.map((l) => l.restaurantId))];
    return ids.map((id) => seenRestaurants[id]).filter((r): r is Restaurant => !!r);
  }, [allLines, seenRestaurants]);

  const restaurantById = useCallback(
    (id: string) => seenRestaurants[id],
    [seenRestaurants],
  );

  const foodTotal = useMemo(
    () => allLines.reduce((s, l) => s + l.dish.price * l.qty, 0),
    [allLines]
  );
  // Everything that becomes the ONE Instamart order: the host's picks plus every
  // guest's, merged by product so a shared item doesn't appear (or place) twice.
  const allAddons = useMemo(() => {
    const map = new Map<string, AddonLine>();
    for (const l of [...addonSelections, ...pendingGuestAddons]) {
      const ex = map.get(l.product.id);
      if (ex) ex.qty += l.qty;
      else map.set(l.product.id, { product: l.product, qty: l.qty });
    }
    return [...map.values()];
  }, [addonSelections, pendingGuestAddons]);

  const addonTotal = useMemo(
    () => allAddons.reduce((s, l) => s + l.product.price * l.qty, 0),
    [allAddons]
  );
  const addonCount = useMemo(
    () => allAddons.reduce((s, l) => s + l.qty, 0),
    [allAddons]
  );

  const groupSize = members.length;

  const isVegLike = (d?: DietaryPref) => d === 'veg' || d === 'jain' || d === 'vegan';
  const vegCount = useMemo(() => members.filter((m) => isVegLike(m.dietary)).length, [members]);
  const nonVegCount = useMemo(() => members.filter((m) => m.dietary === 'non-veg').length, [members]);
  const kidCount = useMemo(() => members.filter((m) => m.isKid).length, [members]);

  const value: Ctx = {
    occasion, setOccasion,
    eventName, setEventName, eventTitle,
    date, setDate, time, setTime,
    syncedDelivery, setSyncedDelivery,

    host, setHostDietary,
    guests, members,
    inviteToken,

    addGuestByContact, removeGuest, updateGuest, setGuestStatus,
    contacts, contactsLoading,
    celebrationId, shareLink, createShareLink, inviteLinks,
    guestLines, allLines, syncing, refreshGuests,

    groupSize, vegCount, nonVegCount, kidCount,

    carts, addLine, removeLine, changeQty,
    cuisinesInCart, restaurantsInCart, restaurantById, foodTotal,

    addonSelections, guestAddons: pendingGuestAddons, allAddons, addAddon, setAddonQty, toggleAddon, addonTotal, addonCount,

    ledger, round, spendByMember, recordRound, commitPlaced, startNewRound, resetEvent, eventTotal,
    occasions,
  };

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useCelebration() {
  const v = useContext(C);
  if (!v) throw new Error('useCelebration must be used inside CelebrationProvider');
  return v;
}
