import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode,
} from 'react';
import { workApi, getPersona, setPersona } from '../lib/workApi';
import type {
  CatalogueRestaurant, Company, ConsolidatedInvoice, CostCenter, CostCenterWithSpend,
  Employee, GroupOrder, InvoiceStatus, OrderLine, OverviewView, Participant, ParticipantStatus, TeamOrder,
} from '../lib/workTypes';

// Re-export the domain types so components keep importing them from here.
export type {
  OrderLine, Participant, GroupOrder, TeamOrder, ConsolidatedInvoice, InvoiceStatus,
  Company, CostCenter, CostCenterWithSpend, Employee, CatalogueRestaurant,
} from '../lib/workTypes';

// =====================================================
// Placeholders used only during the first load (WorkShell gates on `loading`,
// so these are effectively never rendered — they just keep types honest).
// =====================================================
const PLACEHOLDER_USER: Employee = {
  id: '', name: '…', initials: '', color: 'bg-neutral-300', workEmail: '',
  role: 'member', costCenterId: '', dietary: 'veg',
};
const PLACEHOLDER_COMPANY: Company = {
  id: '', name: '…', logoEmoji: '🛰️', emailDomain: '', gstin: '', billingEmail: '',
  addressLabel: '', plan: 'pilot', billingLinked: false, walletBalance: 0,
};

type Ctx = {
  loading: boolean;
  catalogue: CatalogueRestaurant[];

  // data (from the /overview snapshot)
  company: Company;
  costCenters: CostCenterWithSpend[];
  employees: Employee[];
  orders: TeamOrder[];
  invoices: ConsolidatedInvoice[];
  groupOrders: GroupOrder[];
  currentUser: Employee;
  isAdmin: boolean;

  // derived
  companySpentThisMonth: number;
  companyBudgetTotal: number;
  spentForTeam: (costCenterId: string) => number;

  // lookups (replace the old data/corporate helpers)
  employeeById: (id: string) => Employee | undefined;
  costCenterById: (id: string) => CostCenterWithSpend | undefined;
  employeesByTeam: (costCenterId: string) => Employee[];
  getInvoice: (id: string) => ConsolidatedInvoice | undefined;
  getOrder: (id: string) => TeamOrder | undefined;
  getGroupOrder: (id: string) => GroupOrder | undefined;
  getGroupOrderByToken: (token: string) => GroupOrder | undefined;

  // actions
  signInAs: (employeeId: string) => Promise<void>;
  signInByEmail: (email: string) => Promise<Employee | null>;
  createGroupOrder: (o: { title: string; costCenterId: string; organizerId: string; date: string }) => Promise<GroupOrder>;
  joinGroupOrder: (orderId: string, employeeId: string) => Promise<void>;
  setParticipantLines: (orderId: string, employeeId: string, lines: OrderLine[]) => void;
  submitParticipant: (orderId: string, employeeId: string) => Promise<void>;
  placeGroupOrder: (orderId: string) => Promise<ConsolidatedInvoice | null>;
  cancelGroupOrder: (orderId: string) => Promise<void>;
  setInvoiceStatus: (id: string, status: InvoiceStatus) => Promise<void>;
  updateCostCenter: (id: string, patch: Partial<CostCenter>) => Promise<void>;
  updateCompany: (patch: Partial<Company>) => Promise<void>;
};

const C = createContext<Ctx | null>(null);

