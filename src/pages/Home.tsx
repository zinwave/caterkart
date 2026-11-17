import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  IconCheck, IconArrowRight, IconLeaf,
  IconSparkles, IconReceipt, IconChef, IconClock,
  SwiggyMark,
} from '../components/icons/Icons';
import { SHOW_ADDONS_SECTION } from '../config/features';
import Seo from '../components/Seo';
import { faqJsonLd, organizationJsonLd, serviceJsonLd, websiteJsonLd } from '../lib/seo';
import ckLogoWhite from '../caterkart/assets/logowhite.png';

// =====================================================
// Landing — the menu of everything CaterKart can do.
//
// This page only OFFERS; it never asks. Every option links into the flow
// that owns it, and the questions that flow needs (date, guest count,
// pincode, address) are asked there where they can be validated.
//
// The hero is a full-bleed orange band and the two option cards OVERLAP its
// lower edge. That overlap is the layout doing the arguing: the headline
// states there are two ways, and the cards are already breaking into the
// same band rather than waiting below the fold, so the choice is visible
// before any scrolling. Everything after it is support for a decision the
// visitor has already been shown.
//
// Built on the app's own Swiggy design system — .wcard / .wbtn / .chip-*,
// ink-primary navy, swiggy-orange, Plus Jakarta — so the front door looks
// like the product behind it.
//
// ChromeShell hides the global Header on "/", so this page owns its nav.
// =====================================================

/** On-site buffet is paused; CaterBox is the only owned option for now. */
const BUFFET_ENABLED = false;

/**
 * The four shots in the hero.
 *
 * Drop a real photograph in `src` and it renders; until then each circle
 * falls back to a warm gradient carrying the dish name, which reads as
 * deliberate rather than as a broken <img>. The repository has no food
 * photography — only CaterBox packaging shots, which are pictures of empty
 * trays and would undersell the page badly.
 *
 * Replace all four together: a row where some circles are photographs and
 * others are gradients looks like a loading failure.
 */
