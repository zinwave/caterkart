/**
 * Seed data for CaterKart for Work (mock mode). Mirrors what the frontend used
 * to hold in localStorage — same company, teams, roster, catalogue and two
 * historic orders + one live group order — so the migration is invisible to the UI.
 */
import type {
  CatalogueRestaurant,
  Company,
  ConsolidatedInvoice,
  CostCenter,
  Employee,
  GroupOrder,
  InvoicePersonLine,
  OrderLine,
  TeamOrder,
} from './corporate.types';

export const COMPANY: Company = {
  id: 'co_aurelia',
  name: 'Aurelia Labs',
  logoEmoji: '🛰️',
  emailDomain: 'aurelialabs.com',
  gstin: '29ABCDE1234F1Z5',
  billingEmail: 'finance@aurelialabs.com',
  addressLabel: 'Prestige Tech Park, Marathahalli, Bengaluru',
  plan: 'pilot',
  billingLinked: false,
  walletBalance: 0,
  // Company Swiggy service account (mock: any id; live: a CompanyMember with a
  // connected SwiggyAuth). All corporate orders place through this identity.
  // The corporate service account must be a REAL Swiggy grant: orders are placed
  // through it. Point these at an account that has completed the OAuth flow.
  swiggyServiceUserId: process.env.SWIGGY_SERVICE_USER_ID ?? 'dev-user',
  swiggyServiceAddressId: process.env.SWIGGY_SERVICE_ADDRESS_ID ?? '',
};

export const COST_CENTERS: CostCenter[] = [
  { id: 'cc_eng', name: 'Engineering', code: 'ENG-01', emoji: '⚙️', leadId: 'e_arjun', budgetPeriod: 'monthly', budgetRup: 60000, perHeadCapRup: 350, vegOnly: false, allowAlcohol: false, requireApprovalAboveRup: 15000 },
  { id: 'cc_sales', name: 'Sales — West', code: 'SAL-02', emoji: '📈', leadId: 'e_neha', budgetPeriod: 'monthly', budgetRup: 45000, perHeadCapRup: 500, vegOnly: false, allowAlcohol: true, requireApprovalAboveRup: 20000 },
  { id: 'cc_design', name: 'Design', code: 'DSN-03', emoji: '🎨', leadId: 'e_kabir', budgetPeriod: 'monthly', budgetRup: 25000, perHeadCapRup: 300, vegOnly: false, allowAlcohol: false, requireApprovalAboveRup: null },
  { id: 'cc_people', name: 'People & Ops', code: 'HRA-04', emoji: '🌱', leadId: 'e_admin', budgetPeriod: 'monthly', budgetRup: 20000, perHeadCapRup: 300, vegOnly: true, allowAlcohol: false, requireApprovalAboveRup: null },
];

export const EMPLOYEES: Employee[] = [
  { id: 'e_admin', name: 'Divya Menon', initials: 'DM', color: 'bg-swiggy-orange', workEmail: 'divya@aurelialabs.com', role: 'admin', costCenterId: 'cc_people', dietary: 'veg' },
  { id: 'e_arjun', name: 'Arjun Rao', initials: 'AR', color: 'bg-blue-500', workEmail: 'arjun@aurelialabs.com', role: 'lead', costCenterId: 'cc_eng', dietary: 'non-veg' },
  { id: 'e_sara', name: 'Sara Thomas', initials: 'ST', color: 'bg-emerald-500', workEmail: 'sara@aurelialabs.com', role: 'member', costCenterId: 'cc_eng', dietary: 'veg' },
  { id: 'e_imran', name: 'Imran Sheikh', initials: 'IS', color: 'bg-indigo-500', workEmail: 'imran@aurelialabs.com', role: 'member', costCenterId: 'cc_eng', dietary: 'non-veg' },
  { id: 'e_lin', name: 'Lin Zhao', initials: 'LZ', color: 'bg-cyan-500', workEmail: 'lin@aurelialabs.com', role: 'member', costCenterId: 'cc_eng', dietary: 'vegan' },
  { id: 'e_dev', name: 'Dev Patel', initials: 'DP', color: 'bg-teal-500', workEmail: 'dev@aurelialabs.com', role: 'member', costCenterId: 'cc_eng', dietary: 'jain' },
  { id: 'e_neha', name: 'Neha Gupta', initials: 'NG', color: 'bg-pink-500', workEmail: 'neha@aurelialabs.com', role: 'lead', costCenterId: 'cc_sales', dietary: 'non-veg' },
  { id: 'e_rohit', name: 'Rohit Anand', initials: 'RA', color: 'bg-amber-500', workEmail: 'rohit@aurelialabs.com', role: 'member', costCenterId: 'cc_sales', dietary: 'non-veg' },
  { id: 'e_fatima', name: 'Fatima Ali', initials: 'FA', color: 'bg-rose-500', workEmail: 'fatima@aurelialabs.com', role: 'member', costCenterId: 'cc_sales', dietary: 'veg' },
  { id: 'e_kabir', name: 'Kabir Nair', initials: 'KN', color: 'bg-purple-500', workEmail: 'kabir@aurelialabs.com', role: 'lead', costCenterId: 'cc_design', dietary: 'veg' },
  { id: 'e_maya', name: 'Maya Iyer', initials: 'MI', color: 'bg-fuchsia-500', workEmail: 'maya@aurelialabs.com', role: 'member', costCenterId: 'cc_design', dietary: 'veg' },
];

