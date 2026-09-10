/**
 * Domain model for CaterKart for Work. This is the single source of truth —
 * the frontend consumes these shapes verbatim over /api/work/*. Field names
 * match what the React pages already read, so moving logic here is transparent.
 */

export type CompanyRole = 'admin' | 'lead' | 'member';
export type BudgetPeriod = 'weekly' | 'monthly';

export type Company = {
  id: string;
  name: string;
  logoEmoji: string;
  emailDomain: string;
  gstin: string;
  billingEmail: string;
  addressLabel: string;
  plan: 'pilot' | 'standard' | 'enterprise';
  billingLinked: boolean;
  walletBalance: number;
  // ── D7: company Swiggy service account ──
  // The single app userId whose Swiggy OAuth grant places ALL of this company's
  // orders (so employees never connect a personal Swiggy account), and the
  // office address orders are delivered to. In mock mode auth is ignored.
  swiggyServiceUserId: string;
  swiggyServiceAddressId: string;
};

// ── D6: payment port ──
// What the company INTENDS to pay with. Today everything maps to COD at the MCP
// boundary (v1 MCP is COD-only); CORP_WALLET is recorded and flips to a real
// online charge the day Swiggy exposes it — one mapping change, no flow change.
export type PaymentMethod = 'COD' | 'CORP_WALLET';

// One real Swiggy food order the team order collapsed into.
export type PlacedSubOrder = {
  restaurantId: string;
  restaurantName: string;
  swiggyOrderId: string | null;
  amount: number;
  itemCount: number;
  status: 'placed' | 'reconciled' | 'failed';
};

export type CostCenter = {
  id: string;
  name: string;
  code: string;
  emoji: string;
  leadId: string;
  budgetPeriod: BudgetPeriod;
  budgetRup: number;
  perHeadCapRup: number;
  vegOnly: boolean;
  allowAlcohol: boolean;
  requireApprovalAboveRup: number | null;
};

export type Employee = {
  id: string;
  name: string;
  initials: string;
  color: string;
  workEmail: string;
  role: CompanyRole;
  costCenterId: string;
  dietary: 'veg' | 'non-veg' | 'jain' | 'vegan';
};

// ── Ordering ────────────────────────────────────────────────────────────────
export type OrderLine = {
  employeeId: string;
  restaurantId: string;
  restaurantName: string;
  dishId: string;
  dishName: string;
  qty: number;
  price: number;
};

export type ParticipantStatus = 'invited' | 'joined' | 'picking' | 'submitted';
export type Participant = {
  employeeId: string;
  status: ParticipantStatus;
  lines: OrderLine[];
  joinedAt?: string;
  submittedAt?: string;
};

export type GroupOrderStatus = 'collecting' | 'placed' | 'cancelled';
export type GroupOrder = {
  id: string;
  token: string;
  title: string;
  costCenterId: string;
  organizerId: string;
  address: string;
  date: string;
  status: GroupOrderStatus;
  perHeadCapRup: number;
  participants: Participant[];
  createdAt: string;
  placedInvoiceId?: string;
};

export type TeamOrderStatus = 'placed' | 'preparing' | 'on-the-way' | 'delivered';
export type TeamOrder = {
  id: string;
  title: string;
  costCenterId: string;
  placedById: string;
  address: string;
  date: string;
  memberIds: string[];
  lines: OrderLine[];
  status: TeamOrderStatus;
  placedAt: string;
  invoiceId: string;
};

// ── Invoice ─────────────────────────────────────────────────────────────────
export type InvoiceStatus = 'issued' | 'claimed' | 'reconciled' | 'void';
export type InvoicePersonLine = {
  employeeId: string;
  name: string;
  items: { restaurantName: string; dishName: string; qty: number; amount: number }[];
  amount: number;
};
export type ConsolidatedInvoice = {
  id: string;
  number: string;
  teamOrderId: string;
  costCenterId: string;
  status: InvoiceStatus;
  companyName: string;
  gstin: string;
  costCenterName: string;
  costCenterCode: string;
  placedByName: string;
  headcount: number;
  periodLabel: string;
  title: string;
  address: string;
  date: string;
  restaurantCount: number;
  breakdown: InvoicePersonLine[];
  subtotal: number;
  tax: number;
  total: number;
  gstInvoiceUrl: string | null;
  billingLinked: boolean;
  issuedAt: string;
  claimedAt?: string;
  // ── D5/D6/D7: real placement record ──
  // Populated when the order was actually placed through the Swiggy MCP (via the
  // company service account). Absent on the seeded historic/demo invoices.
  placement?: {
    paymentIntended: PaymentMethod; // what the company meant to pay with
    paymentUsed: 'COD'; // what the MCP actually charged (COD in v1)
    subOrders: PlacedSubOrder[];
    anyReconciled: boolean;
    anyFailed: boolean;
  };
};

// ── Catalogue — REAL Swiggy restaurants + menus, fetched for the company's
//    service address and flattened into the shape the work picker renders. ─────
export type CatalogueDish = {
  id: string;
  name: string;
  price: number;
  veg: boolean;
  imageUrl?: string;
  bestseller?: boolean;
  inStock: boolean;
};
export type CatalogueRestaurant = {
  id: string;
  name: string;
  cuisines: string[];
  /** null when Swiggy has no rating for a new restaurant */
  rating: number | null;
  etaMin: number;
  /** real Swiggy imagery (there is no emoji in real data) */
  imageUrl?: string;
  costForTwo?: string;
  isOpen: boolean;
  dishes: CatalogueDish[];
};

// ── The whole persisted state (what a store holds) ────────────────────────────
export type CorporateState = {
  company: Company;
  costCenters: CostCenter[];
  employees: Employee[];
  orders: TeamOrder[];
  invoices: ConsolidatedInvoice[];
  groupOrders: GroupOrder[];
  invoiceSeq: number;
  currentUserId: string;
};

// ── Derived / response shapes ────────────────────────────────────────────────
export type CostCenterWithSpend = CostCenter & { spent: number; headcount: number };
export type SessionView = { currentUser: Employee; isAdmin: boolean };
export type Metrics = {
  companySpentThisMonth: number;
  companyBudgetTotal: number;
  openClaims: number;
  teamOrderCount: number;
};
export type OverviewView = SessionView & {
  company: Company;
  costCenters: CostCenterWithSpend[];
  employees: Employee[];
  orders: TeamOrder[];
  invoices: ConsolidatedInvoice[];
  groupOrders: GroupOrder[];
  metrics: Metrics;
};