const HERO_SHOTS: Array<{ label: string; src?: string; tint: string }> = [
  { label: 'Biryani', tint: 'linear-gradient(150deg,#C2410C,#7C2D12)' },
  { label: 'Sliders', tint: 'linear-gradient(150deg,#EA8C2E,#B45309)' },
  { label: 'Grazing table', tint: 'linear-gradient(150deg,#D97706,#92400E)' },
  { label: 'Desserts', tint: 'linear-gradient(150deg,#F0A868,#C2410C)' },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/*
        The landing page is the only route with a real organic audience, so it
        carries the full structured-data graph: who the business is, what it
        offers, and the questions people actually ask. The same graph is also
        inlined statically in index.html, because most AI crawlers never run
        this component — see src/lib/seo.ts.
      */}
      <Seo
        path="/"
        jsonLd={[organizationJsonLd(), websiteJsonLd(), serviceJsonLd(), faqJsonLd()]}
      />

      <main className="flex-1">
        <Hero />

        {/* ── The choice ──────────────────────────────────────────────
             Pulled up into the orange band. The negative margin is the
             whole point of the hero's bottom padding, so the two have to
             change together. ── */}
        <section id="order" className="relative z-10 -mt-24 sm:-mt-28 lg:-mt-32">
          <div className="max-w-6xl mx-auto px-5">
            <div className="grid md:grid-cols-2 gap-5">
              <RestaurantsCard />
              <CaterBoxCard />
            </div>

            {!BUFFET_ENABLED && (
              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line-subtle bg-surface-secondary px-5 py-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-swiggy-orange">
                  Buffet
                </span>
                <span className="text-[13.5px] text-ink-secondary">
                  On-site buffet is paused — CaterBox covers the same menus, packed per guest.
                </span>
              </div>
            )}
          </div>
        </section>

        {/* ── Add-ons ── hidden for now; /addons still works directly. */}
        {SHOW_ADDONS_SECTION && (
          <Section
            id="addons"
            eyebrow="Add to any order"
            title="The part delivery can't bring"
            sub="Ours, not the restaurant's — so they work on a CaterBox order and a Swiggy one alike."
          >
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(210px,1fr))]">
              {/* Our own inventory is configured in the CaterBox flow; Instamart
                  supplies come from Swiggy, so only that one goes to /addons. */}
              {[
                ['Live counters', 'Pizza · BBQ · Chats · Momo', 'from ₹5,000', '/caterbox'],
                ['Artists', 'Magic · Joker · Cartoonist', 'from ₹3,200', '/caterbox'],
                ['Photographer', 'Digital gallery included', 'from ₹4,000', '/caterbox'],
                ['Décor & props', 'Balloon arches, backdrops', 'on request', '/caterbox'],
                ['Party games', 'Board, console, racing rig', 'on request', '/caterbox'],
                ['Instamart supplies', 'Plates, cups, ice, candles', 'lands early', '/addons'],
              ].map(([name, detail, price, href]) => (
                <Link key={name} to={href} className="wcard-link group p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-bold text-[15.5px] text-ink-primary tracking-tight">{name}</div>
                    <IconArrowRight size={15} className="text-ink-disabled mt-0.5 shrink-0 transition-all group-hover:text-swiggy-orange group-hover:translate-x-0.5" />
                  </div>
                  <div className="mt-1.5 text-[13px] text-ink-tertiary leading-snug">{detail}</div>
                  <div className="mt-3 text-[13px] font-bold text-swiggy-orange tabular-nums">{price}</div>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* ── Why ───────────────────────────────────────── */}
        {/* Every point here has to hold for BOTH options, so each names what
            it means on each side rather than describing only one of them.
            Numbered because they are four separate promises, not a set of
            interchangeable feature tiles. */}
        <Section id="why" eyebrow="Why CaterKart" title="True of whichever you pick">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <Why n={1} icon={<IconReceipt size={19} />} title="No fees, either way"
              body="₹0 platform fee and ₹0 delivery fee on both. 5% GST shown on the bill and a proper tax invoice every time." />
            <Why n={2} icon={<IconClock size={19} />} title="Everything lands together"
              body="Restaurants are fired at staggered times so they converge; CaterBox is delivered to your hour. One doorbell either way." />
            <Why n={3} icon={<IconSparkles size={19} />} title="More than the meal"
              body="Live counters, artists, photographers and décor attach to either order — they're ours, not the restaurant's." />
            <Why n={4} icon={<IconChef size={19} />} title="People you can check"
              body="Every CaterBox kitchen is hand-picked, FSSAI-licensed and carries ratings you can read before you order." />
          </div>
        </Section>

        {/* ── Track ─────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-5 pb-20">
          <div
            className="flex flex-wrap items-center gap-5 rounded-2xl px-7 py-7 sm:px-9"
            style={{ background: 'linear-gradient(135deg,#FF7A45 0%,#FF5200 60%,#EC430D 100%)' }}
          >
            <div className="text-white">
              <div className="font-display font-black text-[20px] sm:text-[22px] tracking-[-0.025em]">
                Already placed an order?
              </div>
              <div className="mt-1 text-[14.5px] text-white/85">
                Track it with the phone number you ordered on — no login required.
              </div>
            </div>
            {/*
              Tracking is the one job here that a signed-out visitor can
              complete, so it goes to the phone-number lookup rather than the
              account page, which would bounce them to sign-in first.
            */}
            <Link
              to="/track-order"
              className="group ml-auto inline-flex items-center gap-2 rounded-xl bg-ink-primary px-6 py-3.5 text-[14.5px] font-bold text-white shadow-lg transition-transform active:scale-[0.98]"
            >
              Track my order
              <IconArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

/* ── Hero ─────────────────────────────────────────────── */

/**
 * Full-bleed orange band.
 *
 * The headline sits in ink-primary navy rather than white: on #FF5200, white
 * at this weight and size vibrates badly, and the navy is the same ink used
 * everywhere else in the product. The bottom padding is sized for the cards
 * that overlap it — change one and the other needs changing too.
 */
function Hero() {
  return (
    <section
      className="relative overflow-hidden px-5 pt-12 pb-36 sm:pt-16 sm:pb-40 lg:pb-44"
      style={{ background: 'linear-gradient(165deg,#FF6A1A 0%,#FF5200 55%,#F04A00 100%)' }}
    >
      {/* Soft bloom, echoing Swiggy's own app surfaces. Decorative. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.22), transparent 62%)' }}
      />

      <div className="relative mx-auto max-w-4xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-ink-primary/90 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-white">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-swiggy-orange" />
          Celebrations
        </span>

        <h1 className="mt-6 font-display font-black tracking-[-0.045em] leading-[0.98] text-ink-primary text-[clamp(40px,8.5vw,80px)] text-balance">
          Order for any occasion
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-[16.5px] sm:text-[18px] font-medium leading-relaxed text-ink-primary/80 text-balance">
          Two ways to feed the room — the restaurants everyone already loves, or a
          menu built dish by dish and cooked to order.
        </p>
      </div>

      <HeroShots />
    </section>
  );
}

/**
 * The overlapping circle row, with the three claims floating around it.
 *
 * Hidden from assistive technology entirely: the circles are decoration, and
 * each floating chip repeats a line that the option cards state properly a
 * screen-inch below. A screen reader hearing "No platform fee" twice before
 * reaching the card it belongs to is worse than not hearing it here at all.
 */
function HeroShots() {
  return (
    // `pb-9` reserves the lane the bottom chip sits in. Without it the chip is
    // positioned against the circle row itself and lands on top of the images.
    <div aria-hidden="true" className="relative mx-auto mt-10 max-w-3xl px-5 pb-9 sm:mt-12">
      <div className="flex items-center justify-center">
        {HERO_SHOTS.map((shot, i) => (
          <div
            key={shot.label}
            className={[
              'relative grid shrink-0 place-items-center overflow-hidden rounded-full',
              'h-[19vw] w-[19vw] max-h-[148px] max-w-[148px] min-h-[68px] min-w-[68px]',
              'border-4 sm:border-[5px] border-white shadow-[0_12px_30px_-6px_rgba(0,0,0,0.3)]',
              i > 0 ? '-ml-[3.5vw] sm:-ml-7' : '',
            ].join(' ')}
            // Stack left-over-right so the row reads as one overlapping strip.
            style={{ zIndex: HERO_SHOTS.length - i, background: shot.tint }}
          >
            {shot.src ? (
              <img src={shot.src} alt="" loading="eager" className="h-full w-full object-cover" />
            ) : (
              <span className="px-1.5 text-center text-[9px] sm:text-[11px] font-bold uppercase leading-tight tracking-wider text-white/85">
                {shot.label}
              </span>
            )}
          </div>
        ))}
      </div>

      {/*
        The two side chips are desktop-only. At phone widths the circle row
        already spans the viewport, so there is no clear margin to sit in —
        they were overhanging both edges and getting clipped. Nothing is lost:
        both claims appear again, in full, on the cards immediately below.
      */}
      <HeroChip className="hidden sm:inline-flex left-0 top-2" icon={<IconReceipt size={12} />}>
        No platform fee
      </HeroChip>
      <HeroChip className="hidden sm:inline-flex right-0 top-6" icon={<IconCheck size={12} />}>
        Pay on delivery
      </HeroChip>
      {/* Sits in the reserved lane below the circles, at every width. */}
      <HeroChip className="left-1/2 bottom-0 -translate-x-1/2" icon={<IconClock size={12} />}>
        Synced delivery — all at once
      </HeroChip>
    </div>
  );
}

function HeroChip({ className, icon, children }: { className: string; icon: ReactNode; children: ReactNode }) {
  return (
    <span
      className={`absolute inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3.5 py-2 text-[11.5px] sm:text-[12.5px] font-bold text-ink-primary shadow-[0_8px_20px_-4px_rgba(0,0,0,0.22)] ${className}`}
    >
      <span className="text-swiggy-orange">{icon}</span>
      {children}
    </span>
  );
}

/* ── The two options ──────────────────────────────────── */

/**
 * Option one — the restaurants.
 *
 * White, so it reads as the neutral default and lets the Swiggy mark carry
 * the association on its own. The card it sits beside is dark, and the pair
 * is the only real decision on this page; making them light and dark rather
 * than two shades of orange is what stops them blurring into one block.
 */
function RestaurantsCard() {
  return (
    <Link
      to="/create?mode=restaurants"
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-line-subtle bg-white p-7 shadow-floating transition-all duration-200 hover:shadow-glow"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-[10.5px] font-black uppercase tracking-[0.12em] text-swiggy-orange">
          <SwiggyMark size={13} /> Powered by Swiggy
        </span>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-secondary text-ink-tertiary">
          <IconReceipt size={17} />
        </span>
      </div>

      <h2 className="font-display font-black text-[25px] leading-[1.1] tracking-[-0.03em] text-ink-primary">
        From multiple restaurants
      </h2>
      <p className="mt-2.5 mb-6 text-[14.5px] leading-relaxed text-ink-secondary">
        Everyone&rsquo;s favourite place, in one go. Each kitchen is fired at its own
        time so the whole table lands together.
      </p>

      <CardCta tone="light">Choose restaurants</CardCta>

      <IdealFor tone="light" items={['House party', 'Birthday', 'Team dinner', 'Friends catching up']} />

      <FeatureGrid
        tone="light"
        items={[
          'One order across many restaurants',
          'Synced delivery — all at once',
          'Add-ons from Instamart — plates, cups, ice',
          'One bill at the end',
        ]}
      />

      {/* Mirrors the packaging block on the other card. These are the claims
          the old stat rail used to make, said where they apply rather than as
          a row of figures floating under both options. */}
      <DetailBox
        tone="light"
        icon={<IconReceipt size={13} />}
        title="What it costs"
        rows={[
          ['No platform fee', 'we add nothing on top'],
          ['No delivery markup', "Swiggy's own prices, as if you ordered direct"],
          ['Pay on delivery', 'from your own Swiggy account'],
        ]}
      />
    </Link>
  );
}

/**
 * Option two — CaterBox.
 *
 * Dark, carrying CaterKart's own wordmark: this is the menu we design and
 * the box that turns up with our name on it. The food itself is cooked by
 * hand-picked, FSSAI-licensed partner kitchens — the copy says so, because
 * the Terms say so and the two have to match.
 */
function CaterBoxCard() {
  return (
    <Link
      to="/caterbox"
      className="group relative flex flex-col overflow-hidden rounded-2xl p-7 shadow-floating transition-all duration-200 hover:shadow-[0_20px_46px_-8px_rgba(236,67,13,0.45)]"
      style={{ background: 'linear-gradient(145deg,#231F22 0%,#2E2320 55%,#3A2A1E 100%)' }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(236,67,13,0.45), transparent 68%)' }}
      />

      <div className="relative mb-5 flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10.5px] font-black uppercase tracking-[0.12em] text-white/80">
          <img src={ckLogoWhite} alt="" className="h-3 w-auto object-contain" />
          CaterBox kitchens
        </span>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white/70">
          <IconChef size={17} />
        </span>
      </div>

      <h2 className="relative font-fredoka font-semibold text-[25px] leading-[1.12] tracking-[-0.02em] text-white">
        CaterBox meal boxes
      </h2>
      <p className="relative mt-2.5 mb-6 text-[14.5px] leading-relaxed text-white/70">
        A menu built dish by dish, cooked to order by our hand-picked partner
        kitchens, packed one box per guest.
      </p>

      <CardCta tone="dark">Build your menu</CardCta>

      <IdealFor tone="dark" items={['Office party', 'Birthday', 'Housewarming', 'Wedding function']} />

      <FeatureGrid
        tone="dark"
        items={[
          'Fully customisable menu',
          'Hand-picked, FSSAI-licensed kitchens',
          'Packed one box per guest, 30–500',
          'Live counters & artists on the same order',
        ]}
      />

      <DetailBox
        tone="dark"
        icon={<IconLeaf size={13} />}
        title="Pick your packaging"
        rows={[
          ['Reusable carriers', 'collected the next day'],
          ['Biodegradable', 'bagasse box, wooden cutlery'],
          ['Co-branded sleeves', 'your brand on every box'],
        ]}
      />
    </Link>
  );
}

/* ── Card pieces ──────────────────────────────────────── */
// Shared by both option cards so the pair stays structurally identical and
// only the palette differs. A visitor comparing them is scanning the same
// rows on each side; if the two drift apart, that comparison gets harder.

type Tone = 'light' | 'dark';

function CardCta({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={[
        'relative flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5',
        'text-[15px] font-bold text-white shadow-sm transition-transform group-active:scale-[0.98]',
      ].join(' ')}
      style={{
        background:
          tone === 'light'
            ? 'linear-gradient(135deg,#FF6A1A,#FF5200)'
            : 'linear-gradient(135deg,#FF7A45,#EC430D)',
      }}
    >
      {children}
      <IconArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
    </span>
  );
}

function IdealFor({ tone, items }: { tone: Tone; items: string[] }) {
  const light = tone === 'light';
  return (
    <div className="relative mt-6">
      <div
        className={`mb-2.5 text-[10px] font-black uppercase tracking-[0.13em] ${
          light ? 'text-ink-disabled' : 'text-white/45'
        }`}
      >
        Ideal for
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((o) => (
          <span
            key={o}
            className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
              light ? 'bg-surface-secondary text-ink-secondary' : 'bg-white/10 text-white/85'
            }`}
          >
            {o}
          </span>
        ))}
      </div>
    </div>
  );
}

function FeatureGrid({ tone, items }: { tone: Tone; items: string[] }) {
  const light = tone === 'light';
  return (
    <ul className="relative mt-6 grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
      {items.map((f) => (
        <li
          key={f}
          className={`flex items-start gap-2 text-[13px] font-medium leading-snug ${
            light ? 'text-ink-secondary' : 'text-white/85'
          }`}
        >
          <span
            className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-[5px] ${
              light ? 'bg-swiggy-orange' : 'bg-swiggy-orange'
            }`}
          >
            <IconCheck size={9} className="text-white" />
          </span>
          {f}
        </li>
      ))}
    </ul>
  );
}

function DetailBox({
  tone, icon, title, rows,
}: {
  tone: Tone; icon: ReactNode; title: string; rows: string[][];
}) {
  const light = tone === 'light';
  return (
    <div
      className={`relative mt-6 rounded-xl border p-4 ${
        light ? 'border-line-subtle bg-surface-secondary' : 'border-white/10 bg-white/[0.04]'
      }`}
    >
      <div
        className={`mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.13em] ${
          light ? 'text-ink-tertiary' : 'text-white/45'
        }`}
      >
        {icon} {title}
      </div>
      <dl className="flex flex-col gap-2">
        {rows.map(([name, note]) => (
          <div key={name} className="flex items-baseline gap-2 text-[12.5px]">
            <dt className={`shrink-0 font-bold ${light ? 'text-ink-primary' : 'text-white/90'}`}>
              {name}
            </dt>
            <dd className={`truncate ${light ? 'text-ink-tertiary' : 'text-white/45'}`}>— {note}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ── Pieces ───────────────────────────────────────────── */

function Section({
  id, eyebrow, title, sub, children,
}: {
  id?: string; eyebrow: string; title: string; sub?: string; children: ReactNode;
}) {
  return (
    <section id={id} className="max-w-6xl mx-auto px-5 py-14 sm:py-16 scroll-mt-20">
      <div className="mb-9 max-w-2xl">
        <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-swiggy-orange mb-3">{eyebrow}</div>
        <h2 className="font-display font-black text-[clamp(26px,3.6vw,38px)] leading-[1.1] tracking-[-0.028em] text-ink-primary text-balance">
          {title}
        </h2>
        {sub && <p className="mt-3 text-[16.5px] leading-relaxed text-ink-secondary">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function Why({ n, icon, title, body }: { n: number; icon: ReactNode; title: string; body: string }) {
  return (
    <div className="wcard p-6">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-50 text-swiggy-orange mb-4">
        {icon}
      </span>
      <h3 className="font-bold text-[15.5px] tracking-tight text-ink-primary mb-1.5">
        {/* The number is presentational — the heading reads as a promise, not
            as item n of four, and a screen reader announcing "1." adds nothing. */}
        <span aria-hidden="true" className="text-ink-disabled">{n}. </span>
        {title}
      </h3>
      <p className="text-[13.5px] leading-relaxed text-ink-secondary">{body}</p>
    </div>
  );
}