export const CURRENT_ADMIN_ID = 'e_admin';

// The work picker's catalogue is REAL Swiggy data now, fetched per company
// service address in CorporateService.getCatalogue(). The old hardcoded
// restaurant/dish list (Paradise Biryani, Pizza Hut, …) has been deleted.

// ── Invoice math (one place, reused by seed + live placements) ────────────────
const DELIVERY_PER_RESTAURANT = 35;
const PLATFORM_FEE = 6;
const GST_RATE = 0.05;

export function buildInvoiceFromOrder(
  order: Omit<TeamOrder, 'invoiceId'>,
  ctx: { company: Company; costCenter: CostCenter; employeeName: (id: string) => string },
  seq: number,
): ConsolidatedInvoice {
  const { company, costCenter, employeeName } = ctx;
  const restaurantCount = new Set(order.lines.map((l) => l.restaurantId)).size;

  const breakdown: InvoicePersonLine[] = order.memberIds.map((mid) => {
    const items = order.lines
      .filter((l) => l.employeeId === mid)
      .map((l) => ({ restaurantName: l.restaurantName, dishName: l.dishName, qty: l.qty, amount: l.price * l.qty }));
    return { employeeId: mid, name: employeeName(mid), items, amount: items.reduce((s, i) => s + i.amount, 0) };
  });

  const food = breakdown.reduce((s, p) => s + p.amount, 0);
  const delivery = restaurantCount * DELIVERY_PER_RESTAURANT;
  const subtotal = food + delivery + PLATFORM_FEE;
  const tax = Math.round(food * GST_RATE);
  const total = subtotal + tax;

  const d = new Date(order.date);
  const periodLabel = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const fyStart = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  const number = `CK/${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}/${String(seq).padStart(6, '0')}`;

  return {
    id: 'inv_' + Math.random().toString(36).slice(2, 10),
    number,
    teamOrderId: order.id,
    costCenterId: order.costCenterId,
    status: 'issued',
    companyName: company.name,
    gstin: company.gstin,
    costCenterName: costCenter.name,
    costCenterCode: costCenter.code,
    placedByName: employeeName(order.placedById),
    headcount: order.memberIds.length,
    periodLabel,
    title: order.title,
    address: order.address,
    date: order.date,
    restaurantCount,
    breakdown,
    subtotal,
    tax,
    total,
    gstInvoiceUrl: company.billingLinked ? 'https://swiggy.com/corp/invoice/' + number : null,
    billingLinked: company.billingLinked,
    issuedAt: order.placedAt,
  };
}

