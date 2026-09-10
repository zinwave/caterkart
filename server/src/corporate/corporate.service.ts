import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CorporateStore } from './corporate.store';
import { buildInvoiceFromOrder } from './corporate.data';
import { FoodService } from '../swiggy/food.service';
import type {
  CatalogueRestaurant,
  Company,
  ConsolidatedInvoice,
  CostCenter,
  CostCenterWithSpend,
  Employee,
  GroupOrder,
  InvoiceStatus,
  Metrics,
  OrderLine,
  OverviewView,
  Participant,
  ParticipantStatus,
  PaymentMethod,
  PlacedSubOrder,
  SessionView,
  TeamOrder,
} from './corporate.types';

const sameMonth = (iso: string, monthISO: string) => iso.slice(0, 7) === monthISO.slice(0, 7);
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const token = () => Math.random().toString(36).slice(2, 8).toUpperCase();

type SubCart = { restaurantId: string; lines: OrderLine[]; total: number };

/** Re-aggregate unit lines back to {dishId, qty}. */
function mergeLines(units: OrderLine[]): OrderLine[] {
  const m = new Map<string, OrderLine>();
  for (const u of units) {
    const ex = m.get(u.dishId);
    if (ex) ex.qty += 1;
    else m.set(u.dishId, { ...u, qty: 1 });
  }
  return [...m.values()];
}

/**
 * Group lines by restaurant (single-restaurant carts), then split each
 * restaurant's items into sub-carts that each stay strictly under the ₹1000
 * food-order cap. Each sub-cart becomes one real Swiggy order.
 */
function splitIntoSubOrders(lines: OrderLine[], cap: number): SubCart[] {
  const byRestaurant = new Map<string, OrderLine[]>();
  for (const l of lines) {
    const arr = byRestaurant.get(l.restaurantId) ?? [];
    arr.push(l);
    byRestaurant.set(l.restaurantId, arr);
  }
  const subs: SubCart[] = [];
  for (const [restaurantId, rlines] of byRestaurant) {
    let cur: OrderLine[] = [];
    let curTotal = 0;
    for (const l of rlines) {
      for (let i = 0; i < l.qty; i++) {
        if (cur.length && curTotal + l.price >= cap) {
          subs.push({ restaurantId, lines: mergeLines(cur), total: curTotal });
          cur = [];
          curTotal = 0;
        }
        cur.push({ ...l, qty: 1 });
        curTotal += l.price;
      }
    }
    if (cur.length) subs.push({ restaurantId, lines: mergeLines(cur), total: curTotal });
  }
  return subs;
}

/**
 * All CaterKart-for-Work business logic. Ported verbatim from the old frontend
 * CorporateContext so behaviour is identical — budget/spend math, per-head cap
 * and policy gates, the group-order lifecycle, and consolidated invoicing.
 */
/** How many restaurants the work picker shows, and how deep each menu goes. */
const CATALOGUE_SIZE = 8;
const DISHES_PER_RESTAURANT = 12;
const CATALOGUE_TTL_MS = 5 * 60_000;

@Injectable()
export class CorporateService {
  private catalogueCache?: { at: number; value: CatalogueRestaurant[] };

  private readonly log = new Logger(CorporateService.name);
  private readonly foodCapRupees: number;

  constructor(
    private readonly store: CorporateStore,
    private readonly food: FoodService,
    config: ConfigService,
  ) {
    this.foodCapRupees = config.get<number>('orchestration.foodOrderCapRupees', 1000);
  }

  // ── D6: payment port ──
  // What the company means to pay with (records CORP_WALLET intent once billing
  // is linked) vs. what the MCP actually charges (COD in v1).
  private resolvePayment(company: Company): { intended: PaymentMethod; used: 'COD' } {
    return { intended: company.billingLinked ? 'CORP_WALLET' : 'COD', used: 'COD' };
  }

