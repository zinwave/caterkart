import { lazy, Suspense } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Route } from 'react-router-dom';
import { AdminAuthProvider } from './components/adminAuth/context.jsx';
import './caterkart.scss';

/**
 * These pages are plain JSX carried over from the CaterKart app and carry no
 * prop types. TypeScript infers required props from their destructuring and
 * then objects to routes rendering them bare — exactly as the original router
 * did. Typing them as untyped components states that honestly instead of
 * inventing prop contracts they never had.
 */
const page = (loader: () => Promise<any>) =>
  lazy(loader as () => Promise<{ default: ComponentType<any> }>);

// =====================================================
// CaterBox — the own-kitchen half, migrated from the CaterKart app
// (mealmate) with its pages, components, services and styles intact.
//
// NOT wrapped in the app's `Food` guard. That guard chains
// RequirePersonal → SwiggyGate, which demands a Swiggy OAuth grant and a
// Swiggy address-book entry. CaterBox is cooked in our own kitchen and
// has nothing to do with Swiggy, so requiring a Swiggy login to order it
// would make no sense. Customer identity here is the phone number
// collected by OTP at checkout; the admin console has its own OTP gate.
//
// Paths are the originals, because the migrated pages navigate between
// themselves by those literals and none collided with a route this app
// already had. The one exception is the entry screen, which was
// mealmate's "/" and lives at /caterbox here, since "/" is now the
// combined landing.
//
// The API is the same process as everything else, at /api/ck/*.
// =====================================================

// Customer flow
const Configure   = page(() => import('./pages/caterbox/index.jsx'));
const CreateMenu  = page(() => import('./pages/create-menu/index.jsx'));
const Checkout    = page(() => import('./pages/checkout/index.jsx'));
const TrackOrder  = page(() => import('./pages/trackOrder/index.jsx'));
const CreateSub   = page(() => import('./pages/createSubscription/index.jsx'));

// Content
const About       = page(() => import('./pages/about/index.jsx'));
const Kitchen     = page(() => import('./pages/kitchen/index.jsx'));
const Legal       = page(() => import('./pages/legal/index.jsx'));
const Contact     = page(() => import('./pages/contact/index.jsx'));
const VendorLogin = page(() => import('./pages/vendorLogin/index.jsx'));

// Ops console — its own OTP gate, unrelated to the customer flows
const RequireAdmin    = page(() => import('./components/requireAdmin/index.jsx'));
const FullAdminOnly   = page(() => import('./components/adminAuth/FullAdminOnly.jsx'));
const AdminHome       = page(() => import('./pages/adminPage/index.jsx'));
const AdminOrders     = page(() => import('./pages/orders/index.jsx'));
const AdminOrder      = page(() => import('./pages/orderDetails/index.jsx'));
const AdminCombos     = page(() => import('./pages/adminPage/combos/index.jsx'));
const AdminVendors    = page(() => import('./pages/adminPage/vendors/index.jsx'));
const AdminPincodes   = page(() => import('./pages/adminPage/pincodes/index.jsx'));
const AdminSettings   = page(() => import('./pages/adminPage/settings/index.jsx'));
const InvFood         = page(() => import('./pages/adminPage/foodInventory/index.jsx'));
const InvDecorations  = page(() => import('./pages/adminPage/decorationInventory/index.jsx'));
const InvArtists      = page(() => import('./pages/adminPage/artistsInventory/index.jsx'));
const InvLiveStations = page(() => import('./pages/adminPage/liveStationsInventory/index.jsx'));
const SubDetails      = page(() => import('./pages/subscriptionDetails/index.jsx'));
const SubActive       = page(() => import('./pages/activeSubscription/index.jsx'));

function Loading() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', padding: '96px 20px', fontSize: 14, color: '#6b6b76' }}>
      Loading…
    </div>
  );
}

/** Applies CaterKart's type and ground without touching the app's <body>. */
function Scope({ children }: { children: ReactNode }) {
  return (
    <div className="ck-scope">
      <Suspense fallback={<Loading />}>{children}</Suspense>
    </div>
  );
}