// ── Seeded state factory ─────────────────────────────────────────────────────
let uidSeq = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(uidSeq++).toString(36)}`;
const token = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const nameOf = (id: string) => EMPLOYEES.find((e) => e.id === id)?.name ?? 'Unknown';

/**
 * Historical invoice lines are SNAPSHOTS, not live catalogue lookups — a past
 * invoice must keep the name and price it was billed at, even if the restaurant
 * changes its menu or leaves Swiggy. These seeds give the work console a spend
 * history to render; new orders are built from the real Swiggy catalogue.
 */
const SEED_ITEMS: Record<string, { restaurantName: string; dishName: string; price: number }> = {
  'paradise:p1': { restaurantName: 'Paradise Biryani', dishName: 'Hyderabadi Chicken Biryani', price: 349 },
  'paradise:p3': { restaurantName: 'Paradise Biryani', dishName: 'Mutton Biryani', price: 449 },
  'saravana:sb1': { restaurantName: 'Saravana Bhavan', dishName: 'Mini Tiffin', price: 199 },
  'saravana:sb2': { restaurantName: 'Saravana Bhavan', dishName: 'Ghee Podi Dosa', price: 179 },
  'belgian:bw1': { restaurantName: 'Belgian Waffle Co.', dishName: 'Death by Chocolate Waffle', price: 229 },
};

function line(employeeId: string, restaurantId: string, dishId: string): OrderLine {
  const snap = SEED_ITEMS[`${restaurantId}:${dishId}`];
  return {
    employeeId,
    restaurantId,
    restaurantName: snap.restaurantName,
    dishId,
    dishName: snap.dishName,
    qty: 1,
    price: snap.price,
  };
}

export function seedState() {
  const company = { ...COMPANY };
  const costCenters = COST_CENTERS.map((c) => ({ ...c }));
  const orders: TeamOrder[] = [];
  const invoices: ConsolidatedInvoice[] = [];
  const groupOrders: GroupOrder[] = [];
  let seq = 140;
  const ctx = (cc: CostCenter) => ({ company, costCenter: cc, employeeName: nameOf });

  // Order 1 — Engineering sprint lunch, delivered + claimed
  {
    const placedAt = new Date(Date.now() - 9 * 86400_000).toISOString();
    const date = placedAt.slice(0, 10);
    const memberIds = ['e_arjun', 'e_sara', 'e_imran', 'e_lin', 'e_dev'];
    const lines = [
      line('e_arjun', 'paradise', 'p1'), line('e_imran', 'paradise', 'p3'),
      line('e_sara', 'saravana', 'sb1'), line('e_lin', 'saravana', 'sb2'), line('e_dev', 'saravana', 'sb2'),
      line('e_arjun', 'belgian', 'bw1'),
    ];
    const base: Omit<TeamOrder, 'invoiceId'> = { id: uid('to_'), title: 'Sprint retro lunch', costCenterId: 'cc_eng', placedById: 'e_arjun', address: company.addressLabel, date, memberIds, lines, status: 'delivered', placedAt };
    const inv = buildInvoiceFromOrder(base, ctx(costCenters[0]), seq++);
    inv.status = 'claimed';
    inv.claimedAt = new Date(Date.now() - 8 * 86400_000).toISOString();
    orders.push({ ...base, invoiceId: inv.id });
    invoices.push(inv);
  }
  // Order 2 — Sales client-win lunch, delivered + issued
  {
    const placedAt = new Date(Date.now() - 3 * 86400_000).toISOString();
    const date = placedAt.slice(0, 10);
    const memberIds = ['e_neha', 'e_rohit', 'e_fatima'];
    const lines = [line('e_neha', 'paradise', 'p3'), line('e_rohit', 'paradise', 'p1'), line('e_fatima', 'saravana', 'sb1')];
    const base: Omit<TeamOrder, 'invoiceId'> = { id: uid('to_'), title: 'Q2 client-win lunch', costCenterId: 'cc_sales', placedById: 'e_neha', address: company.addressLabel, date, memberIds, lines, status: 'delivered', placedAt };
    const inv = buildInvoiceFromOrder(base, ctx(costCenters[1]), seq++);
    orders.push({ ...base, invoiceId: inv.id });
    invoices.push(inv);
  }
  // NOTE: no seeded *live* group order. It would reference restaurant ids that
  // do not exist on Swiggy, so placing it would fail. Create one from the real
  // catalogue instead (/work/order).

  return {
    company,
    costCenters,
    employees: EMPLOYEES.map((e) => ({ ...e })),
    orders,
    invoices,
    groupOrders,
    invoiceSeq: seq,
    currentUserId: CURRENT_ADMIN_ID,
  };
}
