import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Scrolls window to top whenever the route path changes.
// Uses 'auto' (instant) for snappy navigation feel; pages typically expect a fresh viewport.
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}
