import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import type { ReactNode } from 'react';
import {
  LogoMark, IconCheck, IconArrowRight, IconGift, IconBriefcase,
  IconUtensils, IconReceipt, IconClock, IconShield, IconBolt,
  SwiggyMark,
} from '../components/icons/Icons';

// =====================================================
// Landing — the front door for CaterKart's two offerings:
// Personal (celebrations) and for Work (corporate team ordering).
// Header is intentionally removed on "/"; this page owns its own
// minimal nav. Elegant, minimal, informative.
// =====================================================
export default function Home() {
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(60rem 40rem at 50% -12%, rgba(255,82,0,0.08), transparent 62%),' +
          'linear-gradient(180deg, #FFF7F2 0%, #FDFDFE 34%, #F6F9FC 100%)',
      }}
    >
      {/* Minimal top nav */}
      <header className="border-b border-line-subtle bg-white/70 sticky-blur">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoMark size={30} />
            <div className="leading-tight">
              <div className="font-bold text-[15px] tracking-tight text-ink-primary">
                Cater<span className="text-swiggy-orange">Kart</span>
              </div>
              <div className="powered-by mt-0.5">
                powered by <SwiggyMark size={14} className="align-middle" />
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1">
            <Link to="/create" className="btn-ghost text-sm">Personal</Link>
            <Link to="/work" className="btn-ghost text-sm">For Work</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section>
        <div className="max-w-3xl mx-auto px-5 pt-16 sm:pt-20 pb-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-line-default shadow-card mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-swiggy-green animate-pulse-soft" />
            <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-ink-secondary">Group ordering, done right</span>
          </div>
          <h1 className="font-display text-[40px] sm:text-[58px] font-black leading-[1.03] tracking-[-0.02em] text-ink-primary">
            Order together.<br />
            <span className="text-navy-orange">At home and at work.</span>
          </h1>
          <p className="mt-6 text-[16px] leading-relaxed text-ink-secondary max-w-xl mx-auto">
            CaterKart coordinates group orders across <b className="text-ink-primary">multiple restaurants</b> on Swiggy —
            timed so everything lands together, settled as <b className="text-ink-primary">one bill</b>. Two ways to use it.
          </p>
          <div className="mt-7 flex items-center justify-center gap-x-5 gap-y-2 flex-wrap text-[12px] font-semibold text-ink-tertiary">
            {['Real restaurants', 'Synced delivery', 'One bill'].map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-swiggy-orange" /> {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* The two offerings */}
      <div className="max-w-5xl mx-auto px-5 text-center">
        <div className="section-title justify-center">Choose your space</div>
        <p className="mt-3 text-sm text-ink-secondary">Two ways to order together — pick the one that fits.</p>
      </div>
      <section className="max-w-5xl mx-auto px-5 pt-6 pb-4 grid md:grid-cols-2 gap-5 sm:gap-6">
        <Offering
          accent="orange"
          icon={<IconGift size={24} />}
          eyebrow="Personal"
          title="Celebrations with friends"
          desc="Birthday, game night, Diwali dinner — everyone picks from any restaurant, the food arrives together, and the bill splits itself."
          bullets={[
            'One cart across many restaurants',
            'Synced delivery + a 15-min Instamart pre-drop',
            'Split the bill with auto-generated UPI links',
          ]}
          cta="Plan a celebration"
          to="/create"
        />
        <Offering
          accent="navy"
          icon={<IconBriefcase size={24} />}
          eyebrow="For Work"
          title="Team lunches, handled"
          desc="A company account with budgets and meal policy. The team picks within a per-head cap, and finance gets one consolidated invoice for painless claims."
          bullets={[
            'Company account · cost-centre budgets',
            'Share a link — everyone picks within cap',
            'One consolidated invoice, ready to claim',
          ]}
          cta="Open the work console"
          to="/work"
        />
      </section>

      {/* What makes it different — the orchestration */}
      <section className="max-w-5xl mx-auto px-5 pt-14 pb-4">
        <div className="text-center mb-10">
          <div className="section-title justify-center">Under the hood</div>
          <h2 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-ink-primary">
            The hard part, made invisible
          </h2>
          <p className="mt-3 text-sm text-ink-secondary max-w-lg mx-auto leading-relaxed">
            Group ordering breaks on real-world constraints. CaterKart's orchestration layer absorbs
            every one of them so it just works.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-50 to-rose-50 grid place-items-center text-swiggy-orange"><f.Icon size={22} /></div>
              <div className="font-bold text-[15px] mt-3 text-ink-primary">{f.title}</div>
              <div className="text-xs text-ink-secondary mt-1 leading-relaxed">{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="max-w-5xl mx-auto px-5 py-14">
        <div className="card p-8 sm:p-10 text-center bg-gradient-to-br from-white to-orange-50/40">
          <h2 className="text-2xl font-black tracking-tight text-ink-primary">Ready when you are</h2>
          <p className="mt-2 text-sm text-ink-secondary">Start a celebration, or set up team lunches for your company.</p>
          <div className="mt-6 flex gap-3 justify-center flex-wrap">
            <Link to="/create" className="btn-primary">
              <IconGift size={18} /> Personal <IconArrowRight size={18} />
            </Link>
            <Link to="/work" className="inline-flex items-center gap-2 bg-ink-primary text-white font-bold px-5 py-3 rounded-xl shadow-pop hover:bg-[#0f3358] active:scale-[0.97] transition">
              <IconBriefcase size={18} /> For Work <IconArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// =====================================================
const FEATURES = [
  { Icon: IconUtensils, title: 'Many restaurants, one order', body: 'Biryani from one place, pizza from another — coordinated as a single event.' },
  { Icon: IconClock, title: 'Synced delivery', body: 'Orders are staggered by ETA so everything lands within minutes of each other.' },
  { Icon: IconReceipt, title: 'One bill', body: 'UPI split links for friends, or a consolidated cost-centre invoice for finance.' },
  { Icon: IconShield, title: '₹1,000 cap, handled', body: "Swiggy's per-order cap is split automatically — you never see the seam." },
  { Icon: IconShield, title: 'Reliable placement', body: 'Failed placements reconcile themselves — no double orders, no lost money.' },
  { Icon: IconBolt, title: 'Built on Swiggy', body: 'Runs on the Swiggy MCP — real restaurants, real delivery, real tracking.' },
];

function Offering({
  accent, icon, eyebrow, title, desc, bullets, cta, to,
}: {
  accent: 'orange' | 'navy';
  icon: ReactNode;
  eyebrow: string;
  title: string;
  desc: string;
  bullets: string[];
  cta: string;
  to: string;
}) {
  const navy = accent === 'navy';
  const A = navy
    ? {
        badge: 'bg-gradient-to-br from-ink-primary to-[#123f6b]',
        pill: 'bg-blue-50 text-ink-primary',
        glow: 'bg-ink-primary/10',
        chip: 'bg-blue-50 text-ink-primary',
        cta: 'bg-ink-primary group-hover:bg-[#0f3358]',
        border: 'hover:border-blue-200',
        text: 'text-ink-primary',
      }
    : {
        badge: 'bg-gradient-to-br from-swiggy-orange to-cater-coral',
        pill: 'bg-orange-50 text-swiggy-orange',
        glow: 'bg-swiggy-orange/10',
        chip: 'bg-orange-50 text-swiggy-orange',
        cta: 'bg-swiggy-orange group-hover:bg-cater-600',
        border: 'hover:border-orange-200',
        text: 'text-swiggy-orange',
      };
  return (
    <Link
      to={to}
      className={`group relative flex flex-col rounded-3xl border border-line-subtle bg-white p-7 sm:p-8 shadow-card overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-floating ${A.border}`}
    >
      {/* accent glow, revealed on hover */}
      <div className={`pointer-events-none absolute -top-20 -right-20 w-52 h-52 rounded-full blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${A.glow}`} />

      {/* Icon + eyebrow */}
      <div className="relative flex items-center justify-between">
        <span className={`w-14 h-14 rounded-2xl grid place-items-center text-white shadow-pop ${A.badge}`}>{icon}</span>
        <span className={`text-[10px] uppercase tracking-[0.18em] font-black px-2.5 py-1 rounded-full ${A.pill}`}>{eyebrow}</span>
      </div>

      <h3 className="relative mt-5 text-[22px] font-black tracking-tight text-ink-primary">{title}</h3>
      <p className="relative mt-2 text-[14px] text-ink-secondary leading-relaxed">{desc}</p>

      <ul className="relative mt-5 space-y-2.5 flex-1">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-[13.5px] font-medium text-ink-primary">
            <span className={`mt-0.5 w-4 h-4 rounded-full grid place-items-center shrink-0 ${A.chip}`}>
              <IconCheck size={11} />
            </span>
            {b}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="relative mt-7 flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 font-bold text-[15px] ${A.text}`}>{cta}</span>
        <span className={`w-10 h-10 rounded-full grid place-items-center text-white shadow-pop transition-transform duration-300 group-hover:translate-x-1 ${A.cta}`}>
          <IconArrowRight size={18} />
        </span>
      </div>
    </Link>
  );
}