/**
 * Layout route for the ops console. Supplies the admin auth context that
 * RequireAdmin and FullAdminOnly read, then defers to RequireAdmin's own
 * OTP gate — which renders the login form until a registered admin phone
 * has been verified.
 */
function AdminShell() {
  return (
    <AdminAuthProvider>
      <div className="ck-scope">
        <Suspense fallback={<Loading />}>
          <RequireAdmin />
        </Suspense>
      </div>
    </AdminAuthProvider>
  );
}

export const caterkartRoutes = (
  <>
    {/* ── Customer flow ── */}
    {/* Swiggy-styled, so no .ck-scope typography wrapper. */}
    <Route path="/caterbox" element={<Suspense fallback={<Loading />}><Configure /></Suspense>} />
    <Route path="/create-menu" element={<Scope><CreateMenu /></Scope>} />
    <Route path="/checkout" element={<Scope><Checkout /></Scope>} />
    <Route path="/track-order" element={<Scope><TrackOrder /></Scope>} />
    <Route path="/caterbox-subscription" element={<Scope><CreateSub /></Scope>} />

    {/* ── Content & legal (linked from the CaterKart footer) ── */}
    <Route path="/about" element={<Scope><About /></Scope>} />
    <Route path="/our-kitchen" element={<Scope><Kitchen /></Scope>} />
    <Route path="/vendor/login" element={<Scope><VendorLogin /></Scope>} />
    <Route path="/contact" element={<Scope><Contact /></Scope>} />
    <Route path="/privacy-policy" element={<Scope><Legal doc="privacy" /></Scope>} />
    <Route path="/terms" element={<Scope><Legal doc="terms" /></Scope>} />
    <Route path="/refund-policy" element={<Scope><Legal doc="refund" /></Scope>} />
    {/* Required for an Indian merchant account (Razorpay) and by the Consumer
        Protection (E-Commerce) Rules, 2020. */}
    <Route path="/shipping-policy" element={<Scope><Legal doc="shipping" /></Scope>} />
    <Route path="/cookie-policy" element={<Scope><Legal doc="cookies" /></Scope>} />
    <Route path="/grievance-redressal" element={<Scope><Legal doc="grievance" /></Scope>} />

    {/* ── Ops console. Nesting mirrors the original: RequireAdmin gates
         everything, FullAdminOnly narrows the inner set so vendor-admins
         are bounced back to the dashboard. ── */}
    <Route element={<AdminShell />}>
      <Route path="/admin" element={<Suspense fallback={<Loading />}><AdminHome /></Suspense>} />
      <Route path="/admin/orders" element={<Suspense fallback={<Loading />}><AdminOrders /></Suspense>} />
      <Route path="/admin/orders/:orderId" element={<Suspense fallback={<Loading />}><AdminOrder /></Suspense>} />
      <Route path="/admin/combos" element={<Suspense fallback={<Loading />}><AdminCombos /></Suspense>} />
      <Route path="/admin/inventory/food" element={<Suspense fallback={<Loading />}><InvFood /></Suspense>} />

      <Route element={<Suspense fallback={<Loading />}><FullAdminOnly /></Suspense>}>
        <Route path="/admin/vendors" element={<Suspense fallback={<Loading />}><AdminVendors /></Suspense>} />
        <Route path="/admin/pincodes" element={<Suspense fallback={<Loading />}><AdminPincodes /></Suspense>} />
        <Route path="/admin/settings" element={<Suspense fallback={<Loading />}><AdminSettings /></Suspense>} />
        <Route path="/admin/inventory/decorations" element={<Suspense fallback={<Loading />}><InvDecorations /></Suspense>} />
        <Route path="/admin/inventory/artists" element={<Suspense fallback={<Loading />}><InvArtists /></Suspense>} />
        <Route path="/admin/inventory/livestations" element={<Suspense fallback={<Loading />}><InvLiveStations /></Suspense>} />
        <Route path="/admin/subscriptions/:id" element={<Suspense fallback={<Loading />}><SubDetails /></Suspense>} />
        <Route path="/admin/subscriptions/:id/active" element={<Suspense fallback={<Loading />}><SubActive /></Suspense>} />
      </Route>
    </Route>
  </>
);
