/**
 * Group-order settlement — "Splitwise for a Swiggy celebration".
 *
 * Anyone can have fronted money (COD cash to riders, the Instamart bill, etc.),
 * and the food can be split evenly or by who ordered what. We turn all of that
 * into each person's NET position (paid − owed) and then the fewest possible
 * UPI transfers that square everyone up.
 */

export type SplitMode = 'equal' | 'by-item';

export interface SettleMember {
  id: string;
  name: string;
  isHost?: boolean;
}

export interface SettleInput {
  members: SettleMember[];
  /** Sum of the food orders (incl. Swiggy delivery + taxes). */
  foodTotal: number;
  /** The single Instamart supplies order (shared). */
  instamartTotal: number;
  /** Per-member food ITEM spend (drives the "by what they ordered" split). */
  foodItemsByMember: Record<string, number>;
  mode: SplitMode;
  /** Who fronted how much money — multiple payers allowed. */
  paidByMember: Record<string, number>;
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

export interface SettleResult {
  total: number;
  /** Each person's share of the bill. */
  owed: Record<string, number>;
  /** Each person's logged payment. */
  paid: Record<string, number>;
  /** paid − owed: > 0 = they're owed money, < 0 = they owe. */
  net: Record<string, number>;
  /** The minimal set of who-pays-whom to settle everyone. */
  transfers: Transfer[];
  paidSum: number;
  /** True when logged payments add up to the bill total. */
  balanced: boolean;
}

const r = (n: number) => Math.round(n);

export function computeSettlement(input: SettleInput): SettleResult {
  const { members, foodTotal, instamartTotal, foodItemsByMember, mode, paidByMember } = input;
  const ids = members.map((m) => m.id);
  const n = Math.max(ids.length, 1);
  const total = r(foodTotal + instamartTotal);
  const hostId = members.find((m) => m.isHost)?.id ?? ids[0];

  // ── Owed (share) per person ────────────────────────────────────────────────
  const owed: Record<string, number> = {};
  if (mode === 'equal') {
    const each = Math.floor(total / n);
    ids.forEach((id) => (owed[id] = each));
  } else {
    // Food items go to whoever ordered them; food fees + Instamart are shared.
    const itemsTotal = Object.values(foodItemsByMember).reduce((s, x) => s + x, 0);
    const shared = Math.max(0, foodTotal - itemsTotal) + instamartTotal;
    const sharedEach = Math.floor(shared / n);
    ids.forEach((id) => (owed[id] = r(foodItemsByMember[id] ?? 0) + sharedEach));
  }
  // Rounding: make the shares add up to the exact total (remainder → host).
  const owedSum = ids.reduce((s, id) => s + owed[id], 0);
  if (owedSum !== total) owed[hostId] += total - owedSum;

  // ── Paid + net ─────────────────────────────────────────────────────────────
  const paid: Record<string, number> = {};
  ids.forEach((id) => (paid[id] = r(paidByMember[id] ?? 0)));
  const paidSum = ids.reduce((s, id) => s + paid[id], 0);

  const net: Record<string, number> = {};
  ids.forEach((id) => (net[id] = paid[id] - owed[id]));

  // ── Minimal transfers (greedy: biggest creditor ← biggest debtor) ───────────
  const creditors = ids
    .filter((id) => net[id] > 0)
    .map((id) => ({ id, amt: net[id] }))
    .sort((a, b) => b.amt - a.amt);
  const debtors = ids
    .filter((id) => net[id] < 0)
    .map((id) => ({ id, amt: -net[id] }))
    .sort((a, b) => b.amt - a.amt);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < creditors.length && j < debtors.length) {
    const amount = Math.min(creditors[i].amt, debtors[j].amt);
    if (amount > 0) transfers.push({ from: debtors[j].id, to: creditors[i].id, amount });
    creditors[i].amt -= amount;
    debtors[j].amt -= amount;
    if (creditors[i].amt <= 0) i++;
    if (debtors[j].amt <= 0) j++;
  }

  return { total, owed, paid, net, transfers, paidSum, balanced: paidSum === total };
}

/** Build a upi://pay deep link that pre-fills a transfer to the payee. */
export function upiLink(vpa: string, payeeName: string, amount: number, note: string): string {
  return (
    `upi://pay?pa=${encodeURIComponent(vpa.trim())}` +
    `&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`
  );
}
