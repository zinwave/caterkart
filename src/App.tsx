import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import Create from './pages/Create';
import GroupCart from './pages/GroupCart';
import Addons from './pages/Addons';
import Confirm from './pages/Confirm';
import InviteGuest from './pages/InviteGuest';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import { CelebrationProvider } from './state/CelebrationContext';
import { OrdersProvider } from './state/OrdersContext';

function ChromeShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  // Hide host header on the invitee link route — invitees see a guest-skinned UI
  const hideHeader = loc.pathname.startsWith('/invite/');
  return (
    <>
      {!hideHeader && <Header />}
      <main>{children}</main>
    </>
  );
}

export default function App() {
  return (
    <OrdersProvider>
      <CelebrationProvider>
        <ScrollToTop />
        <ChromeShell>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create" element={<Create />} />
            <Route path="/group" element={<GroupCart />} />
            <Route path="/addons" element={<Addons />} />
            <Route path="/confirm" element={<Confirm />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/invite/:token" element={<InviteGuest />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ChromeShell>
      </CelebrationProvider>
    </OrdersProvider>
  );
}
