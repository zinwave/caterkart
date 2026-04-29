import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconArrowRight, IconBrandApple, IconBrandFacebook, IconBrandGooglePlay,
  IconBrandInstagram, IconBrandLinkedIn, IconBrandX, IconBrandYouTube,
  IconHeart, IconMail, IconShield, IconSparkles,
  LogoMark,
} from './icons/Icons';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  return (
    <footer className="relative mt-12">
      {/* Decorative illustration banner */}
      <FooterIllustration />

      {/* Newsletter card (overlaps the illustration) */}
      <div className="max-w-3xl mx-auto px-4 -mt-12 relative z-10">
        <div className="card p-5 sm:p-7 bg-white border-orange-100 shadow-pop relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-orange-100/60 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-44 h-44 rounded-full bg-rose-100/50 blur-2xl pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-swiggy-orange to-cater-coral grid place-items-center text-white shadow-pop shrink-0">
              <IconMail size={26} />
            </div>
            <div className="flex-1">
              <h3 className="font-black text-xl tracking-tight leading-tight">
                Friday Feast Notes
              </h3>
              <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                Curated celebration ideas, hidden Swiggy promo codes, and the occasional dad-joke.
                Useful or unsubscribe — we promise.
              </p>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); if (email.includes('@')) setSubscribed(true); }}
              className="flex w-full sm:w-auto bg-neutral-50 rounded-xl border border-neutral-200 overflow-hidden focus-within:border-swiggy-orange focus-within:ring-2 focus-within:ring-orange-100 transition"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                disabled={subscribed}
                className="px-3.5 py-2.5 text-sm outline-none flex-1 sm:w-56 bg-transparent placeholder:text-neutral-400 disabled:text-neutral-400"
              />
              <button
                type="submit"
                disabled={subscribed}
                className={`px-4 font-bold text-sm flex items-center gap-1.5 transition ${
                  subscribed
                    ? 'bg-swiggy-green text-white'
                    : 'bg-swiggy-orange text-white hover:bg-cater-600'
                }`}
              >
                {subscribed ? '✓ Subscribed' : <>Subscribe <IconArrowRight size={16} /></>}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Link grid */}
      <div className="max-w-3xl mx-auto px-4 pt-10 pb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-8">
          {/* Brand col on mobile spans full width */}
          <div className="col-span-2 sm:col-span-2 sm:pr-6">
            <div className="flex items-center gap-2.5 mb-3">
              <LogoMark size={36} />
              <div>
                <div className="font-black text-[16px] tracking-tight">
                  cater<span className="text-swiggy-orange">kart</span>
                </div>
                <div className="powered-by mt-0.5">
                  powered by <span className="pb-mark">S</span>
                  <span className="text-swiggy-orange tracking-normal normal-case font-bold text-[10px]">Swiggy</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed max-w-sm">
              Plan group meals across multiple restaurants with synced delivery, one bill,
              and a smart Instamart pre-drop. Fewer arguments, more eating.
            </p>

            {/* Trust badges */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge icon={<IconShield size={12} />} label="100% Secure" />
              <Badge icon={<IconSparkles size={12} />} label="No spam ever" />
            </div>
          </div>

          <FooterCol title="Help">
            <FooterLink>FAQs</FooterLink>
            <FooterLink>Order issues</FooterLink>
            <FooterLink>Refunds</FooterLink>
            <FooterLink>Contact support</FooterLink>
            <FooterLink>Privacy &amp; Terms</FooterLink>
          </FooterCol>
          <FooterCol title="Company">
            <FooterLink>About</FooterLink>
            <FooterLink>Press</FooterLink>
            <FooterLink>
              Careers
              <span className="ml-1 chip chip-green text-[9px] py-0 px-1.5">Hiring</span>
            </FooterLink>
            <FooterLink>Partner with us</FooterLink>
            <FooterLink>For brands</FooterLink>
          </FooterCol>
        </div>

        {/* App download section */}
        <div className="mt-10 pt-7 border-t border-neutral-200/70">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:justify-between">
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-neutral-500">Get the app</div>
              <h4 className="font-bold text-base mt-1 leading-tight">Plan celebrations on the go</h4>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm">Push notifications when guests RSVP, live tracking, one-tap reorder.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <AppBadge brand="apple" tagline="Download on" name="App Store" />
              <AppBadge brand="google" tagline="Get it on" name="Google Play" />
            </div>
          </div>
        </div>
      </div>

      {/* Social + status row */}
      <div className="max-w-3xl mx-auto px-4 pb-6">
        <div className="border-t border-neutral-200/70 pt-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 justify-between">
          <div className="flex items-center gap-1.5">
            <SocialButton icon={<IconBrandX size={16} />} label="X (Twitter)" />
            <SocialButton icon={<IconBrandLinkedIn size={16} />} label="LinkedIn" />
            <SocialButton icon={<IconBrandInstagram size={16} />} label="Instagram" />
            <SocialButton icon={<IconBrandFacebook size={16} />} label="Facebook" />
            <SocialButton icon={<IconBrandYouTube size={16} />} label="YouTube" />
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-soft" />
              All systems operational
            </span>
            <span className="chip">v0.1 · mock</span>
          </div>
        </div>
      </div>

      {/* Bottom dark bar */}
      <div className="bg-neutral-950 text-neutral-400">
        <div className="max-w-3xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <LogoMark size={26} />
            <div className="leading-tight">
              <div className="font-black text-sm text-white">
                cater<span className="text-swiggy-orange">kart</span>
              </div>
              <div className="text-[10px] text-neutral-500">
                © {new Date().getFullYear()} Caterkart Inc. All rights reserved.
              </div>
            </div>
          </div>
          <div className="text-[11px] flex items-center gap-1.5">
            Made with <IconHeart size={12} className="text-cater-coral" /> in Bengaluru
          </div>
        </div>
      </div>
    </footer>
  );
}

