// Frontend mirror of the backend CaterKart-for-Work domain (server/src/corporate).
// Types only — all logic lives in the backend now.

export type CompanyRole = 'admin' | 'lead' | 'member';
export type BudgetPeriod = 'weekly' | 'monthly';
export type DietaryPref = 'veg' | 'non-veg' | 'jain' | 'vegan';

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
  swiggyServiceUserId?: string;
  swiggyServiceAddressId?: string;
};

export type PaymentMethod = 'COD' | 'CORP_WALLET';

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
export type CostCenterWithSpend = CostCenter & { spent: number; headcount: number };

export type Employee = {
  id: string;
  name: string;
  initials: string;
  color: string;
  workEmail: string;
  role: CompanyRole;
  costCenterId: string;
  dietary: DietaryPref;
};

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
  placement?: {
    paymentIntended: PaymentMethod;
    paymentUsed: 'COD';
    subOrders: PlacedSubOrder[];
    anyReconciled: boolean;
    anyFailed: boolean;
  };
};

// REAL Swiggy restaurants + menus for the company's service address (the backend
// builds these in CorporateService.getCatalogue). No emoji — real imagery.
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
  /** null for a brand-new restaurant Swiggy has not rated */
  rating: number | null;
  etaMin: number;
  imageUrl?: string;
  costForTwo?: string;
  isOpen: boolean;
  dishes: CatalogueDish[];
};

export type Metrics = {
  companySpentThisMonth: number;
  companyBudgetTotal: number;
  openClaims: number;
  teamOrderCount: number;
};
export type SessionView = { currentUser: Employee; isAdmin: boolean };
export type OverviewView = SessionView & {
  company: Company;
  costCenters: CostCenterWithSpend[];
  employees: Employee[];
  orders: TeamOrder[];
  invoices: ConsolidatedInvoice[];
  groupOrders: GroupOrder[];
  metrics: Metrics;
};
