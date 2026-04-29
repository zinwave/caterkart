import { Link } from 'react-router-dom';
import { useCelebration } from '../state/CelebrationContext';
import Footer from '../components/Footer';

export default function Home() {
  const { occasions } = useCelebration();
  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-mesh-warm bg-[length:200%_200%] animate-gradient-shift text-white">
        {/* Floating emoji bubbles */}
        <div className="absolute inset-0 pointer-events-none">
          <FloatEmoji emoji="🍕" className="top-6 left-[10%]" delay="0s" />
          <FloatEmoji emoji="🥤" className="top-12 right-[15%]" delay="1.2s" />
          <FloatEmoji emoji="🧊" className="bottom-10 left-[20%]" delay="0.6s" />
          <FloatEmoji emoji="🥢" className="bottom-16 right-[8%]" delay="1.8s" />
          <FloatEmoji emoji="🎂" className="top-1/2 left-[6%]" delay="2.2s" />
          <FloatEmoji emoji="🧇" className="top-1/3 right-[28%]" delay="0.9s" />
        </div>

        {/* radial glow */}
        <div className="absolute -top-32 -right-24 w-96 h-96 rounded-full bg-white/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-cater-coral/40 blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-5 py-12 sm:py-16">
          <div className="inline-flex items-center gap-2 chip bg-white/15 backdrop-blur text-white border border-white/25 mb-4 reveal">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-soft" />
            <span className="font-semibold tracking-wide">NEW · Group ordering, reimagined</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black leading-[1.05] tracking-tight reveal" style={{ animationDelay: '50ms' }}>
            Plan a meal everyone <br className="hidden sm:block" />
            <span className="inline-block">actually</span>{' '}
            <span className="relative inline-block">
              <span className="relative z-10">wants</span>
              <svg className="absolute -bottom-2 left-0 w-full h-3" viewBox="0 0 200 12" preserveAspectRatio="none">
                <path d="M2 8 Q 50 1 100 6 T 198 5" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
            </span>
            . 🎉
          </h1>

          <p className="mt-5 text-white/95 max-w-lg leading-relaxed text-[15px] reveal" style={{ animationDelay: '120ms' }}>
            Order from <b>multiple restaurants in one cart</b>. Synced delivery, one bill,
            UPI split — and we pre-stock your home with sodas, ice and sides from{' '}
            <b>Instamart</b>, timed to arrive <b>before</b> the food.
          </p>

          <div className="mt-7 flex gap-3 flex-wrap reveal" style={{ animationDelay: '200ms' }}>
            <Link
              to="/create"
              className="group inline-flex items-center gap-2 bg-white text-swiggy-orange font-bold px-6 py-3.5 rounded-xl shadow-pop hover:shadow-glow active:scale-[0.97] transition-all"
            >
              Plan a celebration
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <Link
              to="/group"
              className="inline-flex items-center gap-2 bg-white/15 backdrop-blur text-white font-semibold px-5 py-3.5 rounded-xl border border-white/30 hover:bg-white/25 active:scale-[0.97] transition-all"
            >
              Continue last plan
            </Link>
          </div>

          {/* Live activity ticker */}
          <div className="mt-8 reveal" style={{ animationDelay: '320ms' }}>
            <div className="inline-flex items-center gap-2.5 bg-black/20 backdrop-blur-sm rounded-full pl-1 pr-3 py-1 border border-white/10">
              <div className="flex -space-x-1.5">
                <Avatar bg="bg-pink-400" letter="P" />
                <Avatar bg="bg-blue-400" letter="R" />
                <Avatar bg="bg-emerald-400" letter="S" />
              </div>
              <span className="text-xs font-medium">
                <b>2,341</b> celebrations this week
              </span>
              <span className="w-1 h-1 rounded-full bg-white/50" />
              <span className="text-xs">avg <b>4.8★</b></span>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="section-title">How caterkart works</div>
            <h2 className="mt-1.5 text-xl font-bold">Six clicks. One coordinated dinner.</h2>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="card card-hover p-4 reveal cursor-default"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-50 to-rose-50 grid place-items-center text-2xl">
                {f.emoji}
              </div>
              <div className="font-semibold text-sm mt-3">{f.title}</div>
              <div className="text-xs text-neutral-600 mt-1 leading-relaxed">{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* OCCASIONS */}
      <section className="max-w-3xl mx-auto px-4 pb-12">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="section-title">Pick an occasion</div>
            <h2 className="mt-1.5 text-xl font-bold">What are you celebrating?</h2>
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

function Avatar({ bg, letter }: { bg: string; letter: string }) {
  return (
    <div className={`${bg} w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold text-white ring-2 ring-black/20`}>
      {letter}
    </div>
  );
}
