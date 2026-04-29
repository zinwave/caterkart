// =====================================================
// Caterkart mock data
// =====================================================
// Pure mocks — restaurants, dishes, instamart catalogue,
// and a friends list. NOTHING is pre-added to the
// celebration: it always starts empty (host only).
// =====================================================

export type Cuisine = 'Biryani' | 'Pizza' | 'Chinese' | 'South Indian' | 'Burgers' | 'Desserts';

export type DietaryPref = 'veg' | 'non-veg' | 'jain' | 'vegan';

export type GuestStatus = 'invited' | 'joined' | 'picking' | 'ready';

// =====================================================
// People
// =====================================================
export type Member = {
  id: string;
  name: string;
  initials: string;
  color: string;
  isHost?: boolean;
  isKid?: boolean;
  dietary?: DietaryPref;
  status?: GuestStatus;
  contact?: { type: 'email' | 'phone'; value: string };
  fromFriend?: boolean;
};

export type Friend = {
  id: string;
  name: string;
  initials: string;
  color: string;
  contact: { type: 'email' | 'phone'; value: string };
  dietary: DietaryPref;
  lastSeenWith?: string;
};

// The host (you). Always present, derives from auth in real app.
export const defaultHost: Member = {
  id: 'host',
  name: 'You (Aarav)',
  initials: 'A',
  color: 'bg-swiggy-orange',
  isHost: true,
  dietary: 'non-veg',
};

export const friends: Friend[] = [
  { id: 'f1', name: 'Priya Sharma',  initials: 'P', color: 'bg-pink-500',    contact: { type: 'phone', value: '+91 98765 43210' }, dietary: 'veg', lastSeenWith: 'Last weekend' },
  { id: 'f2', name: 'Rohan Mehta',   initials: 'R', color: 'bg-blue-500',    contact: { type: 'email', value: 'rohan.m@gmail.com' }, dietary: 'non-veg', lastSeenWith: '3 group orders' },
  { id: 'f3', name: 'Sneha Iyer',    initials: 'S', color: 'bg-emerald-500', contact: { type: 'phone', value: '+91 91234 56789' }, dietary: 'veg' },
  { id: 'f4', name: 'Vikram Reddy',  initials: 'V', color: 'bg-amber-500',   contact: { type: 'email', value: 'vikram@hey.com' }, dietary: 'non-veg', lastSeenWith: '2 birthdays this year' },
  { id: 'f5', name: 'Meera Nair',    initials: 'M', color: 'bg-purple-500',  contact: { type: 'phone', value: '+91 99887 76655' }, dietary: 'jain' },
  { id: 'f6', name: 'Arjun Kapoor',  initials: 'A', color: 'bg-cyan-500',    contact: { type: 'email', value: 'arjun.k@me.com' }, dietary: 'non-veg' },
  { id: 'f7', name: 'Kavya Desai',   initials: 'K', color: 'bg-rose-500',    contact: { type: 'phone', value: '+91 90011 22334' }, dietary: 'vegan' },
  { id: 'f8', name: 'Rahul Verma',   initials: 'R', color: 'bg-indigo-500',  contact: { type: 'email', value: 'rahul.v@outlook.com' }, dietary: 'veg' },
];

// random colour pool for ad-hoc invitees (email/phone)
export const guestColors = [
  'bg-pink-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-purple-500', 'bg-cyan-500', 'bg-rose-500', 'bg-indigo-500',
  'bg-teal-500', 'bg-fuchsia-500',
];

// =====================================================
// Occasions
// =====================================================
export type Occasion = {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
};

export const occasions: Occasion[] = [
  { id: 'game-night',   name: 'Game Night',     emoji: '🎮', blurb: 'Snacks, sodas, screens' },
  { id: 'birthday',     name: 'Birthday',       emoji: '🎂', blurb: 'Cake, candles, crowd' },
  { id: 'diwali',       name: 'Diwali Dinner',  emoji: '🪔', blurb: 'Sweets, savouries, family' },
  { id: 'housewarming', name: 'House Warming',  emoji: '🏡', blurb: 'First meal, new place' },
  { id: 'casual',       name: 'Casual Dinner',  emoji: '🍽️', blurb: 'Just hungry friends' },
  { id: 'cricket',      name: 'Match Night',    emoji: '🏏', blurb: 'Wings, cold ones, tension' },
];