export function CorporateProvider({ children }: { children: ReactNode }) {
  const [overview, setOverview] = useState<OverviewView | null>(null);
  const [catalogue, setCatalogue] = useState<CatalogueRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const persona = useRef<string | null>(getPersona());

  const refresh = useCallback(async () => {
    const ov = await workApi.overview(persona.current);
    setOverview(ov);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ov, cat] = await Promise.all([workApi.overview(persona.current), workApi.catalogue()]);
        if (cancelled) return;
        setOverview(ov);
        setCatalogue(cat);
      } catch {
        /* backend down — pages will show empty; loading still clears */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Derived cache reads ──
  const company = overview?.company ?? PLACEHOLDER_COMPANY;
  const costCenters = overview?.costCenters ?? [];
  const employees = overview?.employees ?? [];
  const orders = overview?.orders ?? [];
  const invoices = overview?.invoices ?? [];
  const groupOrders = overview?.groupOrders ?? [];
  const currentUser = overview?.currentUser ?? PLACEHOLDER_USER;
  const isAdmin = overview?.isAdmin ?? false;
  const companySpentThisMonth = overview?.metrics.companySpentThisMonth ?? 0;
  const companyBudgetTotal = overview?.metrics.companyBudgetTotal ?? 0;

  const employeeById = useCallback((id: string) => employees.find((e) => e.id === id), [employees]);
  const costCenterById = useCallback((id: string) => costCenters.find((c) => c.id === id), [costCenters]);
  const employeesByTeam = useCallback((ccId: string) => employees.filter((e) => e.costCenterId === ccId), [employees]);
  const spentForTeam = useCallback((ccId: string) => costCenters.find((c) => c.id === ccId)?.spent ?? 0, [costCenters]);
  const getInvoice = useCallback((id: string) => invoices.find((i) => i.id === id), [invoices]);
  const getOrder = useCallback((id: string) => orders.find((o) => o.id === id), [orders]);
  const getGroupOrder = useCallback((id: string) => groupOrders.find((g) => g.id === id), [groupOrders]);
  const getGroupOrderByToken = useCallback((t: string) => groupOrders.find((g) => g.token === t), [groupOrders]);

  // ── Actions ──
  const signInAs = useCallback(async (employeeId: string) => {
    persona.current = employeeId;
    setPersona(employeeId);
    await refresh();
  }, [refresh]);

  const signInByEmail = useCallback(async (email: string): Promise<Employee | null> => {
    try {
      const { currentUser: emp } = await workApi.signInByEmail(email);
      persona.current = emp.id;
      setPersona(emp.id);
      await refresh();
      return emp;
    } catch {
      return null;
    }
  }, [refresh]);

  const createGroupOrder = useCallback(async (o: { title: string; costCenterId: string; organizerId: string; date: string }) => {
    const go = await workApi.createGroupOrder(o);
    await refresh();
    return go;
  }, [refresh]);

  const joinGroupOrder = useCallback(async (orderId: string, employeeId: string) => {
    await workApi.join(orderId, employeeId);
    await refresh();
  }, [refresh]);

  // Optimistic: patch the local snapshot so the picker is instant, persist in
  // the background, and resync from the server if the write fails.
  const setParticipantLines = useCallback((orderId: string, employeeId: string, lines: OrderLine[]) => {
    setOverview((prev) => {
      if (!prev) return prev;
      const groupOrders = prev.groupOrders.map((g) => {
        if (g.id !== orderId) return g;
        const exists = g.participants.some((p) => p.employeeId === employeeId);
        const status: ParticipantStatus = lines.length > 0 ? 'picking' : 'joined';
        const participants: Participant[] = exists
          ? g.participants.map((p) => (p.employeeId === employeeId ? { ...p, lines, status } : p))
          : [...g.participants, { employeeId, status, lines, joinedAt: new Date().toISOString() }];
        return { ...g, participants };
      });
      return { ...prev, groupOrders };
    });
    workApi.setLines(orderId, employeeId, lines).catch(() => { void refresh(); });
  }, [refresh]);

  const submitParticipant = useCallback(async (orderId: string, employeeId: string) => {
    await workApi.submit(orderId, employeeId);
    await refresh();
  }, [refresh]);

  const placeGroupOrder = useCallback(async (orderId: string): Promise<ConsolidatedInvoice | null> => {
    try {
      const inv = await workApi.place(orderId);
      await refresh();
      return inv;
    } catch {
      await refresh();
      return null;
    }
  }, [refresh]);

  const cancelGroupOrder = useCallback(async (orderId: string) => {
    await workApi.cancel(orderId);
    await refresh();
  }, [refresh]);

  const setInvoiceStatus = useCallback(async (id: string, status: InvoiceStatus) => {
    await workApi.setInvoiceStatus(id, status);
    await refresh();
  }, [refresh]);

  const updateCostCenter = useCallback(async (id: string, patch: Partial<CostCenter>) => {
    await workApi.updateCostCenter(id, patch);
    await refresh();
  }, [refresh]);

  const updateCompany = useCallback(async (patch: Partial<Company>) => {
    await workApi.updateCompany(patch);
    await refresh();
  }, [refresh]);

  const value = useMemo<Ctx>(() => ({
    loading, catalogue,
    company, costCenters, employees, orders, invoices, groupOrders, currentUser, isAdmin,
    companySpentThisMonth, companyBudgetTotal, spentForTeam,
    employeeById, costCenterById, employeesByTeam, getInvoice, getOrder, getGroupOrder, getGroupOrderByToken,
    signInAs, signInByEmail, createGroupOrder, joinGroupOrder, setParticipantLines, submitParticipant,
    placeGroupOrder, cancelGroupOrder, setInvoiceStatus, updateCostCenter, updateCompany,
  }), [
    loading, catalogue, company, costCenters, employees, orders, invoices, groupOrders, currentUser, isAdmin,
    companySpentThisMonth, companyBudgetTotal, spentForTeam, employeeById, costCenterById, employeesByTeam,
    getInvoice, getOrder, getGroupOrder, getGroupOrderByToken, signInAs, signInByEmail, createGroupOrder,
    joinGroupOrder, setParticipantLines, submitParticipant, placeGroupOrder, cancelGroupOrder,
    setInvoiceStatus, updateCostCenter, updateCompany,
  ]);

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useCorporate() {
  const v = useContext(C);
  if (!v) throw new Error('useCorporate must be used inside CorporateProvider');
  return v;
}
