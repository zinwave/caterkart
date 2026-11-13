import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { api, ApiError , friendlyError } from '../lib/api';

// =====================================================
// Personal auth — Swiggy is the identity provider.
//
// There is no separate phone + OTP step. Swiggy already authenticates the user
// with exactly that, and the app cannot place a single order without their
// grant, so a second login would collect a phone number we can neither verify
// nor use. Completing the OAuth handshake IS signing in: the backend sets an
// httpOnly session cookie on the callback.
//
// Nothing about the session is readable from JS, deliberately — the cookie
// names whose Swiggy grant the backend will spend, so a script on the page must
// not be able to read or forge it.
// =====================================================

export type PersonalUser = {
  id: string;
  name: string;
  /** Masked phone from Swiggy, when they give us one. Display only. */
  phone: string | null;
};

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

type Ctx = {
  /** null = signed out. `loading` distinguishes that from "not checked yet". */
  user: PersonalUser | null;
  loading: boolean;
  /** True once the Swiggy grant is live; false means reconnect. */
  swiggyConnected: boolean;
  error: string | null;
  /** Send the browser to Swiggy. Returns only if the redirect could not start. */
  signIn: (redirectAfter?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const C = createContext<Ctx | null>(null);

export function PersonalAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PersonalUser | null>(null);
  const [swiggyConnected, setSwiggyConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await api.auth.session();
      setUser(s.user);
      setSwiggyConnected(s.swiggy.connected);
      setError(null);
    } catch (err) {
      // 401 is the ordinary signed-out case, not a failure worth showing.
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        setSwiggyConnected(false);
        setError(null);
      } else {
        setError(friendlyError(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async (redirectAfter?: string) => {
    setError(null);
    try {
      const { authorizeUrl } = await api.auth.begin(redirectAfter);
      // A full navigation, not a popup: the callback sets the session cookie,
      // and this is the top-level request that makes the browser store it.
      window.location.assign(authorizeUrl);
    } catch (err) {
      setError(friendlyError(err));
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    await api.auth.logout().catch(() => undefined);
    setUser(null);
    setSwiggyConnected(false);
  }, []);

  const value = useMemo<Ctx>(
    () => ({ user, loading, swiggyConnected, error, signIn, signOut, refresh }),
    [user, loading, swiggyConnected, error, signIn, signOut, refresh],
  );

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function usePersonalAuth() {
  const v = useContext(C);
  if (!v) throw new Error('usePersonalAuth must be used inside PersonalAuthProvider');
  return v;
}
