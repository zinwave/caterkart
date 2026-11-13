import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { usePersonalAuth } from '../state/PersonalAuthContext';
import { SHOW_WORK } from '../config/features';
import {
  IconArrowRight, IconCheck, IconLock, IconUsers, IconClock, SwiggyMark,
} from '../components/icons/Icons';

// =====================================================
// Personal sign-in — one button, straight to Swiggy.
//
// No phone + OTP of our own: Swiggy runs exactly that flow, and the app cannot
// fetch a menu or place an order without their grant. A second login would ask
// for a phone number we can neither verify nor use. So the page has one job —
// explain why Swiggy is the way in, and get out of the way.
//
// Owns its own chrome; the app header is not rendered here.
// =====================================================

const REASONS = [
  {
    icon: <IconUsers size={16} />,
    title: 'Friends order from a link',
    body: 'They pick their own dishes. No app, no account, nothing to install.',
  },
  {
    icon: <IconClock size={16} />,
    title: 'Everything arrives together',
    body: 'We stagger each restaurant so the whole table lands at one moment.',
  },
  {
    icon: <IconCheck size={16} />,
    title: 'The bill splits itself',
    body: 'Evenly or by what each person ate, settled over UPI afterwards.',
  },
];

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
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 grid place-items-center px-5 py-10">
        <div className="w-full max-w-[420px]">
          <div className="text-center mb-7">
            <h1 className="font-display font-black text-[28px] leading-tight tracking-[-0.03em] text-ink-primary">
              Sign in to order together
            </h1>
            <p className="mt-2.5 text-[15px] leading-relaxed text-ink-secondary">
              CaterKart orders on <span className="font-semibold text-ink-primary">your own
              Swiggy account</span>, so it&rsquo;s your addresses, your payments and your order
              history — we just coordinate the group.
            </p>
          </div>

          <div className="card p-6 sm:p-7">
            {/* The identity button: white surface, real mark, their wording —
                the shape people already recognise from every OAuth screen. */}
            <button
              onClick={start}
              disabled={busy || loading}
              className="w-full flex items-center justify-center gap-3 rounded-xl border-[1.5px] border-line-default bg-white px-5 py-4 text-[15.5px] font-bold text-ink-primary transition hover:border-swiggy-orange hover:shadow-pop active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy || loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-line-default border-t-swiggy-orange" />
                  Taking you to Swiggy…
                </>
              ) : (
                <>
                  <SwiggyMark size={20} alt="" />
                  Continue with Swiggy
                  <IconArrowRight size={17} className="text-ink-tertiary" />
                </>
              )}
            </button>

            {error && (
              <div
                role="alert"
                className="mt-3.5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[13px] font-medium text-swiggy-red"
              >
                {error}
              </div>
            )}

            <p className="mt-4 text-center text-[12px] text-ink-tertiary">
              New to CaterKart? The same button signs you up — there&rsquo;s no
              separate account to create.
            </p>

            <div className="my-6 h-px bg-line-subtle" />

            <ul className="flex flex-col gap-4">
              {REASONS.map((r) => (
                <li key={r.title} className="flex gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-orange-50 text-swiggy-orange">
                    {r.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-bold text-ink-primary">{r.title}</span>
                    <span className="block text-[13px] leading-relaxed text-ink-secondary">{r.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-5 flex items-start gap-2 px-1 text-[11.5px] leading-relaxed text-ink-tertiary">
            <IconLock size={13} className="mt-0.5 shrink-0" />
            <span>
              Swiggy signs you in — CaterKart never sees your password. Your access
              token is encrypted on our server and never reaches your browser.
            </span>
          </p>

          {SHOW_WORK && (
            <p className="mt-5 text-center text-[12.5px] text-ink-tertiary">
              Ordering for a team?{' '}
              <Link to="/work/login" className="font-semibold text-swiggy-orange hover:underline">
                CaterKart for Work
              </Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
