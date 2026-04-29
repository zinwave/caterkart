import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { AddonItem, Member, restaurants as ALL_RESTAURANTS } from '../data/mock';
import { CartLine } from './CelebrationContext';

export type OrderStatus = 'placed' | 'preparing' | 'on-the-way' | 'delivered' | 'cancelled';

export type OrderBill = {
  food: number;
  addons: number;
  delivery: number;
  platform: number;
  taxes: number;
  grand: number;
};

export type OrderSplitEntry = {
  memberId: string;
  amount: number;
  paid: boolean;
};

export type Order = {
  id: string;
  invoiceNo: string;
  occasionName: string;
  occasionEmoji: string;
  partyDate: string; // ISO date
  partyTime: string; // HH:mm
  address: string;
  hostName: string;
  hostInitial: string;
  hostColor: string;
  status: OrderStatus;
  members: Member[];
  lines: CartLine[];
  addons: AddonItem[];
  bill: OrderBill;
  splitMode: 'equal' | 'by-item';
  split: OrderSplitEntry[];
  placedAt: string; // ISO timestamp
  expectedAt: string; // ISO timestamp
  rider?: { name: string; phone: string; vehicle: string };
};

const STORAGE_KEY = 'caterkart.orders.v1';

type Ctx = {
  orders: Order[];
  getOrder: (id: string) => Order | undefined;
  addOrder: (o: Omit<Order, 'id' | 'invoiceNo' | 'placedAt' | 'status'>) => Order;
  updateStatus: (id: string, status: OrderStatus) => void;
  markPaid: (orderId: string, memberId: string) => void;
};

const C = createContext<Ctx | null>(null);

function uid() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function loadOrders(): Order[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Order[];
  } catch {/* ignore */}
  return [];
}

function saveOrders(orders: Order[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {/* ignore */}
}

// =====================================================
// Seed: a delivered Diwali Dinner from 12 days ago,
// only inserted if there are no orders yet.
// =====================================================
function seedOrder(): Order {
  const placedAt = new Date(Date.now() - 12 * 86400_000).toISOString();
  const expectedAt = new Date(new Date(placedAt).getTime() + 35 * 60_000).toISOString();
  const paradise = ALL_RESTAURANTS[0];
  const saravana = ALL_RESTAURANTS[3];
  const belgian = ALL_RESTAURANTS[5];

  const host: Member = { id: 'host', name: 'You (Aarav)', initials: 'A', color: 'bg-swiggy-orange', isHost: true, dietary: 'non-veg' };
  const m1: Member = { id: 'sf1', name: 'Priya Sharma', initials: 'P', color: 'bg-pink-500', dietary: 'veg', status: 'ready' };
  const m2: Member = { id: 'sf2', name: 'Rohan Mehta', initials: 'R', color: 'bg-blue-500', dietary: 'non-veg', status: 'ready' };
  const m3: Member = { id: 'sf3', name: 'Meera Nair', initials: 'M', color: 'bg-purple-500', dietary: 'jain', status: 'ready' };
  const members = [host, m1, m2, m3];

  const lines: CartLine[] = [
    { dish: paradise.dishes[0], qty: 1, pickedBy: host, restaurantId: paradise.id },
    { dish: paradise.dishes[2], qty: 1, pickedBy: m2, restaurantId: paradise.id },
    { dish: saravana.dishes[0], qty: 2, pickedBy: m1, restaurantId: saravana.id },
    { dish: saravana.dishes[1], qty: 1, pickedBy: m3, restaurantId: saravana.id },
    { dish: belgian.dishes[0], qty: 1, pickedBy: host, restaurantId: belgian.id },
  ];

  const food = lines.reduce((s, l) => s + l.dish.price * l.qty, 0);
  const addons = 144; // ice + sprite + raita
  const delivery = 49, platform = 6;
  const taxes = Math.round((food + addons) * 0.05);
  const grand = food + addons + delivery + platform + taxes;

  const splitN = members.length;
  const equal = Math.round(grand / splitN);

  return {
    id: uid(),
    invoiceNo: `INV-${new Date(placedAt).getFullYear()}-${uid().slice(0,6)}`,
    occasionName: 'Diwali Dinner',
    occasionEmoji: '🪔',
    partyDate: new Date(placedAt).toISOString().slice(0, 10),
    partyTime: '20:30',
    address: 'Indiranagar 100ft Rd, Bengaluru',
    hostName: host.name,
    hostInitial: host.initials,
    hostColor: host.color,
    status: 'delivered',
    members,
    lines,
    addons: [
      { id: 'a1', emoji: '🥛', name: 'Amul Boondi Raita', price: 45, unit: '200g pack', category: 'cuisine-pair', reason: '' },
      { id: 'e1', emoji: '🧊', name: 'Ice Cubes', price: 60, unit: '1 kg bag', category: 'essentials', reason: '' },
      { id: 'd2', emoji: '🍋', name: 'Sprite 1.25L', price: 75, unit: '1.25L bottle', category: 'drinks', reason: '' },
    ],
    bill: { food, addons, delivery, platform, taxes, grand },
    splitMode: 'equal',
    split: members.map((m) => ({ memberId: m.id, amount: equal, paid: true })),
    placedAt,
    expectedAt,
    rider: { name: 'Karthik R.', phone: '+91 99887 12345', vehicle: 'Honda Activa · KA-05-MX-2114' },
  };
}

// =====================================================
export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>(() => {
    const existing = loadOrders();
    if (existing.length > 0) return existing;
    const seeded = [seedOrder()];
    saveOrders(seeded);
    return seeded;
  });

  useEffect(() => { saveOrders(orders); }, [orders]);

  const getOrder = useCallback((id: string) => orders.find((o) => o.id === id), [orders]);

  const addOrder = useCallback((o: Omit<Order, 'id' | 'invoiceNo' | 'placedAt' | 'status'>): Order => {
    const placedAt = new Date().toISOString();
    const next: Order = {
      ...o,
      id: uid(),
      invoiceNo: `INV-${new Date().getFullYear()}-${uid().slice(0,6)}`,
      placedAt,
      status: 'placed',
    };
    setOrders((prev) => [next, ...prev]);
    return next;
  }, []);

  const updateStatus = useCallback((id: string, status: OrderStatus) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  }, []);

  const markPaid = useCallback((orderId: string, memberId: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, split: o.split.map((s) => s.memberId === memberId ? { ...s, paid: true } : s) }
          : o
      )
    );
  }, []);

  const value = useMemo(
    () => ({ orders, getOrder, addOrder, updateStatus, markPaid }),
    [orders, getOrder, addOrder, updateStatus, markPaid]
  );

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useOrders() {
  const v = useContext(C);
  if (!v) throw new Error('useOrders must be used inside OrdersProvider');
  return v;
}
