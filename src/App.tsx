import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Seo from './components/Seo';
import Header from './components/Header';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import Create from './pages/Create';
import GroupCart from './pages/GroupCart';
import Addons from './pages/Addons';
import Confirm from './pages/Confirm';
import EventSummary from './pages/EventSummary';
import Settle from './pages/Settle';
import InviteGuest from './pages/InviteGuest';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import PersonalLogin from './pages/PersonalLogin';
import WorkLogin from './pages/WorkLogin';
import WorkHome from './pages/WorkHome';
import NewGroupOrder from './pages/NewGroupOrder';
import GroupOrderManage from './pages/GroupOrderManage';
import JoinOrder from './pages/JoinOrder';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import BudgetSettings from './pages/BudgetSettings';
import OperatorConsole from './pages/OperatorConsole';
import OrganizationSettings from './pages/OrganizationSettings';
import { CelebrationProvider } from './state/CelebrationContext';
import { SwiggyProvider } from './state/SwiggyContext';
import SwiggyGate from './components/SwiggyGate';
import { CorporateProvider, useCorporate } from './state/CorporateContext';
import { PersonalAuthProvider, usePersonalAuth } from './state/PersonalAuthContext';
import { WorkAuthProvider, useWorkAuth } from './state/WorkAuthContext';
import { caterkartRoutes } from './caterkart/CaterkartRoutes';

/** Personal routes require a phone+OTP session; otherwise → /login. */
function RequirePersonal({ children }: { children: React.ReactNode }) {
  const { user } = usePersonalAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

/**
 * Food routes additionally need a live Swiggy grant AND a delivery address —
 * both are hard requirements of the Swiggy MCP (every tool call needs a token,
 * and nearly every one needs an addressId), not UX niceties.
 */
function Food({ children }: { children: React.ReactNode }) {
  return (
    <RequirePersonal>
      <SwiggyGate>{children}</SwiggyGate>
    </RequirePersonal>
  );
}

/** Work routes require a work-email session; otherwise → /work/login. */
function RequireWork({ children }: { children: React.ReactNode }) {
  const { session } = useWorkAuth();
  const loc = useLocation();
  if (!session) return <Navigate to="/work/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

/** Holds /work pages until the backend snapshot has loaded, so their bodies
 *  never render against empty data. Doesn't block the consumer app. */
function WorkGate({ children }: { children: React.ReactNode }) {
  const { loading } = useCorporate();
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-secondary grid place-items-center">
        <div className="flex items-center gap-2 text-ink-tertiary text-sm font-semibold">
          <span className="w-4 h-4 rounded-full border-2 border-line-default border-t-swiggy-orange animate-spin-slow" />
          Loading workspace…
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

/** Compose the work guard + data gate for every /work app route. */
function Work({ children }: { children: React.ReactNode }) {
  return (
    <RequireWork>
      <WorkGate>{children}</WorkGate>
    </RequireWork>
  );
}

function ChromeShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();

  // One header and one footer for the whole app — including the CaterBox
  // pages carried over from the CaterKart app, which used to bring their own
  // and so stacked a second header under this one.
  //
  // Two surfaces still supply their own chrome, because neither is the
  // consumer app:
  //  • /work/*    — the corporate console has WorkShell, its own nav and tabs
  //  • /invite/*  — a guest opens this with no account, so the profile menu
  //                 and address picker in the app header are useless to them
  const ownChrome =
    loc.pathname.startsWith('/work') || loc.pathname.startsWith('/invite/');

  if (ownChrome) return <main>{children}</main>;

  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}

/**
 * Applies the default title, description and robots directive for whatever
 * route is currently rendered. Lives inside the Router so it can read the
 * location; see src/components/Seo.tsx for how `noindex` is decided.
 */
function RouteSeo() {
  return <Seo />;
}

export default function App() {
  return (
    // Order matters: CelebrationProvider reads the signed-in host from
    // PersonalAuth and the delivery address from Swiggy, so BOTH must wrap it.
    <SwiggyProvider>
      <PersonalAuthProvider>
        <CelebrationProvider>
          <CorporateProvider>
            <WorkAuthProvider>
              <ScrollToTop />
              {/*
                Baseline meta for EVERY route, applied once here rather than
                page by page. It derives `noindex` from the path, so a new
                private route — and in particular anything under /invite/,
                where the URL itself is the guest's credential — is excluded
                from search by default instead of by somebody remembering to
                add a prop. Pages that want richer tags render their own <Seo>,
                which Helmet applies on top of this one.
              */}
              <RouteSeo />
              <ChromeShell>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<PersonalLogin />} />

                  {/* ── Personal (auth + Swiggy grant + address) ── */}
                  <Route path="/create" element={<Food><Create /></Food>} />
                  <Route path="/group" element={<Food><GroupCart /></Food>} />
                  <Route path="/addons" element={<Food><Addons /></Food>} />
                  <Route path="/confirm" element={<Food><Confirm /></Food>} />
                  <Route path="/event" element={<Food><EventSummary /></Food>} />
                  <Route path="/settle" element={<Food><Settle /></Food>} />
                  <Route path="/orders" element={<Food><Orders /></Food>} />
                  <Route path="/orders/:id" element={<Food><OrderDetail /></Food>} />
                  {/* Guests join via link without an account */}
                  <Route path="/invite/:token" element={<InviteGuest />} />

                  {/* ── CaterKart for Work (auth-gated console) ── */}
                  <Route path="/work/login" element={<WorkLogin />} />
                  <Route path="/work" element={<Work><WorkHome /></Work>} />
                  <Route path="/work/order" element={<Work><NewGroupOrder /></Work>} />
                  <Route path="/work/group/:id" element={<Work><GroupOrderManage /></Work>} />
                  <Route path="/work/join/:token" element={<Work><JoinOrder /></Work>} />
                  <Route path="/work/invoices" element={<Work><Invoices /></Work>} />
                  <Route path="/work/invoices/:id" element={<Work><InvoiceDetail /></Work>} />
                  <Route path="/work/settings" element={<Work><BudgetSettings /></Work>} />
                  <Route path="/work/org" element={<Work><OrganizationSettings /></Work>} />
                  <Route path="/work/ops" element={<Work><OperatorConsole /></Work>} />

                  {/* ── CaterBox (own kitchen) — deliberately outside `Food`,
                       so ordering from our own kitchen never asks for a
                       Swiggy login. See caterkart/CaterkartRoutes.tsx. ── */}
                  {caterkartRoutes}

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </ChromeShell>
            </WorkAuthProvider>
          </CorporateProvider>
        </CelebrationProvider>
      </PersonalAuthProvider>
    </SwiggyProvider>
  );
}