  // ── Catalogue ─────────────────────────────────────────────────────────────
  /**
   * The work picker's catalogue, built from REAL Swiggy data for the company's
   * service address: search once, then pull a menu per restaurant (Swiggy has no
   * bulk-menu call) and flatten to restaurant→dishes.
   *
   * Cached briefly — this is N+1 network calls, and every employee hitting the
   * picker would otherwise re-run it.
   */
  async getCatalogue(): Promise<CatalogueRestaurant[]> {
    const now = Date.now();
    if (this.catalogueCache && now - this.catalogueCache.at < CATALOGUE_TTL_MS) {
      return this.catalogueCache.value;
    }

    const company = this.store.state.company;
    const userId = company.swiggyServiceUserId;
    const addressId = company.swiggyServiceAddressId;

    if (!addressId) {
      throw new BadRequestException(
        'No Swiggy service address configured. Set SWIGGY_SERVICE_ADDRESS_ID to one of the ' +
          'service account’s saved Swiggy addresses (GET /api/swiggy/addresses).',
      );
    }

    // Empty query = browse (fans out over cuisines). Never pass a word like
    // "popular" — Swiggy text-matches it and returns cinema snack counters.
    const restaurants = await this.food.getServiceableRestaurants(userId, addressId, '');
    const top = restaurants.slice(0, CATALOGUE_SIZE);

    const menus = await Promise.all(
      top.map((r) =>
        this.food.getRestaurantMenu(userId, addressId, r.id).catch(() => null),
      ),
    );

    const out: CatalogueRestaurant[] = top.map((r, i) => {
      const dishes = (menus[i]?.categories ?? [])
        .flatMap((c) => c.items)
        .filter((d) => d.inStock)
        .slice(0, DISHES_PER_RESTAURANT)
        .map((d) => ({
          id: d.id,
          name: d.name,
          price: d.price,
          veg: d.veg,
          imageUrl: d.imageUrl,
          bestseller: d.bestseller,
          inStock: d.inStock,
        }));
      return {
        id: r.id,
        name: r.name,
        cuisines: r.cuisines,
        rating: r.rating,
        etaMin: r.etaMin,
        imageUrl: r.imageUrl,
        costForTwo: r.costForTwo,
        isOpen: r.isOpen,
        dishes,
      };
    });

    // A restaurant with no fetchable menu is useless to the picker.
    const usable = out.filter((r) => r.dishes.length > 0);
    this.catalogueCache = { at: now, value: usable };
    return usable;
  }

  // ── Session ───────────────────────────────────────────────────────────────
  private employee(id: string): Employee {
    const e = this.store.state.employees.find((x) => x.id === id);
    if (!e) throw new NotFoundException(`Unknown employee ${id}`);
    return e;
  }
  /**
   * Session is param-driven: the client passes which persona it's acting as
   * (`asId`), falling back to the seeded default. Keeping "who am I" per-request
   * lets different browser tabs act as different people in the demo without a
   * shared global session.
   */
  getSession(asId?: string): SessionView {
    const currentUser = this.employee(asId ?? this.store.state.currentUserId);
    return { currentUser, isAdmin: currentUser.role === 'admin' };
  }
  signInAs(employeeId: string): SessionView {
    return this.getSession(employeeId); // validates + echoes
  }
  signInByEmail(email: string): SessionView {
    const clean = email.trim().toLowerCase();
    const emp = this.store.state.employees.find((e) => e.workEmail.toLowerCase() === clean);
    if (!emp) throw new NotFoundException(`No member with email ${email}`);
    return this.getSession(emp.id);
  }

