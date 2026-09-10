/**
 * CaterKart for Work API client. The frontend holds no business logic — every
 * read and mutation goes through here to /api/work/*.
 *
 * "Who am I acting as" (the demo persona) is the one client-side concern: it's
 * persisted locally and sent as `?as=` so different browser tabs can be
 * different people without a shared server session.
 */
import type {
  CatalogueRestaurant, Company, ConsolidatedInvoice, CostCenter, GroupOrder, InvoiceStatus,
  OrderLine, OverviewView, SessionView,
} from './workTypes';

const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:4000';
const PERSONA_KEY = 'caterkart.work.persona';

export function getPersona(): string | null {
  return localStorage.getItem(PERSONA_KEY);
}
export function setPersona(id: string): void {
  localStorage.setItem(PERSONA_KEY, id);
}

export class WorkApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'WorkApiError';
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api/work${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new WorkApiError(res.status, body || res.statusText);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const asQ = (as?: string | null) => (as ? `?as=${encodeURIComponent(as)}` : '');

export const workApi = {
  overview: (as?: string | null) => req<OverviewView>(`/overview${asQ(as)}`),
  catalogue: () => req<CatalogueRestaurant[]>(`/catalogue`),

  signInByEmail: (email: string) =>
    req<SessionView>(`/session/sign-in-by-email`, { method: 'POST', body: JSON.stringify({ email }) }),

  createGroupOrder: (dto: { title: string; costCenterId: string; organizerId: string; date: string }) =>
    req<GroupOrder>(`/group-orders`, { method: 'POST', body: JSON.stringify(dto) }),
  getGroupOrder: (id: string) => req<GroupOrder>(`/group-orders/${id}`),
  getGroupOrderByToken: (token: string) => req<GroupOrder>(`/join/${token}`),
  join: (id: string, employeeId: string) =>
    req<GroupOrder>(`/group-orders/${id}/join`, { method: 'POST', body: JSON.stringify({ employeeId }) }),
  setLines: (id: string, employeeId: string, lines: OrderLine[]) =>
    req<GroupOrder>(`/group-orders/${id}/participants/${employeeId}/lines`, { method: 'PUT', body: JSON.stringify({ lines }) }),
  submit: (id: string, employeeId: string) =>
    req<GroupOrder>(`/group-orders/${id}/participants/${employeeId}/submit`, { method: 'POST', body: '{}' }),
  place: (id: string) => req<ConsolidatedInvoice>(`/group-orders/${id}/place`, { method: 'POST', body: '{}' }),
  cancel: (id: string) => req<GroupOrder>(`/group-orders/${id}/cancel`, { method: 'POST', body: '{}' }),

  setInvoiceStatus: (id: string, status: InvoiceStatus) =>
    req<ConsolidatedInvoice>(`/invoices/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  updateCompany: (patch: Partial<Company>) =>
    req<Company>(`/company`, { method: 'PATCH', body: JSON.stringify(patch) }),
  updateCostCenter: (id: string, patch: Partial<CostCenter>) =>
    req<CostCenter>(`/cost-centers/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
};

/** Direct URL for the CSV statement download (E3). */
export const invoiceCsvUrl = (id: string) => `${API_BASE}/api/work/invoices/${id}/export.csv`;
