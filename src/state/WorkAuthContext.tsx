import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import { initialsFor } from './PersonalAuthContext';

// =====================================================
// Work auth — the identity layer for CaterKart for Work.
//
//  • Members sign in with their work email + OTP (always 1234).
//  • Admins can additionally create an organization and add members.
//  • Roles: admin (runs the org) · lead (owns a team) · member.
//
// Orgs + members are seeded (mock) and then persisted to localStorage so
// admin edits survive a reload. This is the seam that a real backend
// (SSO / email-domain binding) slots into later — the UI never changes.
// =====================================================

export type WorkRole = 'admin' | 'lead' | 'member';

export type Org = {
  id: string;
  name: string;
  emailDomain: string;
  logoEmoji: string;
  plan: 'pilot' | 'growth' | 'enterprise';
};

export type WorkMember = {
  id: string;
  orgId: string;
  name: string;
  email: string;
  role: WorkRole;
  initials: string;
  color: string;
};

export const WORK_MOCK_OTP = '1234';

const IDENTITY_KEY = 'caterkart.work.identity.v1';
const SESSION_KEY = 'caterkart.work.session';

// ── Seed: two orgs so "multiple orgs / multiple roles" is real ───────────────
// Aurelia Labs mirrors the backend roster (so email sign-in also drives the
// operational console via signInByEmail). Northwind is a second tenant.
const SEED_ORGS: Org[] = [
  { id: 'org_aurelia', name: 'Aurelia Labs', emailDomain: 'aurelialabs.com', logoEmoji: '🛰️', plan: 'pilot' },
  { id: 'org_northwind', name: 'Northwind Traders', emailDomain: 'northwind.co', logoEmoji: '🏢', plan: 'growth' },
];

const mk = (orgId: string, name: string, email: string, role: WorkRole, color: string): WorkMember => ({
  id: 'wm_' + email.split('@')[0].replace(/[^a-z0-9]/gi, ''),
  orgId,
  name,
  email: email.toLowerCase(),
  role,
  initials: initialsFor(name),
  color,
});

const SEED_MEMBERS: WorkMember[] = [
  // Aurelia Labs
  mk('org_aurelia', 'Divya Menon', 'divya@aurelialabs.com', 'admin', 'bg-swiggy-orange'),
  mk('org_aurelia', 'Arjun Rao', 'arjun@aurelialabs.com', 'lead', 'bg-blue-500'),
  mk('org_aurelia', 'Sara Thomas', 'sara@aurelialabs.com', 'member', 'bg-emerald-500'),
  mk('org_aurelia', 'Imran Sheikh', 'imran@aurelialabs.com', 'member', 'bg-indigo-500'),
  mk('org_aurelia', 'Lin Zhao', 'lin@aurelialabs.com', 'member', 'bg-cyan-500'),
  mk('org_aurelia', 'Dev Patel', 'dev@aurelialabs.com', 'member', 'bg-teal-500'),
  mk('org_aurelia', 'Neha Gupta', 'neha@aurelialabs.com', 'lead', 'bg-pink-500'),
  mk('org_aurelia', 'Rohit Anand', 'rohit@aurelialabs.com', 'member', 'bg-amber-500'),
  mk('org_aurelia', 'Fatima Ali', 'fatima@aurelialabs.com', 'member', 'bg-rose-500'),
  mk('org_aurelia', 'Kabir Nair', 'kabir@aurelialabs.com', 'lead', 'bg-purple-500'),
  mk('org_aurelia', 'Maya Iyer', 'maya@aurelialabs.com', 'member', 'bg-fuchsia-500'),
  // Northwind Traders
  mk('org_northwind', 'Karan Malhotra', 'karan@northwind.co', 'admin', 'bg-violet-500'),
  mk('org_northwind', 'Meena Pillai', 'meena@northwind.co', 'lead', 'bg-sky-500'),
  mk('org_northwind', 'Sameer Khan', 'sameer@northwind.co', 'member', 'bg-lime-600'),
];

const MEMBER_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-teal-500',
  'bg-pink-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-sky-500',
];

type Identity = { orgs: Org[]; members: WorkMember[] };

function loadIdentity(): Identity {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (raw) return JSON.parse(raw) as Identity;
  } catch {
    /* fall through to seed */
  }
  const seed = { orgs: SEED_ORGS, members: SEED_MEMBERS };
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(seed));
  return seed;
}
function saveIdentity(id: Identity) {
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(id));
}

