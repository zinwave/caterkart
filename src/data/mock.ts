// =====================================================
// CaterKart's OWN domain — people and occasions.
// =====================================================
// NOTE: there is no seeded host and no seeded friends list any more.
//  • the host comes from the real phone+OTP session (PersonalAuthContext)
//  • "friends" are the people you have ACTUALLY invited before, served by
//    GET /api/celebrations/contacts — a brand-new host sees an empty state.
// Restaurants, dishes and the Instamart catalogue are real Swiggy data.
// Restaurants, dishes and the Instamart catalogue used to live here as mocks.
// They are gone: all of that is now REAL Swiggy data, fetched through the
// backend (see src/lib/api.ts + src/hooks/useSwiggyData.ts, typed in
// src/lib/mcp/types.ts). Cuisines are free-form Swiggy strings now, not a
// fixed union.
//
// What remains is genuinely ours and has no Swiggy equivalent: the host, the
// guest list, dietary preferences and the occasion catalogue. A celebration
// still starts empty (host only).
// =====================================================

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
  /** Icon key resolved by `components/OccasionIcon` (no emojis). */
  icon: string;
  blurb: string;
  /**
   * Curated Instamart search terms to pre-load as "essentials" for this
   * occasion. Each term is run through live Instamart search (real prices,
   * real stock) and the results are merged on the add-ons page. Omit to fall
   * back to the guest's usual reorders.
   */
  essentials?: string[];
};

// Ordered most-common first — the top of the list is what most hosts pick.
export const occasions: Occasion[] = [
  {
    id: 'house-party', name: 'House Party', icon: 'sparkles',
    blurb: 'Snacks, drinks, ice, plates',
    essentials: [
      'potato chips', 'soft drinks', 'beer', 'ice cubes',
      'paper plates', 'tissue paper', 'peanuts', 'chocolate',
    ],
  },
  {
    id: 'birthday', name: 'Birthday', icon: 'cake',
    blurb: 'Cake, candles, crowd',
    essentials: ['birthday candles', 'chocolate cake', 'soft drinks', 'paper plates', 'balloons'],
  },
  {
    id: 'get-together', name: 'Get-together', icon: 'users',
    blurb: 'Friends, food, chill',
    essentials: ['potato chips', 'soft drinks', 'cookies', 'namkeen', 'ice cubes', 'chocolate'],
  },
  {
    id: 'game-night', name: 'Game Night', icon: 'gamepad',
    blurb: 'Snacks, sodas, screens',
    essentials: ['nachos', 'soft drinks', 'popcorn', 'potato chips', 'chocolate', 'ice cubes'],
  },
  {
    id: 'movie-night', name: 'Movie Night', icon: 'film',
    blurb: 'Popcorn and a screen',
    essentials: ['popcorn', 'nachos', 'soft drinks', 'potato chips', 'chocolate', 'ice cream'],
  },
  {
    id: 'match-night', name: 'Match Night', icon: 'trophy',
    blurb: 'Wings, cold ones, tension',
    essentials: ['chicken wings', 'beer', 'potato chips', 'soft drinks', 'peanuts', 'ice cubes'],
  },
  {
    id: 'trip', name: 'Trip', icon: 'plane',
    blurb: 'Snacks & water for the road',
    essentials: ['packaged water', 'potato chips', 'biscuits', 'soft drinks', 'chocolate', 'wet wipes'],
  },
  {
    id: 'diwali', name: 'Diwali', icon: 'lantern',
    blurb: 'Sweets, savouries, family',
    essentials: ['soan papdi', 'dry fruits', 'namkeen', 'diya', 'soft drinks', 'chocolate'],
  },
  {
    id: 'housewarming', name: 'House Warming', icon: 'home',
    blurb: 'First meal, new place',
    essentials: ['paper plates', 'soft drinks', 'tissue paper', 'namkeen', 'ice cubes', 'chocolate'],
  },
  {
    id: 'anniversary', name: 'Anniversary', icon: 'heart',
    blurb: 'Cake, flowers, dessert',
    essentials: ['chocolate', 'cake', 'soft drinks', 'ice cream', 'chips'],
  },
  {
    id: 'casual', name: 'Casual Dinner', icon: 'utensils',
    blurb: 'Just hungry friends',
    essentials: ['soft drinks', 'potato chips', 'ice cream', 'cookies', 'ice cubes'],
  },
  {
    id: 'other', name: 'Other', icon: 'star',
    blurb: 'Something else',
    essentials: ['potato chips', 'soft drinks', 'ice cubes', 'paper plates', 'cookies', 'chocolate'],
  },
];

// =====================================================
// Restaurants & dishes
// =====================================================