  // ── Derived money ─────────────────────────────────────────────────────────
  spentForTeam(costCenterId: string, monthISO = new Date().toISOString()): number {
    return this.store.state.invoices
      .filter((i) => i.costCenterId === costCenterId && i.status !== 'void' && sameMonth(i.date, monthISO))
      .reduce((s, i) => s + i.total, 0);
  }
  private costCentersWithSpend(): CostCenterWithSpend[] {
    const { costCenters, employees } = this.store.state;
    return costCenters.map((cc) => ({
      ...cc,
      spent: this.spentForTeam(cc.id),
      headcount: employees.filter((e) => e.costCenterId === cc.id).length,
    }));
  }
  private metrics(): Metrics {
    const { invoices, orders, costCenters } = this.store.state;
    const month = new Date().toISOString();
    return {
      companySpentThisMonth: invoices
        .filter((i) => i.status !== 'void' && sameMonth(i.date, month))
        .reduce((s, i) => s + i.total, 0),
      companyBudgetTotal: costCenters.reduce((s, c) => s + c.budgetRup, 0),
      openClaims: invoices.filter((i) => i.status === 'issued' || i.status === 'claimed').length,
      teamOrderCount: orders.length,
    };
  }

  /** One call hydrates the whole console (as the given persona). */
  getOverview(asId?: string): OverviewView {
    const { company, employees, orders, invoices, groupOrders } = this.store.state;
    return {
      ...this.getSession(asId),
      company,
      costCenters: this.costCentersWithSpend(),
      employees,
      orders,
      invoices,
      groupOrders,
      metrics: this.metrics(),
    };
  }

  // ── Company / cost centres ────────────────────────────────────────────────
  updateCompany(patch: Partial<Company>): Company {
    return this.store.mutate((s) => {
      s.company = { ...s.company, ...patch };
      return s.company;
    });
  }
  updateCostCenter(id: string, patch: Partial<CostCenter>): CostCenter {
    return this.store.mutate((s) => {
      const cc = s.costCenters.find((c) => c.id === id);
      if (!cc) throw new NotFoundException(`Unknown cost centre ${id}`);
      Object.assign(cc, patch);
      return cc;
    });
  }

  // ── Invoices / orders ─────────────────────────────────────────────────────
  getInvoice(id: string): ConsolidatedInvoice {
    const i = this.store.state.invoices.find((x) => x.id === id);
    if (!i) throw new NotFoundException(`Invoice ${id} not found`);
    return i;
  }
  getOrder(id: string): TeamOrder | undefined {
    return this.store.state.orders.find((o) => o.id === id);
  }
  /** E3 — finance-grade statement as CSV (per-line + totals + placement). */
  exportInvoiceCsv(id: string): { filename: string; csv: string } {
    const inv = this.getInvoice(id);
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const row = (...cells: unknown[]) => cells.map(esc).join(',');
    const food = inv.breakdown.reduce((s, p) => s + p.amount, 0);
    const lines: string[] = [
      row('CaterKart — consolidated statement'),
      '',
      row('Company', inv.companyName),
      row('GSTIN', inv.gstin),
      row('Invoice', inv.number),
      row('Cost centre', `${inv.costCenterName} (${inv.costCenterCode})`),
      row('Order', inv.title),
      row('Date', inv.date),
      row('Placed by', inv.placedByName),
      row('Headcount', inv.headcount),
      row('Status', inv.status),
      '',
      row('Employee', 'Restaurant', 'Dish', 'Qty', 'Amount (INR)'),
    ];
    for (const p of inv.breakdown) for (const it of p.items) lines.push(row(p.name, it.restaurantName, it.dishName, it.qty, it.amount));
    lines.push('', row('', '', '', 'Food subtotal', food));
    lines.push(row('', '', '', 'Delivery + platform', inv.subtotal - food));
    lines.push(row('', '', '', 'GST (5%)', inv.tax));
    lines.push(row('', '', '', 'Total', inv.total));
    if (inv.placement) {
      lines.push('', row('Swiggy sub-orders', `paid: ${inv.placement.paymentUsed} (intended: ${inv.placement.paymentIntended})`));
      lines.push(row('Restaurant', 'Swiggy order id', 'Items', 'Amount', 'Status'));
      for (const so of inv.placement.subOrders) lines.push(row(so.restaurantName, so.swiggyOrderId ?? '—', so.itemCount, so.amount, so.status));
    }
    return { filename: `${inv.number.replace(/[^\w-]/g, '_')}.csv`, csv: lines.join('\r\n') };
  }