const domainOf = (email: string) => email.toLowerCase().split('@')[1] ?? '';
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
let seq = 0;
const newId = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}`;

type Ctx = {
  session: WorkMember | null;
  org: Org | null;
  members: WorkMember[]; // members of the current org
  isAdmin: boolean;
  roleLabel: string;

  signIn: (email: string, otp: string) => Promise<WorkMember>;
  createOrg: (
    input: { orgName: string; adminName: string; adminEmail: string },
    otp: string,
  ) => Promise<WorkMember>;
  addMember: (input: { name: string; email: string; role: WorkRole }) => Promise<WorkMember>;
  updateMemberRole: (memberId: string, role: WorkRole) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  signOut: () => void;
};

const C = createContext<Ctx | null>(null);

const roleLabelFor = (r?: WorkRole) => (r === 'admin' ? 'HR · Admin' : r === 'lead' ? 'Team lead' : 'Member');

export function WorkAuthProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity>(() => loadIdentity());
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem(SESSION_KEY));

  const commit = useCallback((next: Identity) => {
    setIdentity(next);
    saveIdentity(next);
  }, []);

  const session = useMemo(
    () => identity.members.find((m) => m.id === sessionId) ?? null,
    [identity.members, sessionId],
  );
  const org = useMemo(
    () => (session ? identity.orgs.find((o) => o.id === session.orgId) ?? null : null),
    [identity.orgs, session],
  );
  const members = useMemo(
    () => (session ? identity.members.filter((m) => m.orgId === session.orgId) : []),
    [identity.members, session],
  );
  const isAdmin = session?.role === 'admin';

  const setSession = useCallback((memberId: string | null) => {
    setSessionId(memberId);
    if (memberId) localStorage.setItem(SESSION_KEY, memberId);
    else localStorage.removeItem(SESSION_KEY);
  }, []);

  const signIn = useCallback(async (email: string, otp: string): Promise<WorkMember> => {
    await new Promise((r) => setTimeout(r, 300));
    if (otp.trim() !== WORK_MOCK_OTP) throw new Error('That code is not right. Try 1234.');
    const found = identity.members.find((m) => m.email === email.trim().toLowerCase());
    if (!found) throw new Error('No CaterKart account for that work email. Ask your admin to add you, or create an organization.');
    setSession(found.id);
    return found;
  }, [identity.members, setSession]);

  const createOrg = useCallback(async (
    input: { orgName: string; adminName: string; adminEmail: string },
    otp: string,
  ): Promise<WorkMember> => {
    await new Promise((r) => setTimeout(r, 400));
    if (otp.trim() !== WORK_MOCK_OTP) throw new Error('That code is not right. Try 1234.');
    const email = input.adminEmail.trim().toLowerCase();
    const domain = domainOf(email);
    if (!domain) throw new Error('Enter a valid work email.');
    if (identity.members.some((m) => m.email === email)) {
      throw new Error('That email already has an account — sign in instead.');
    }
    const orgId = newId('org_' + slug(input.orgName).slice(0, 12));
    const org: Org = {
      id: orgId,
      name: input.orgName.trim(),
      emailDomain: domain,
      logoEmoji: '🏢',
      plan: 'pilot',
    };
    const admin: WorkMember = {
      id: newId('wm'),
      orgId,
      name: input.adminName.trim(),
      email,
      role: 'admin',
      initials: initialsFor(input.adminName),
      color: 'bg-swiggy-orange',
    };
    commit({ orgs: [...identity.orgs, org], members: [...identity.members, admin] });
    setSession(admin.id);
    return admin;
  }, [identity, commit, setSession]);

  const addMember = useCallback(async (
    input: { name: string; email: string; role: WorkRole },
  ): Promise<WorkMember> => {
    if (!session || session.role !== 'admin' || !org) throw new Error('Only admins can add members.');
    await new Promise((r) => setTimeout(r, 250));
    const email = input.email.trim().toLowerCase();
    if (!email.includes('@')) throw new Error('Enter a valid work email.');
    if (identity.members.some((m) => m.email === email)) throw new Error('That email is already a member.');
    const color = MEMBER_COLORS[identity.members.length % MEMBER_COLORS.length];
    const member: WorkMember = {
      id: newId('wm'),
      orgId: org.id,
      name: input.name.trim(),
      email,
      role: input.role,
      initials: initialsFor(input.name),
      color,
    };
    commit({ ...identity, members: [...identity.members, member] });
    return member;
  }, [session, org, identity, commit]);

  const updateMemberRole = useCallback(async (memberId: string, role: WorkRole) => {
    if (!session || session.role !== 'admin') throw new Error('Only admins can change roles.');
    commit({ ...identity, members: identity.members.map((m) => (m.id === memberId ? { ...m, role } : m)) });
  }, [session, identity, commit]);

  const removeMember = useCallback(async (memberId: string) => {
    if (!session || session.role !== 'admin') throw new Error('Only admins can remove members.');
    if (memberId === session.id) throw new Error("You can't remove yourself.");
    commit({ ...identity, members: identity.members.filter((m) => m.id !== memberId) });
  }, [session, identity, commit]);

  const signOut = useCallback(() => setSession(null), [setSession]);

  const value = useMemo<Ctx>(() => ({
    session, org, members, isAdmin, roleLabel: roleLabelFor(session?.role),
    signIn, createOrg, addMember, updateMemberRole, removeMember, signOut,
  }), [session, org, members, isAdmin, signIn, createOrg, addMember, updateMemberRole, removeMember, signOut]);

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useWorkAuth() {
  const v = useContext(C);
  if (!v) throw new Error('useWorkAuth must be used inside WorkAuthProvider');
  return v;
}