// =====================================================
// Restaurants & dishes
// =====================================================
export type Dish = {
  id: string;
  name: string;
  price: number;
  veg: boolean;
  imageEmoji: string;
  bestseller?: boolean;
  description?: string;
};

export type Restaurant = {
  id: string;
  name: string;
  cuisines: Cuisine[];
  rating: number;
  etaMin: number;
  imageEmoji: string;
  promo?: string;
  dishes: Dish[];
};

export const restaurants: Restaurant[] = [
  {
    id: 'paradise', name: 'Paradise Biryani', cuisines: ['Biryani'],
    rating: 4.4, etaMin: 32, imageEmoji: '🍛', promo: 'ITEMS AT ₹199',
    dishes: [
      { id: 'p1', name: 'Hyderabadi Chicken Biryani', price: 349, veg: false, imageEmoji: '🍛', bestseller: true, description: 'Long-grain basmati, slow-dum cooked' },
      { id: 'p2', name: 'Paneer Biryani', price: 299, veg: true, imageEmoji: '🥘', description: 'Rich, mildly spiced' },
      { id: 'p3', name: 'Mutton Biryani', price: 449, veg: false, imageEmoji: '🍖', bestseller: true },
      { id: 'p4', name: 'Double Ka Meetha', price: 149, veg: true, imageEmoji: '🍮' },
    ],
  },
  {
    id: 'pizzahut', name: 'Pizza Hut', cuisines: ['Pizza'],
    rating: 4.2, etaMin: 28, imageEmoji: '🍕', promo: 'BUY 1 GET 1',
    dishes: [
      { id: 'pz1', name: 'Margherita Pan Pizza', price: 279, veg: true, imageEmoji: '🍕', bestseller: true },
      { id: 'pz2', name: 'Chicken Tikka Pizza', price: 449, veg: false, imageEmoji: '🍕' },
      { id: 'pz3', name: 'Garlic Bread Sticks', price: 169, veg: true, imageEmoji: '🥖' },
      { id: 'pz4', name: 'Choco Lava Cake', price: 119, veg: true, imageEmoji: '🧁' },
    ],
  },
  {
    id: 'mainland', name: 'Mainland China', cuisines: ['Chinese'],
    rating: 4.3, etaMin: 35, imageEmoji: '🥢',
    dishes: [
      { id: 'mc1', name: 'Veg Hakka Noodles', price: 269, veg: true, imageEmoji: '🍜', bestseller: true },
      { id: 'mc2', name: 'Chilli Chicken (Dry)', price: 329, veg: false, imageEmoji: '🍗' },
      { id: 'mc3', name: 'Schezwan Fried Rice', price: 249, veg: true, imageEmoji: '🍚' },
      { id: 'mc4', name: 'Honey Chilli Potato', price: 219, veg: true, imageEmoji: '🥔' },
    ],
  },
  {
    id: 'saravana', name: 'Saravana Bhavan', cuisines: ['South Indian'],
    rating: 4.5, etaMin: 25, imageEmoji: '🥞',
    dishes: [
      { id: 'sb1', name: 'Masala Dosa', price: 159, veg: true, imageEmoji: '🥞', bestseller: true },
      { id: 'sb2', name: 'Idli Vada Combo', price: 129, veg: true, imageEmoji: '🍘' },
      { id: 'sb3', name: 'Filter Coffee', price: 49, veg: true, imageEmoji: '☕' },
    ],
  },
  {
    id: 'bk', name: 'Burger King', cuisines: ['Burgers'],
    rating: 4.1, etaMin: 22, imageEmoji: '🍔', promo: 'STUDENT MEAL ₹99',
    dishes: [
      { id: 'bk1', name: 'Whopper', price: 219, veg: false, imageEmoji: '🍔', bestseller: true },
      { id: 'bk2', name: 'Veg Whopper', price: 179, veg: true, imageEmoji: '🍔' },
      { id: 'bk3', name: 'Cheesy Fries', price: 119, veg: true, imageEmoji: '🍟' },
    ],
  },
  {
    id: 'belgian', name: 'Belgian Waffle Co.', cuisines: ['Desserts'],
    rating: 4.6, etaMin: 24, imageEmoji: '🧇',
    dishes: [
      { id: 'bw1', name: 'Death by Chocolate Waffle', price: 199, veg: true, imageEmoji: '🧇', bestseller: true },
      { id: 'bw2', name: 'Red Velvet Waffle', price: 219, veg: true, imageEmoji: '🧇' },
    ],
  },
];

