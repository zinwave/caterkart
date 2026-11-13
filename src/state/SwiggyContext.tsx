import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { api, ApiError } from '../lib/api';
import type { Address, CreateAddressInput } from '../lib/mcp/types';

/**
 * Owns the Swiggy connection and the selected delivery address.
 *
 * Why an address is load-bearing: Swiggy REQUIRES `addressId` on nearly every
 * tool (search, menu, cart, place, orders) — it derives the delivery
 * coordinates from it. So nothing in the app can fetch food until an address is
 * chosen. Everything downstream reads `addressId` from here.
 *
 * The access token lives ~5 days but the server now holds a refresh token and
 * renews it silently, so `connected` stays true across an expiry. A 401 that
 * still reaches here means the refresh itself failed — genuinely "reconnect",
 * not "retry".
 */

const ADDRESS_KEY = 'caterkart_address_id';

type Ctx = {
  /** null = still checking */
  connected: boolean | null;
  expiresAt?: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;

  addresses: Address[];
  addressId: string | null;
  address: Address | null;
  setAddressId: (id: string) => void;
  /** Saves a real address on the Swiggy account, then selects it. */
  createAddress: (input: CreateAddressInput) => Promise<void>;

  loadingAddresses: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const C = createContext<Ctx | null>(null);

export function SwiggyProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | undefined>();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressIdState] = useState<string | null>(
    () => localStorage.getItem(ADDRESS_KEY),
  );
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mirrors `addresses` so createAddress can diff against the pre-create list
  // without taking it as a dependency and re-identifying on every refresh.
  const addressesRef = useRef<Address[]>([]);
  useEffect(() => {
    addressesRef.current = addresses;
  }, [addresses]);

  const setAddressId = useCallback((id: string) => {
    setAddressIdState(id);
    localStorage.setItem(ADDRESS_KEY, id);
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      // `status` is a cheap DB read — it is the ONLY thing that decides whether
      // we are connected.
      const s = await api.swiggy.status();
      setConnected(s.connected);
      setExpiresAt(s.expiresAt);
      if (!s.connected) {
        setAddresses([]);
        return;
      }
    } catch (err) {
      // Couldn't even reach our API. That is not "you're logged out".
      setConnected((c) => (c === null ? false : c));
      setError(err instanceof Error ? err.message : 'Could not reach the CaterKart API');
      return;
    }

    // Addresses come from Swiggy, so this call CAN fail transiently
    // ("Error POSTing to endpoint"). A blip here must NOT bounce the user back
    // to the Connect screen — they are still connected; the fetch just failed.
    try {
      setLoadingAddresses(true);
      const list = await api.swiggy.addresses();
      setAddresses(list);
      // Default to the first address so the app is usable immediately, but keep
      // a previously chosen one if it still exists on the account.
      setAddressIdState((cur) => {
        const keep = cur && list.some((a) => a.id === cur) ? cur : (list[0]?.id ?? null);
        if (keep) localStorage.setItem(ADDRESS_KEY, keep);
        return keep;
      });
    } catch (err) {
      if (err instanceof ApiError && err.needsSwiggyAuth) {
        setConnected(false); // genuinely expired — reconnect is the right answer
        setAddresses([]);
      } else {
        setError(
          err instanceof Error && /POSTing|fetch|network/i.test(err.message)
            ? 'Swiggy did not respond just then. Retry in a moment.'
            : 'Could not load your Swiggy addresses.',
        );
      }
    } finally {
      setLoadingAddresses(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The OAuth callback bounces back with ?swiggy=connected — pick that up.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('swiggy') === 'connected') {
      window.history.replaceState({}, '', window.location.pathname);
      void refresh();
    } else if (p.get('swiggy') === 'error') {
      setError(p.get('reason') || 'Swiggy connection failed');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [refresh]);

  const connect = useCallback(async () => {
    const { authorizeUrl } = await api.swiggy.begin(window.location.href);
    // Full redirect (not a popup): Swiggy's login page sets its own cookies and
    // will bounce back to our backend callback, which redirects here.
    window.location.href = authorizeUrl;
  }, []);

  const disconnect = useCallback(async () => {
    await api.swiggy.disconnect();
    setConnected(false);
    setAddresses([]);
  }, []);

  /**
   * Save a new address on the user's Swiggy account and select it.
   *
   * Selecting it is the point: the only caller that matters is a brand-new
   * account with an empty list, and leaving `addressId` null would drop them
   * straight back into the gate they just cleared. The server returns the
   * refreshed list, so there is no second round-trip.
   */
  const createAddress = useCallback(async (input: CreateAddressInput) => {
    const list = await api.swiggy.createAddress(input);
    setAddresses(list);
    setError(null);
    // Swiggy assigns the id, and the response is not ordered by recency, so the
    // new address is identified by elimination against what we already had.
    setAddressIdState((cur) => {
      const known = new Set(addressesRef.current.map((a) => a.id));
      const created = list.find((a) => !known.has(a.id));
      const next = created?.id ?? (cur && list.some((a) => a.id === cur) ? cur : (list[0]?.id ?? null));
      if (next) localStorage.setItem(ADDRESS_KEY, next);
      return next;
    });
  }, []);

  const address = useMemo(
    () => addresses.find((a) => a.id === addressId) ?? null,
    [addresses, addressId],
  );

  const value: Ctx = {
    connected,
    expiresAt,
    connect,
    disconnect,
    addresses,
    addressId,
    address,
    setAddressId,
    createAddress,
    loadingAddresses,
    error,
    refresh,
  };

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useSwiggy() {
  const v = useContext(C);
  if (!v) throw new Error('useSwiggy must be used inside SwiggyProvider');
  return v;
}
