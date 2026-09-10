import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { usePersonalAuth } from '../state/PersonalAuthContext';
import { LogoMark, IconArrowRight, IconCheck, IconLock, SwiggyMark } from '../components/icons/Icons';

// =====================================================
// Personal sign-in — one button, straight to Swiggy.
//
// No phone + OTP of our own: Swiggy runs exactly that flow, and the app cannot
// fetch a menu or place an order without their grant. A second login would ask
// for a phone number we can neither verify nor use.
//
// Owns its own minimal chrome (no app header).
// =====================================================

export default function PersonalLogin() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user, loading, signIn, error } = usePersonalAuth();
  const from = (loc.state as { from?: string } | null)?.from || '/create';

  const [busy, setBusy] = useState(false);

  // Already signed in — either a live session on load, or the bounce back from
  // the OAuth callback, which lands here before the router settles.
  useEffect(() => {
    if (!loading && user) nav(from, { replace: true });
  }, [loading, user, from, nav]);

  const start = async () => {
    setBusy(true);
    try {
      // Sends the browser to Swiggy; this page unmounts. `busy` stays true so
      // the button cannot be double-clicked during the redirect.
      await signIn(`${window.location.origin}${from}`);
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-5 py-10">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-8">
          <LogoMark size={34} />
          <div className="leading-tight">
            <div className="font-bold text-[17px] tracking-tight text-ink-primary">
              Cater<span className="text-swiggy-orange">Kart</span>
            </div>
            <div className="powered-by mt-0.5">
              powered by <SwiggyMark size={14} className="align-middle" />
            </div>
          </div>
        </Link>

        <div className="card p-7">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-swiggy-orange to-cater-coral grid place-items-center text-white mx-auto mb-3 shadow-pop">
              <SwiggyMark size={22} />
            </div>
            <h1 className="text-xl font-black tracking-tight text-ink-primary">
              Sign in to CaterKart
            </h1>
            <p className="text-[13px] text-ink-secondary mt-1">
              Group ordering for you and your friends, on your own Swiggy account.
            </p>
          </div>

          <button
            onClick={start}
            disabled={busy || loading}
            className="btn-primary w-full"
          >
            {busy ? 'Taking you to Swiggy…' : <>Continue with Swiggy <IconArrowRight size={18} /></>}
          </button>

          {error && (
            <p className="mt-3 text-[13px] text-red-600 text-center">{error}</p>
          )}

          <ul className="mt-6 space-y-2.5">
            {[
              'Order from your own Swiggy account — real restaurants, real delivery.',
              'Friends pick their dishes from a link. No app, no account for them.',
              'Everything lands together, and the bill splits itself.',
            ].map((line) => (
              <li key={line} className="flex gap-2.5 text-[13px] text-ink-secondary">
                <IconCheck size={16} className="text-swiggy-orange shrink-0 mt-0.5" />
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <p className="mt-6 flex items-start gap-2 text-[11.5px] leading-relaxed text-ink-tertiary">
            <IconLock size={13} className="shrink-0 mt-0.5" />
            <span>
              Swiggy signs you in. CaterKart never sees your password, and your
              access token stays encrypted on our server — never in your browser.
            </span>
          </p>
        </div>

        <p className="text-center text-[12px] text-ink-tertiary mt-5">
          Ordering for a team?{' '}
          <Link to="/work/login" className="font-semibold text-swiggy-orange">
            CaterKart for Work
          </Link>
        </p>
      </div>
    </div>
  );
}