// =====================================================
// Instamart add-ons
// =====================================================
export type AddonCategory = 'cuisine-pair' | 'essentials' | 'drinks' | 'after-meal' | 'pantry' | 'kids';

export type AddonItem = {
  id: string;
  name: string;
  price: number;
  unit: string;
  emoji: string;
  category: AddonCategory;
  reason: string;
  pairsWithCuisine?: Cuisine[];
  scalesWithGroup?: boolean;
  forKids?: boolean;
  containsAlcohol?: boolean;
};

export const addonCatalog: AddonItem[] = [
  // Cuisine pairs
  { id: 'a1', emoji: '🥛', name: 'Amul Boondi Raita', price: 45, unit: '200g pack', category: 'cuisine-pair', reason: 'Pairs with biryani', pairsWithCuisine: ['Biryani'] },
  { id: 'a2', emoji: '🫓', name: 'Lijjat Papad', price: 38, unit: 'Pack of 12', category: 'cuisine-pair', reason: 'Goes with biryani', pairsWithCuisine: ['Biryani', 'South Indian'] },
  { id: 'a3', emoji: '🥒', name: "Mother's Mango Pickle", price: 89, unit: '200g jar', category: 'cuisine-pair', reason: 'Classic with biryani & dosa', pairsWithCuisine: ['Biryani', 'South Indian'] },
  { id: 'a4', emoji: '🧄', name: 'Garlic Mayo Dip', price: 65, unit: '90g tub', category: 'cuisine-pair', reason: 'Goes with pizza & fries', pairsWithCuisine: ['Pizza', 'Burgers'] },
  { id: 'a5', emoji: '🌶️', name: 'Schezwan Chutney', price: 79, unit: '180g jar', category: 'cuisine-pair', reason: 'Boosts Chinese flavours', pairsWithCuisine: ['Chinese'] },
  { id: 'a6', emoji: '🥥', name: 'Coconut Chutney', price: 49, unit: '150g pack', category: 'cuisine-pair', reason: 'For your dosa', pairsWithCuisine: ['South Indian'] },

  // Essentials
  { id: 'e1', emoji: '🧊', name: 'Ice Cubes', price: 60, unit: '1 kg bag', category: 'essentials', reason: 'Always forgotten, always needed', scalesWithGroup: true },
  { id: 'e2', emoji: '🍽️', name: 'Disposable Plates', price: 99, unit: 'Pack of 25', category: 'essentials', reason: 'Less washing up', scalesWithGroup: true },
  { id: 'e3', emoji: '🧻', name: 'Premier Tissues', price: 55, unit: '2 boxes', category: 'essentials', reason: 'Group dinners get messy' },
  { id: 'e4', emoji: '🗑️', name: 'Garbage Bags', price: 79, unit: 'Pack of 30', category: 'essentials', reason: 'Easy clean-up after' },
  { id: 'e5', emoji: '🥄', name: 'Plastic Spoons & Forks', price: 49, unit: 'Pack of 50', category: 'essentials', reason: 'For Chinese & biryani' },

  // Drinks
  { id: 'd1', emoji: '🥤', name: 'Coca-Cola 2L', price: 95, unit: '2L bottle', category: 'drinks', reason: '~1L per 3 people', scalesWithGroup: true },
  { id: 'd2', emoji: '🍋', name: 'Sprite 1.25L', price: 75, unit: '1.25L bottle', category: 'drinks', reason: 'Pairs with Chinese & spicy food' },
  { id: 'd3', emoji: '🧃', name: 'Real Mixed Fruit Juice', price: 110, unit: '1L pack', category: 'drinks', reason: 'For non-fizzy drinkers' },
  { id: 'd4', emoji: '🍺', name: 'Kingfisher Ultra (6 cans)', price: 720, unit: '6 x 330ml', category: 'drinks', reason: 'Match-night essentials', containsAlcohol: true },
  { id: 'd5', emoji: '💧', name: 'Bisleri 1L (4 pack)', price: 80, unit: '4 x 1L', category: 'drinks', reason: 'Always run out at group dinners' },

  // After-meal
  { id: 'm1', emoji: '🍦', name: 'Amul Vanilla Tub', price: 199, unit: '750ml', category: 'after-meal', reason: 'Dessert for everyone' },
  { id: 'm2', emoji: '🍫', name: 'Dairy Milk Silk', price: 150, unit: '150g bar', category: 'after-meal', reason: 'For the sweet tooth' },
  { id: 'm3', emoji: '🌿', name: 'Pass Pass Mints', price: 30, unit: 'Pack of 4', category: 'after-meal', reason: 'After spicy biryani' },
  { id: 'm4', emoji: '💊', name: 'Eno Antacid', price: 65, unit: 'Pack of 6', category: 'after-meal', reason: 'For the morning after' },

  // Kids-only suggestions (auto-shown when there are kids in the group)
  { id: 'k1', emoji: '🍫', name: 'KitKat Mini Bag', price: 99, unit: '15 pieces', category: 'kids', reason: 'For the kids', forKids: true },
  { id: 'k2', emoji: '🥤', name: 'Frooti Mango (6 pack)', price: 60, unit: '6 x 160ml', category: 'kids', reason: 'Kid-friendly, no fizz', forKids: true },
  { id: 'k3', emoji: '🍪', name: 'Hide & Seek Cookies', price: 50, unit: '200g pack', category: 'kids', reason: 'Snack that always works', forKids: true },

  // Pantry-aware (host history)
  { id: 'p_h1', emoji: '🥛', name: 'Amul Gold Milk 1L', price: 68, unit: '1L pack', category: 'pantry', reason: 'You usually reorder every 4 days. Last order: 5 days ago.' },
  { id: 'p_h2', emoji: '🥚', name: 'Farm Fresh Eggs (12)', price: 95, unit: 'Tray of 12', category: 'pantry', reason: 'Running low based on past orders.' },
  { id: 'p_h3', emoji: '🌿', name: 'Coriander Bunch', price: 20, unit: '1 bunch', category: 'pantry', reason: 'Used in 80% of your biryani prep.' },
];

