import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useWorkAuth } from '../state/WorkAuthContext';
import { useCorporate } from '../state/CorporateContext';
import { LogoMark, IconArrowRight, IconMail, IconShield, IconStore, SwiggyMark } from '../components/icons/Icons';

// =====================================================
// CaterKart for Work — sign in (work email + OTP) or create an organization
// (becomes the admin). Navy-forward corporate chrome. OTP is always 1234.
// =====================================================
type Mode = 'signin' | 'create';
type Stage = 'input' | 'otp';

const DEMO = [
  { email: 'divya@aurelialabs.com', role: 'Admin · Aurelia Labs' },
  { email: 'arjun@aurelialabs.com', role: 'Lead · Aurelia Labs' },
  { email: 'karan@northwind.co', role: 'Admin · Northwind' },
];

export default function WorkLogin() {
  const nav = useNavigate();
  const loc = useLocation();
  const { signIn, createOrg } = useWorkAuth();
  const { signInByEmail } = useCorporate();
  const from = (loc.state as { from?: string } | null)?.from || '/work';

  const [mode, setMode] = useState<Mode>('signin');
  const [stage, setStage] = useState<Stage>('input');
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const emailValid = /\S+@\S+\.\S+/.test(email);
  const canStartCreate = orgName.trim() && adminName.trim() && emailValid;

  const switchMode = (m: Mode) => { setMode(m); setStage('input'); setErr(null); setOtp(''); };

  const toOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setStage('otp');
  };

  const finish = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email, otp);
        // Sync the operational console persona (works for orgs the backend knows).
        await signInByEmail(email).catch(() => null);
      } else {
        await createOrg({ orgName, adminName, adminEmail: email }, otp);
      }
      nav(from, { replace: true });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen grid place-items-center px-5 py-10"
      style={{
        background:
          'radial-gradient(60rem 40rem at 50% -12%, rgba(10,37,64,0.10), transparent 62%),' +
          'linear-gradient(180deg, #F3F7FB 0%, #FAFBFD 40%, #F6F9FC 100%)',
      }}
    >
      <div className="w-full max-w-md">
        {/* Brand */}
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-7">
          <LogoMark size={34} />
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[17px] tracking-tight text-ink-primary">Cater<span className="text-swiggy-orange">Kart</span></span>
              <span className="w-px h-3.5 bg-line-default" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-tertiary">for Work</span>
            </div>
            <div className="powered-by mt-0.5">
              powered by <SwiggyMark size={14} className="align-middle" />
            </div>
          </div>
        </Link>

        <div className="bg-white rounded-2xl shadow-floating border border-line-subtle overflow-hidden">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 p-1.5 gap-1 bg-surface-secondary border-b border-line-subtle">
            {(['signin', 'create'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`py-2.5 rounded-xl text-[13px] font-bold tracking-tight transition-colors ${mode === m ? 'bg-ink-primary text-white shadow-pop' : 'text-ink-secondary hover:text-ink-primary'}`}
              >
                {m === 'signin' ? 'Sign in' : 'Create organization'}
              </button>
            ))}
          </div>

          <div className="p-7">
            {stage === 'input' && mode === 'signin' && (
              <form onSubmit={toOtp} className="space-y-4">
                <Header
                  icon={<IconMail size={22} />}
                  title="Sign in with work email"
                  sub="Use the email your admin added to your organization."
                />
                <Field label="Work email">
                  <input
                    autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com" className={inputCls}
                  />
                </Field>
                <button type="submit" disabled={!emailValid} className="wbtn-dark w-full">
                  Continue <IconArrowRight size={18} />
                </button>
              </form>
            )}

            {stage === 'input' && mode === 'create' && (
              <form onSubmit={toOtp} className="space-y-4">
                <Header
                  icon={<IconStore size={22} />}
                  title="Create your organization"
                  sub="You'll be the admin — set budgets, add members, and get one invoice."
                />
                <Field label="Organization name">
                  <input autoFocus value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Inc." className={inputCls} />
                </Field>
                <Field label="Your name">
                  <input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="e.g. Divya Menon" className={inputCls} />
                </Field>
                <Field label="Your work email">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@acme.com" className={inputCls} />
                  <span className="text-[11px] text-ink-tertiary mt-1 block">Members will sign in with emails on this domain.</span>
                </Field>
                <button type="submit" disabled={!canStartCreate} className="wbtn-dark w-full">
                  Continue <IconArrowRight size={18} />
                </button>
              </form>
            )}

            {stage === 'otp' && (
              <form onSubmit={(e) => { e.preventDefault(); if (otp.length >= 4) finish(); }} className="space-y-4">
                <Header
                  icon={<IconShield size={22} />}
                  title="Verify it's you"
                  sub={`We sent a 4-digit code to ${email}`}
                />
                <Field label="Enter code">
                  <input
                    autoFocus inputMode="numeric" maxLength={4} value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="1234"
                    className="w-full text-center tracking-[0.5em] text-lg font-bold px-3 py-3 rounded-xl border border-line-default bg-white outline-none focus:ring-2 focus:ring-blue-100 focus:border-ink-primary transition"
                  />
                </Field>
                <button type="submit" disabled={otp.length < 4 || busy} className="wbtn-dark w-full">
                  {busy ? 'Verifying…' : mode === 'create' ? 'Create organization' : 'Sign in'}
                </button>
                <button type="button" onClick={() => { setStage('input'); setOtp(''); setErr(null); }} className="wbtn-ghost w-full text-[13px]">
                  Back
                </button>
              </form>
            )}

            {err && <p className="mt-3 text-[12px] text-swiggy-red font-semibold text-center">{err}</p>}
          </div>

          {/* Demo helper */}
          <div className="px-7 py-4 bg-surface-secondary border-t border-line-subtle">
            <div className="text-[10px] uppercase tracking-[0.14em] font-black text-ink-tertiary mb-2">Demo accounts · code 1234</div>
            <div className="flex flex-wrap gap-1.5">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  onClick={() => { switchMode('signin'); setEmail(d.email); }}
                  title={d.role}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white border border-line-subtle text-ink-secondary hover:border-ink-primary hover:text-ink-primary transition"
                >
                  {d.email}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-[12px] text-ink-tertiary mt-5">
          Ordering with friends instead?{' '}
          <Link to="/create" className="font-bold text-swiggy-orange hover:underline">Go to Personal →</Link>
        </p>
      </div>
    </div>
  );
}

const inputCls =
  'w-full px-3.5 py-3 text-sm rounded-xl border border-line-default bg-white outline-none focus:ring-2 focus:ring-blue-100 focus:border-ink-primary transition';

function Header({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="text-center mb-2">
      <div className="w-12 h-12 rounded-2xl bg-ink-primary grid place-items-center text-white mx-auto mb-3 shadow-pop">{icon}</div>
      <h1 className="text-xl font-black tracking-tight text-ink-primary">{title}</h1>
      <p className="text-[13px] text-ink-secondary mt-1">{sub}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.12em] font-bold text-ink-tertiary">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
