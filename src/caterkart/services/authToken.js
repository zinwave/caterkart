// Central auth-token store + global axios wiring.
//
// On OTP verify the backend returns a signed JWT; we keep it in localStorage and
// attach it as `Authorization: Bearer <token>` on requests to OUR API via a
// single axios interceptor. Customer endpoints (place an order, track it, pay)
// and staff endpoints both require it; truly public endpoints ignore it.
import axios from 'axios';
import { api_base } from './config';

const TOKEN_KEY = 'ck_token';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable — interceptor just sends no token */ }
};

export const clearToken = () => setToken('');

/**
 * Is this request going to our own API?
 *
 * The interceptor is global, so without this check the token rode along on
 * EVERY axios call the app makes — including any to a third party, which hands
 * that host a credential that can place and read orders. Relative URLs are ours
 * by definition; absolute ones have to match the configured API origin.
 */
const isOwnApi = (url = '') => {
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return true; // relative → same origin as the app
  try {
    return new URL(url).origin === new URL(api_base, window.location.origin).origin;
  } catch {
    return false;
  }
};

/**
 * Install the request interceptor. Idempotent, and called on import below.
 *
 * It used to be exported and never called anywhere, which meant no request ever
 * carried the token: every staff route answered 401 and the ops console could
 * not load. Self-installing removes the step there was to forget.
 */
let installed = false;
export const installAuthInterceptor = () => {
  if (installed) return;
  installed = true;
  axios.interceptors.request.use((config) => {
    const token = getToken();
    if (token && isOwnApi(config.url)) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
};

installAuthInterceptor();
