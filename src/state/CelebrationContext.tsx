import { createContext, useContext, useMemo, useState, ReactNode, useCallback } from 'react';
import {
  AddonItem,
  Cuisine,
  DietaryPref,
  Dish,
  Friend,
  GuestStatus,
  Member,
  Occasion,
  Restaurant,
  defaultHost,
  guestColors,
  occasions,
  restaurants,
} from '../data/mock';

export type CartLine = {
  dish: Dish;
  qty: number;
  pickedBy: Member;
  restaurantId: string;
};

type AddByContact = {
  name: string;
  contact: { type: 'email' | 'phone'; value: string };
  dietary: DietaryPref;
  isKid: boolean;
};

type Ctx = {
  // ----- Plan setup -----
  occasion: Occasion | null;
  setOccasion: (o: Occasion | null) => void;
  date: string;
  setDate: (d: string) => void;
  time: string;
  setTime: (t: string) => void;
  address: string;
  setAddress: (s: string) => void;

  // ----- People -----
  host: Member;
  setHostDietary: (d: DietaryPref) => void;
  guests: Member[];
  members: Member[]; // [host, ...guests]
  inviteToken: string;

  addGuestFromFriend: (f: Friend) => void;
  addGuestByContact: (g: AddByContact) => Member;
  removeGuest: (id: string) => void;
  updateGuest: (id: string, patch: Partial<Member>) => void;
  setGuestStatus: (id: string, status: GuestStatus) => void;

  // derived
  groupSize: number;
  vegCount: number;
  nonVegCount: number;
  kidCount: number;

  // ----- Cart -----
  carts: CartLine[];
  addLine: (dish: Dish, restaurantId: string, member: Member) => void;
  removeLine: (lineIndex: number) => void;
  changeQty: (lineIndex: number, delta: number) => void;
  cuisinesInCart: Set<Cuisine>;
  restaurantsInCart: Restaurant[];
  foodTotal: number;

  // ----- Instamart add-ons -----
  addonSelections: AddonItem[];
  toggleAddon: (a: AddonItem) => void;
  addonTotal: number;

  occasions: Occasion[];
};

const C = createContext<Ctx | null>(null);

let _seq = 0;
const nextId = () => `g_${Date.now().toString(36)}_${(++_seq).toString(36)}`;

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  // plan
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('20:00');
  const [address, setAddress] = useState('Indiranagar 100ft Rd, Bengaluru');

  // host (mutable for dietary preference only)
  const [host, setHost] = useState<Member>(defaultHost);
  const setHostDietary = useCallback(
    (d: DietaryPref) => setHost((h) => ({ ...h, dietary: d })),
    []
  );

  // guests — starts EMPTY
  const [guests, setGuests] = useState<Member[]>([]);

  // mock invite token (per celebration)
  const [inviteToken] = useState(
    () => Math.random().toString(36).slice(2, 8).toUpperCase()
  );

  // cart — starts EMPTY
  const [carts, setCarts] = useState<CartLine[]>([]);
  const [addonSelections, setAddonSelections] = useState<AddonItem[]>([]);

  // ----- Guests mutations -----
  const addGuestFromFriend = useCallback((f: Friend) => {
    setGuests((prev) => {
      if (prev.some((g) => g.id === f.id)) return prev;
      const g: Member = {
        id: f.id,
        name: f.name,
        initials: f.initials,
        color: f.color,
        contact: f.contact,
        dietary: f.dietary,
        isKid: false,
        status: 'invited',
        fromFriend: true,
      };
      return [...prev, g];
    });
  }, []);

  const addGuestByContact = useCallback((data: AddByContact): Member => {
    const id = nextId();
    const color = guestColors[Math.floor(Math.random() * guestColors.length)];
    const g: Member = {
      id,
      name: data.name,
      initials: initialsFor(data.name),
      color,
      contact: data.contact,
      dietary: data.dietary,
      isKid: data.isKid,
      status: 'invited',
    };
    setGuests((prev) => [...prev, g]);
    return g;
  }, []);

  const removeGuest = useCallback((id: string) => {
    setGuests((prev) => prev.filter((g) => g.id !== id));
    // also remove their cart lines
    setCarts((prev) => prev.filter((l) => l.pickedBy.id !== id));
  }, []);

  const updateGuest = useCallback((id: string, patch: Partial<Member>) => {
    setGuests((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }, []);

  const setGuestStatus = useCallback(
    (id: string, status: GuestStatus) => updateGuest(id, { status }),
    [updateGuest]
  );

  // ----- Cart mutations -----
  const addLine = useCallback((dish: Dish, restaurantId: string, member: Member) => {
    setCarts((prev) => {
      const idx = prev.findIndex(
        (l) => l.dish.id === dish.id && l.pickedBy.id === member.id
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { dish, qty: 1, pickedBy: member, restaurantId }];
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

  const toggleAddon = useCallback((a: AddonItem) => {
    setAddonSelections((prev) =>
      prev.some((x) => x.id === a.id) ? prev.filter((x) => x.id !== a.id) : [...prev, a]
    );
  }, []);

  // ----- Derived -----
  const members = useMemo(() => [host, ...guests], [host, guests]);

  const cuisinesInCart = useMemo(() => {
    const s = new Set<Cuisine>();
    carts.forEach((l) => {
      const r = restaurants.find((r) => r.id === l.restaurantId);
      r?.cuisines.forEach((c) => s.add(c));
    });
    return s;
  }, [carts]);

  const restaurantsInCart = useMemo(() => {
    const ids = new Set(carts.map((l) => l.restaurantId));
    return restaurants.filter((r) => ids.has(r.id));
  }, [carts]);

  const foodTotal = useMemo(
    () => carts.reduce((s, l) => s + l.dish.price * l.qty, 0),
    [carts]
  );
  const addonTotal = useMemo(
    () => addonSelections.reduce((s, a) => s + a.price, 0),
    [addonSelections]
  );

  const groupSize = members.length;

  const isVegLike = (d?: DietaryPref) => d === 'veg' || d === 'jain' || d === 'vegan';
  const vegCount = useMemo(() => members.filter((m) => isVegLike(m.dietary)).length, [members]);
  const nonVegCount = useMemo(() => members.filter((m) => m.dietary === 'non-veg').length, [members]);
  const kidCount = useMemo(() => members.filter((m) => m.isKid).length, [members]);

  const value: Ctx = {
    occasion, setOccasion,
    date, setDate, time, setTime,
    address, setAddress,

    host, setHostDietary,
    guests, members,
    inviteToken,

    addGuestFromFriend, addGuestByContact, removeGuest, updateGuest, setGuestStatus,

    groupSize, vegCount, nonVegCount, kidCount,

    carts, addLine, removeLine, changeQty,
    cuisinesInCart, restaurantsInCart, foodTotal,

    addonSelections, toggleAddon, addonTotal,
    occasions,
  };

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useCelebration() {
  const v = useContext(C);
  if (!v) throw new Error('useCelebration must be used inside CelebrationProvider');
  return v;
}