  setInvoiceStatus(id: string, status: InvoiceStatus): ConsolidatedInvoice {
    return this.store.mutate((s) => {
      const inv = s.invoices.find((x) => x.id === id);
      if (!inv) throw new NotFoundException(`Invoice ${id} not found`);
      inv.status = status;
      if (status === 'claimed') inv.claimedAt = new Date().toISOString();
      return inv;
    });
  }

  // ── Group-order lifecycle ─────────────────────────────────────────────────
  getGroupOrder(id: string): GroupOrder {
    const g = this.store.state.groupOrders.find((x) => x.id === id);
    if (!g) throw new NotFoundException(`Group order ${id} not found`);
    return g;
  }
  getGroupOrderByToken(t: string): GroupOrder {
    const g = this.store.state.groupOrders.find((x) => x.token === t);
    if (!g) throw new NotFoundException(`No order for link ${t}`);
    return g;
  }

  createGroupOrder(input: { title: string; costCenterId: string; organizerId: string; date: string }): GroupOrder {
    return this.store.mutate((s) => {
      const cc = s.costCenters.find((c) => c.id === input.costCenterId);
      if (!cc) throw new BadRequestException(`Unknown cost centre ${input.costCenterId}`);
      const now = new Date().toISOString();
      const go: GroupOrder = {
        id: uid('go_'),
        token: token(),
        title: input.title?.trim() || 'Team lunch',
        costCenterId: input.costCenterId,
        organizerId: input.organizerId,
        address: s.company.addressLabel,
        date: input.date,
        status: 'collecting',
        perHeadCapRup: cc.perHeadCapRup,
        createdAt: now,
        participants: [{ employeeId: input.organizerId, status: 'joined', lines: [], joinedAt: now }],
      };
      s.groupOrders.unshift(go);
      return go;
    });
  }

  joinGroupOrder(orderId: string, employeeId: string): GroupOrder {
    return this.store.mutate((s) => {
      const g = s.groupOrders.find((x) => x.id === orderId);
      if (!g) throw new NotFoundException(`Group order ${orderId} not found`);
      if (!g.participants.some((p) => p.employeeId === employeeId)) {
        g.participants.push({ employeeId, status: 'joined', lines: [], joinedAt: new Date().toISOString() });
      }
      return g;
    });
  }

  setParticipantLines(orderId: string, employeeId: string, lines: OrderLine[]): GroupOrder {
    return this.store.mutate((s) => {
      const g = s.groupOrders.find((x) => x.id === orderId);
      if (!g) throw new NotFoundException(`Group order ${orderId} not found`);
      const status: ParticipantStatus = lines.length > 0 ? 'picking' : 'joined';
      const existing = g.participants.find((p) => p.employeeId === employeeId);
      if (existing) {
        existing.lines = lines;
        existing.status = status;
      } else {
        g.participants.push({ employeeId, status, lines, joinedAt: new Date().toISOString() });
      }
      return g;
    });
  }

  submitParticipant(orderId: string, employeeId: string): GroupOrder {
    return this.store.mutate((s) => {
      const g = s.groupOrders.find((x) => x.id === orderId);
      if (!g) throw new NotFoundException(`Group order ${orderId} not found`);
      const p = g.participants.find((x) => x.employeeId === employeeId);
      if (p) {
        p.status = 'submitted';
        p.submittedAt = new Date().toISOString();
      }
      return g;
    });
  }

  cancelGroupOrder(orderId: string): GroupOrder {
    return this.store.mutate((s) => {
      const g = s.groupOrders.find((x) => x.id === orderId);
      if (!g) throw new NotFoundException(`Group order ${orderId} not found`);
      g.status = 'cancelled';
      return g;
    });
  }