// =====================================================
// Footer illustration banner
// =====================================================
function FooterIllustration() {
  return (
    <div className="relative h-44 sm:h-52 overflow-hidden bg-gradient-to-b from-orange-50/40 via-rose-50/30 to-orange-50/0">
      <svg
        viewBox="0 0 1200 220"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="footer-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFF6EE" />
            <stop offset="100%" stopColor="#FFE8DA" />
          </linearGradient>
          <linearGradient id="footer-table" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFB071" />
            <stop offset="100%" stopColor="#FC8019" />
          </linearGradient>
        </defs>

        {/* Sky / hill curve */}
        <path
          d="M0 120 C 200 80, 400 160, 600 100 S 1000 60, 1200 110 L1200 220 L0 220 Z"
          fill="url(#footer-sky)"
        />

        {/* Confetti dots */}
        {[
          [80, 50], [180, 30], [310, 70], [430, 25], [560, 60], [690, 35],
          [820, 55], [950, 25], [1080, 65], [1140, 35], [40, 80], [240, 90],
          [360, 50], [510, 90], [640, 80], [770, 90], [890, 70], [1010, 95],
        ].map(([x, y], i) => (
          <circle
            key={i}
            cx={x} cy={y}
            r={1.5 + (i % 3) * 0.6}
            fill={i % 3 === 0 ? '#FC8019' : i % 3 === 1 ? '#FF5E5B' : '#FFB071'}
            opacity={0.7}
          />
        ))}

        {/* Squiggle confetti */}
        <path d="M120 95 q 5 -8 10 0 t 10 0" stroke="#FC8019" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M880 95 q 5 -8 10 0 t 10 0" stroke="#FF5E5B" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M460 110 q 4 -6 8 0 t 8 0" stroke="#FFB071" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>

      {/* Floating plates */}
      <FloatingPlate emoji="🍕" className="left-[10%] top-6" delay="0s" />
      <FloatingPlate emoji="🍛" className="left-[28%] top-10" delay="1.5s" />
      <FloatingPlate emoji="🥢" className="left-[48%] top-4" delay="0.7s" />
      <FloatingPlate emoji="🧇" className="right-[26%] top-8" delay="2.1s" />
      <FloatingPlate emoji="🥤" className="right-[8%] top-12" delay="1s" />

      {/* Centered headline */}
      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 chip chip-orange mb-2 backdrop-blur-sm">
            <IconSparkles size={12} />
            <span className="text-[10px] font-black uppercase tracking-widest">Eat together</span>
          </div>
          <div className="font-black text-2xl sm:text-3xl tracking-tight bg-gradient-to-r from-neutral-900 via-swiggy-orange to-cater-coral bg-clip-text text-transparent">
            Made for the table you set.
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatingPlate({ emoji, className, delay }: { emoji: string; className: string; delay: string }) {
  return (
    <div
      className={`absolute w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white grid place-items-center text-2xl shadow-pop animate-float-slow ${className}`}
      style={{ animationDelay: delay }}
    >
      {emoji}
    </div>
  );
}

// =====================================================
// Helpers
// =====================================================
function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] font-black text-neutral-500 mb-3">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FooterLink({ children }: { children: React.ReactNode }) {
  return (
    <a className="block text-sm text-neutral-700 hover:text-swiggy-orange transition cursor-pointer">
      {children}
    </a>
  );
}

function Badge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-bold text-neutral-600 bg-neutral-100 px-2 py-1 rounded-md">
      <span className="text-swiggy-orange">{icon}</span>
      {label}
    </span>
  );
}

function SocialButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      title={label}
      aria-label={label}
      className="w-9 h-9 rounded-xl bg-white border border-neutral-200 grid place-items-center text-neutral-700 hover:bg-swiggy-orange hover:border-swiggy-orange hover:text-white transition active:scale-90"
    >
      {icon}
    </button>
  );
}

function AppBadge({ brand, tagline, name }: { brand: 'apple' | 'google'; tagline: string; name: string }) {
  const Icon = brand === 'apple' ? IconBrandApple : IconBrandGooglePlay;
  return (
    <a className="group flex items-center gap-2.5 px-3.5 py-2 bg-neutral-950 hover:bg-neutral-800 transition rounded-xl text-white shadow-pop active:scale-95 cursor-pointer">
      <Icon size={26} className={brand === 'apple' ? 'text-white' : ''} />
      <div className="leading-tight">
        <div className="text-[9px] uppercase tracking-wider opacity-75">{tagline}</div>
        <div className="text-sm font-bold">{name}</div>
      </div>
    </a>
  );
}
