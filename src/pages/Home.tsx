import { Link } from 'react-router-dom';
import { useCelebration } from '../state/CelebrationContext';
import Footer from '../components/Footer';

export default function Home() {
  const { occasions } = useCelebration();
  return (
    <div>
      {/* HERO — Swiggy MCP-styled (navy → orange → peach gradient) */}
      <section className="relative overflow-hidden bg-mcp-hero bg-[length:200%_200%] animate-gradient-shift text-white">
        {/* radial glows */}
        <div className="absolute -top-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-cater-peach/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-swiggy-orange/40 blur-3xl pointer-events-none" />

        {/* Floating emoji bubbles */}
        <div className="absolute inset-0 pointer-events-none">
          <FloatEmoji emoji="🍕" className="top-6 left-[10%]" delay="0s" />
          <FloatEmoji emoji="🥤" className="top-12 right-[15%]" delay="1.2s" />
          <FloatEmoji emoji="🧊" className="bottom-10 left-[20%]" delay="0.6s" />
          <FloatEmoji emoji="🥢" className="bottom-16 right-[8%]" delay="1.8s" />
          <FloatEmoji emoji="🎂" className="top-1/2 left-[6%]" delay="2.2s" />
          <FloatEmoji emoji="🧇" className="top-1/3 right-[28%]" delay="0.9s" />
        </div>

        <div className="relative max-w-3xl mx-auto px-5 py-14 sm:py-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur border border-white/25 mb-5 reveal">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-soft" />
            <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-white">
              Now open · Built on Swiggy MCP
            </span>
          </div>

          <h1 className="font-display text-[44px] sm:text-[60px] font-black leading-[1.02] tracking-[-0.02em] reveal" style={{ animationDelay: '50ms' }}>
            Cook on Swiggy.<br className="hidden sm:block" />
            <span className="relative inline-block">
              <span className="relative z-10">Eat together.</span>
              <svg className="absolute -bottom-2 left-0 w-full h-3" viewBox="0 0 200 12" preserveAspectRatio="none">
                <path d="M2 8 Q 50 1 100 6 T 198 5" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </h1>

          <p className="mt-6 text-white/95 max-w-xl leading-relaxed text-[16px] reveal" style={{ animationDelay: '120ms' }}>
            An AI-orchestrated group-ordering layer for Swiggy Food and Instamart.
            One cart across multiple restaurants. Synced delivery. One bill, UPI split.
            And a pre-drop of <b>ice, drinks, plates</b> that lands ~15 minutes <i>before</i> the food.
          </p>

          <div className="mt-8 flex gap-3 flex-wrap reveal" style={{ animationDelay: '200ms' }}>
            <Link
              to="/create"
              className="group inline-flex items-center gap-2 bg-white text-swiggy-orange font-bold px-6 py-3.5 rounded-xl shadow-floating hover:shadow-glow active:scale-[0.97] transition-all"
            >
              Get Started
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <Link
              to="/group"
              className="inline-flex items-center gap-2 bg-white/10 backdrop-blur text-white font-semibold px-5 py-3.5 rounded-xl border border-white/25 hover:bg-white/20 active:scale-[0.97] transition-all"
            >
              See What's Possible
            </Link>
          </div>

          {/* Build pillars — MCP-style stat row */}
          <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-5 reveal" style={{ animationDelay: '320ms' }}>
            <Pillar value="2" label="MCP servers used" sub="Food · Instamart" />
            <Pillar value="6+" label="Tools in flight" sub="search, cart, order" />
            <Pillar value="15min" label="Pre-drop window" sub="before the food" />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — MCP-style numbered cards */}
      <section className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <div className="section-title">How it works</div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-ink-primary">
              Six clicks. One coordinated dinner.
            </h2>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="card card-hover p-5 reveal cursor-default relative"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="font-mono text-[11px] font-bold text-ink-tertiary tracking-tight">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-50 to-rose-50 grid place-items-center text-2xl mt-2">
                {f.emoji}
              </div>
              <div className="font-bold text-[15px] mt-3 text-ink-primary">{f.title}</div>
              <div className="text-xs text-ink-secondary mt-1 leading-relaxed">{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* OCCASIONS */}
      <section className="max-w-3xl mx-auto px-4 pb-14">
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <div className="section-title">Pick an occasion</div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-ink-primary">
              What will you cook?
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {occasions.map((o, i) => (
            <Link
              key={o.id}
              to={`/create?occasion=${o.id}`}
              className="group relative card card-hover p-4 reveal overflow-hidden"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {/* hover gradient sweep */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-transparent to-rose-50 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="text-3xl group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300">
                  {o.emoji}
                </div>
                <div className="font-semibold mt-2">{o.name}</div>
                <div className="text-xs text-neutral-500 mt-0.5">{o.blurb}</div>
                <div className="absolute top-0 right-0 text-swiggy-orange opacity-0 group-hover:opacity-100 transition-opacity">→</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}

const features = [
  { emoji: '🍱', title: 'Multi-restaurant cart', body: 'Each friend picks from any restaurant. Cart shows who chose what.' },
  { emoji: '⏱️', title: 'Synced delivery', body: 'Orders staggered so all food converges within ~5 min of each other.' },
  { emoji: '🛒', title: 'Instamart pre-drop', body: 'Smart sides arrive 15 min before the food. Set the table in time.' },
  { emoji: '💸', title: 'One bill, easy split', body: 'Equal split or pay-for-what-you-ordered. UPI links auto-sent.' },
  { emoji: '🎯', title: 'Cuisine-aware sides', body: 'Biryani → raita & papad. Pizza → Coke & dip. We figure it out.' },
  { emoji: '🪄', title: 'Pantry-aware', body: 'We learn what you reorder. Out of milk? We\'ll quietly remind you.' },
];

function FloatEmoji({ emoji, className, delay }: { emoji: string; className: string; delay: string }) {
  return (
    <div
      className={`absolute text-3xl sm:text-4xl opacity-70 animate-float-slow ${className}`}
      style={{ animationDelay: delay }}
    >
      {emoji}
    </div>
  );
}

function Pillar({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div className="rounded-xl bg-white/10 backdrop-blur border border-white/15 p-3 sm:p-4">
      <div className="font-display font-black text-2xl sm:text-3xl tracking-tight leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-white/80 mt-1.5 leading-tight">{label}</div>
      <div className="text-[11px] text-white/60 mt-0.5">{sub}</div>
    </div>
  );
}