// =====================================================
// Smart suggestion logic
// =====================================================
export function suggestAddons(opts: {
  cuisines: Set<Cuisine>;
  groupSize: number;
  vegCount: number;
  nonVegCount: number;
  kidCount: number;
}): AddonItem[] {
  const { cuisines, groupSize, kidCount } = opts;
  const out: AddonItem[] = [];

  // Cuisine-paired (top 2)
  const paired = addonCatalog.filter(
    (a) => a.category === 'cuisine-pair' &&
      a.pairsWithCuisine?.some((c) => cuisines.has(c))
  );
  out.push(...paired.slice(0, 2));

  // Essentials scaled to group
  out.push(addonCatalog.find((a) => a.id === 'e1')!); // ice
  if (groupSize >= 4) out.push(addonCatalog.find((a) => a.id === 'e2')!); // plates

  // Drinks (kid-aware: skip beer if kids are present)
  if (cuisines.has('Chinese') || cuisines.has('Burgers')) {
    out.push(addonCatalog.find((a) => a.id === 'd2')!);
  }
  out.push(addonCatalog.find((a) => a.id === 'd1')!);
  if (kidCount > 0) {
    // suggest kid-friendly items
    addonCatalog.filter((a) => a.category === 'kids').forEach((a) => out.push(a));
  }

  // After-meal
  if (cuisines.has('Biryani')) out.push(addonCatalog.find((a) => a.id === 'm3')!);
  out.push(addonCatalog.find((a) => a.id === 'm1')!);

  // Pantry-aware
  out.push(addonCatalog.find((a) => a.id === 'p_h1')!);
  out.push(addonCatalog.find((a) => a.id === 'p_h3')!);

  // de-dupe
  const seen = new Set<string>();
  return out.filter((a) => a && !seen.has(a.id) && seen.add(a.id)).slice(0, 12);
}