  /**
   * D5 — the seam. Finalise a group order by actually placing it through the
   * Swiggy MCP: collapse everyone's picks into real single-restaurant food
   * sub-orders (split by the ₹1000 cap), place each through the company service
   * account (D7) with the payment port (D6), reconciliation-safe, then build the
   * ConsolidatedInvoice from what actually landed. Mock now, live when creds land.
   */
  async placeGroupOrder(orderId: string): Promise<ConsolidatedInvoice> {
    const s = this.store.state;
    const go = s.groupOrders.find((x) => x.id === orderId);
    if (!go) throw new NotFoundException(`Group order ${orderId} not found`);
    if (go.status !== 'collecting') throw new BadRequestException('Order is not collecting');
    const contributing = go.participants.filter((p) => p.lines.length > 0);
    if (contributing.length === 0) throw new BadRequestException('No one has picked anything yet');

    const company = s.company;
    const memberIds = contributing.map((p) => p.employeeId);
    const lines = contributing.flatMap((p) => p.lines);
    const payment = this.resolvePayment(company);

    // Real Swiggy sub-orders: group by restaurant, split by the ₹1000 cap.
    const subCarts = splitIntoSubOrders(lines, this.foodCapRupees);
    const placed: PlacedSubOrder[] = [];

    for (const sc of subCarts) {
      const restaurantName = sc.lines[0]?.restaurantName ?? sc.restaurantId;
      const itemCount = sc.lines.reduce((n, l) => n + l.qty, 0);
      try {
        await this.food.flushFoodCart(company.swiggyServiceUserId).catch(() => undefined);
        await this.food.updateFoodCart(
          company.swiggyServiceUserId,
          company.swiggyServiceAddressId,
          sc.restaurantId,
          sc.lines.map((l) => ({ menu_item_id: String(l.dishId), quantity: l.qty })),
        );
        const { orderId: swiggyOrderId, reconciled } = await this.food.placeReconciled(
          company.swiggyServiceUserId,
          company.swiggyServiceAddressId,
          { restaurantId: sc.restaurantId, expectedTotal: sc.total, paymentMethod: payment.used },
        );
        placed.push({ restaurantId: sc.restaurantId, restaurantName, swiggyOrderId, amount: sc.total, itemCount, status: reconciled ? 'reconciled' : 'placed' });
      } catch (err) {
        this.log.error(`sub-order for ${sc.restaurantId} failed: ${String(err)}`);
        placed.push({ restaurantId: sc.restaurantId, restaurantName, swiggyOrderId: null, amount: sc.total, itemCount, status: 'failed' });
      }
    }

    if (!placed.some((p) => p.status !== 'failed')) {
      throw new BadRequestException('All sub-orders failed to place — order not finalised. Check the Swiggy connection.');
    }

    // Persist: build the invoice + attach the real placement record, mark placed.
    return this.store.mutate((st) => {
      const g = st.groupOrders.find((x) => x.id === orderId)!;
      const cc = st.costCenters.find((c) => c.id === g.costCenterId)!;
      const base: Omit<TeamOrder, 'invoiceId'> = {
        id: uid('to_'), title: g.title, costCenterId: g.costCenterId, placedById: g.organizerId,
        address: g.address, date: g.date, memberIds, lines, status: 'placed', placedAt: new Date().toISOString(),
      };
      const invoice = buildInvoiceFromOrder(
        base,
        { company: st.company, costCenter: cc, employeeName: (id) => st.employees.find((e) => e.id === id)?.name ?? 'Unknown' },
        st.invoiceSeq,
      );
      invoice.placement = {
        paymentIntended: payment.intended,
        paymentUsed: payment.used,
        subOrders: placed,
        anyReconciled: placed.some((p) => p.status === 'reconciled'),
        anyFailed: placed.some((p) => p.status === 'failed'),
      };
      st.invoiceSeq += 1;
      st.orders.unshift({ ...base, invoiceId: invoice.id });
      st.invoices.unshift(invoice);
      g.status = 'placed';
      g.placedInvoiceId = invoice.id;
      return invoice;
    });
  }
}
