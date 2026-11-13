import { ReactNode } from 'react';
import { useSwiggy } from '../state/SwiggyContext';
import AddressPicker from './AddressPicker';
import AddAddressForm from './AddAddressForm';
import { IconBolt, IconMapPin } from './icons/Icons';

/**
 * Blocks the food flow until we have (a) a Swiggy grant and (b) a delivery
 * address. Both are hard requirements of the Swiggy MCP, not UX preferences:
 * every tool call needs a bearer token, and nearly every one needs an addressId.
 *
 * The zero-address case is real, not defensive: Swiggy's login now creates an
 * account for a first-time visitor, and a brand-new account has no saved
 * addresses at all. Before `create_address` existed on the MCP that was a dead
 * end — the only fix was to go install the Swiggy app.
 */
export default function SwiggyGate({ children }: { children: ReactNode }) {
  const { connected, addressId, connect, error, addresses, loadingAddresses, refresh } = useSwiggy();

  // Still checking.
  if (connected === null) {
    return (
      <div className="max-w-md mx-auto px-5 py-20 grid place-items-center">
        <div className="flex items-center gap-2 text-ink-tertiary text-sm font-semibold">
          <span className="w-4 h-4 rounded-full border-2 border-line-default border-t-swiggy-orange animate-spin-slow" />
          Checking your Swiggy connection…
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="max-w-md mx-auto px-5 py-16">
        <div className="card p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 text-swiggy-orange grid place-items-center mx-auto">
            <IconBolt size={26} />
          </div>
          <h2 className="mt-4 text-xl font-black tracking-tight text-ink-primary">
            Continue with Swiggy
          </h2>
          <p className="mt-2 text-sm text-ink-secondary leading-relaxed">
            CaterKart orders through Swiggy on your behalf. Sign in with your phone and OTP — and if
            you don't have a Swiggy account yet, the same step creates one. We never see your
            password, and the session stays on our server, never in this browser.
          </p>
          {error && (
            <p className="mt-3 text-xs font-semibold text-swiggy-red bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button onClick={() => void connect()} className="btn-primary w-full mt-5">
            Continue with Swiggy
          </button>
          <p className="mt-3 text-[11px] text-ink-tertiary">
            We'll keep you signed in — you'll only do this again if you disconnect.
          </p>
        </div>
      </div>
    );
  }

  // Connected, but the address fetch blipped (Swiggy's MCP occasionally answers
  // "Error POSTing to endpoint"). Offer a retry — do NOT pretend they're logged out.
  if (connected && error && addresses.length === 0 && !loadingAddresses) {
    return (
      <div className="max-w-md mx-auto px-5 py-16">
        <div className="card p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 grid place-items-center mx-auto">
            <IconBolt size={26} />
          </div>
          <h2 className="mt-4 text-lg font-black tracking-tight text-ink-primary">
            Swiggy didn’t respond
          </h2>
          <p className="mt-2 text-sm text-ink-secondary leading-relaxed">{error}</p>
          <p className="mt-1 text-[11px] text-ink-tertiary">
            You’re still connected — this was a hiccup on Swiggy’s side.
          </p>
          <button onClick={() => void refresh()} className="btn-primary w-full mt-5">
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Connected with NOTHING saved — the shape of a first-ever sign-in. Without
  // this branch the component falls through to `children` with a null
  // addressId, and every downstream Swiggy call fails on a missing address.
  if (!loadingAddresses && addresses.length === 0) {
    return (
      <div className="max-w-md mx-auto px-5 py-16">
        <div className="card p-6">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 text-swiggy-orange grid place-items-center mx-auto">
            <IconMapPin size={26} />
          </div>
          <h2 className="mt-4 text-xl font-black tracking-tight text-ink-primary text-center">
            Where should we deliver?
          </h2>
          <p className="mt-2 mb-5 text-sm text-ink-secondary leading-relaxed text-center">
            Your Swiggy account doesn't have a saved address yet. Add one here and we'll save it to
            your account — no need to open the Swiggy app.
          </p>
          <AddAddressForm />
        </div>
      </div>
    );
  }

  // Connected with addresses, but none chosen yet — Swiggy can't search without one.
  if (!addressId && !loadingAddresses && addresses.length > 0) {
    return (
      <div className="max-w-md mx-auto px-5 py-16">
        <div className="flex items-center gap-2 mb-3">
          <IconMapPin size={16} className="text-swiggy-orange" />
          <h2 className="font-black tracking-tight text-ink-primary">Where are we delivering?</h2>
        </div>
        <p className="text-sm text-ink-secondary mb-4">
          Pick one of your saved Swiggy addresses — every restaurant, menu and price depends on it.
        </p>
        <AddressPicker />
      </div>
    );
  }

  return <>{children}</>;
}
