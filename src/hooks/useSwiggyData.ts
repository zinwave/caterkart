import { useCallback, useEffect, useRef, useState } from 'react';
import { api, friendlyError } from '../lib/api';
import { useSwiggy } from '../state/SwiggyContext';
import type { Dish, Menu, OrderSummary, Product, Restaurant } from '../lib/mcp/types';

type Async<T> = { data: T; loading: boolean; error: string | null; reload: () => void };

// Never show raw Swiggy/MCP text — always a friendly line (real error is logged).
const msg = (e: unknown) => friendlyError(e);

/**
 * Live restaurants for the selected address.
 *
 * An empty search box sends an empty query, which the backend turns into a
 * BROWSE list (it fans out over several cuisines and merges). Do not substitute
 * a word like "popular" here — Swiggy text-matches it and returns cinema snack
 * counters.
 */
export function useRestaurants(query: string, debounceMs = 350): Async<Restaurant[]> {
  const { addressId } = useSwiggy();
  const [data, setData] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    if (!addressId) return;
    const mine = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      api.swiggy
        .restaurants(addressId, query.trim(), true)
        .then((r) => {
          if (seq.current !== mine) return; // a newer query won
          setData(r);
          setError(null);
        })
        .catch((e) => seq.current === mine && setError(msg(e)))
        .finally(() => seq.current === mine && setLoading(false));
    }, debounceMs);
    return () => clearTimeout(t);
  }, [addressId, query, debounceMs, nonce]);

  return { data, loading, error, reload: () => setNonce((n) => n + 1) };
}

/** A restaurant's full menu. Lazily fetched — Swiggy has no bulk-menu call. */
export function useMenu(restaurantId: string | null): Async<Menu | null> {
  const { addressId } = useSwiggy();
  const [data, setData] = useState<Menu | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!restaurantId || !addressId) {
      setData(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setData(null);
    api.swiggy
      .menu(restaurantId, addressId)
      .then((m) => {
        if (!alive) return;
        setData(m);
        setError(null);
      })
      .catch((e) => alive && setError(msg(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [restaurantId, addressId, nonce]);

  return { data, loading, error, reload: () => setNonce((n) => n + 1) };
}

/** Dish-level search across Swiggy (optionally scoped to one restaurant). */
export function useDishSearch(query: string, restaurantId?: string): Async<Dish[]> {
  const { addressId } = useSwiggy();
  const [data, setData] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!addressId || !query.trim()) {
      setData([]);
      return;
    }
    const mine = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      api.swiggy
        .dishes(addressId, query.trim(), restaurantId)
        .then((d) => {
          if (seq.current !== mine) return;
          setData(d);
          setError(null);
        })
        .catch((e) => seq.current === mine && setError(msg(e)))
        .finally(() => seq.current === mine && setLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [addressId, query, restaurantId]);

  return { data, loading, error, reload: () => undefined };
}

/**
 * Occasion "essentials": a curated set of Instamart search terms (e.g. a house
 * party's chips / drinks / ice / plates), each run through live Instamart search
 * and merged into one de-duplicated list. Real prices, real stock — nothing is
 * mocked. Empty `terms` yields an empty list (callers fall back to reorders).
 */
export function useOccasionEssentials(terms: string[]): Async<Product[]> {
  const { addressId } = useSwiggy();
  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  // Join to a stable key so a fresh array literal each render doesn't refetch.
  const key = terms.join('|');

  useEffect(() => {
    if (!addressId || terms.length === 0) {
      setData([]);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    // One search per term; take the top couple of hits from each. A single
    // failing term shouldn't blank the whole shelf, so swallow per-term errors.
    Promise.all(
      terms.map((t) =>
        api.swiggy
          .searchProducts(addressId, t)
          .then((r) => r.slice(0, 2))
          .catch(() => [] as Product[]),
      ),
    )
      .then((groups) => {
        if (!alive) return;
        const seen = new Set<string>();
        const merged: Product[] = [];
        for (const g of groups)
          for (const p of g)
            if (!seen.has(p.id)) {
              seen.add(p.id);
              merged.push(p);
            }
        setData(merged);
        // Every term failed → surface it so the UI can offer a retry.
        if (merged.length === 0) setError('Instamart returned nothing for these essentials.');
      })
      .catch((e) => alive && setError(msg(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressId, key, nonce]);

  return { data, loading, error, reload: () => setNonce((n) => n + 1) };
}

/**
 * Instamart add-ons: the user's usual reorders, or search results when they type.
 */
export function useProducts(query: string): Async<Product[]> {
  const { addressId } = useSwiggy();
  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    if (!addressId) return;
    const mine = ++seq.current;
    setLoading(true);
    const q = query.trim();
    const t = setTimeout(() => {
      const p = q ? api.swiggy.searchProducts(addressId, q) : api.swiggy.goTo(addressId);
      p.then((r) => {
        if (seq.current !== mine) return;
        setData(r);
        setError(null);
      })
        .catch((e) => seq.current === mine && setError(msg(e)))
        .finally(() => seq.current === mine && setLoading(false));
    }, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [addressId, query, nonce]);

  return { data, loading, error, reload: () => setNonce((n) => n + 1) };
}

/** The user's real Swiggy order history for this address. */
export function useOrders(activeOnly = false): Async<OrderSummary[]> {
  const { addressId } = useSwiggy();
  const [data, setData] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const load = useCallback(() => {
    if (!addressId) return;
    setLoading(true);
    api.swiggy
      .orders(addressId, activeOnly)
      .then((o) => {
        setData(o);
        setError(null);
      })
      .catch((e) => setError(msg(e)))
      .finally(() => setLoading(false));
  }, [addressId, activeOnly]);

  useEffect(load, [load, nonce]);

  return { data, loading, error, reload: () => setNonce((n) => n + 1) };
}
