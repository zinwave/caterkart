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
import boxImg from '../caterkart/assets/box8.png';
import ckLogoWhite from '../caterkart/assets/logowhite.png';

// =====================================================
// Landing — the menu of everything CaterKart can do.
//
// This page only OFFERS; it never asks. Every option links into the flow
// that owns it, and the questions that flow needs (date, guest count,
// pincode, address) are asked there where they can be validated.
//
// What each card does carry is the handful of facts that decide whether
// the option suits the visitor at all — headcount, notice, area, how you
// pay. The two ordering options barely overlap on those terms (CaterBox
// wants 30+ guests and a week's notice; restaurants work for four people
// tonight), so stating them here is what stops someone picking the path
// they cannot use and hitting a validation wall two screens later.
//
// Built on the app's own Swiggy design system — .wcard / .wbtn / .chip-*,
// ink-primary navy, swiggy-orange, Plus Jakarta — so the front door looks
// like the product behind it.
//
// ChromeShell hides the global Header on "/", so this page owns its nav.
// =====================================================

/** On-site buffet is paused; CaterBox is the only owned option for now. */
const BUFFET_ENABLED = false;


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
        {/* ── Above the fold: the pitch AND the choice ──────────────────
             The hero and the Celebrations section used to be separate and
             said the same thing twice ("Food for every occasion" / "Order for
             any occasion"), which together with the stat rail pushed the two
             cards — the only real decision on this page — off the first
             screen. They are one block now: headline, then the options, with
             the trust figures underneath where they reassure a choice rather
             than delay it. ── */}
        <section id="order" className="max-w-6xl mx-auto px-5 pt-10 pb-14 sm:pt-14">
          {/* Deliberately unadorned: no pill, no icon, no gradient on the
              headline. And it no longer lists occasions — each card carries
              its own "Ideal for" row, so saying it up here only padded the
              page and made the cards read as a repeat. */}
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-swiggy-orange" />
              <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-swiggy-orange">
                Celebrations
              </span>
            </div>

            <h1 className="mt-5 font-display font-black tracking-[-0.038em] leading-[1.04] text-ink-primary text-[clamp(36px,5.4vw,56px)] text-balance">
              Order for any occasion
            </h1>

            <p className="mt-4 text-[17px] sm:text-[18px] leading-relaxed text-ink-secondary">
              Two ways to feed the room — the restaurants everyone already loves, or
              our own kitchen cooking to your menu.
            </p>
          </div>

          <div className="mt-10 grid md:grid-cols-2 gap-5">
            <RestaurantsCard />
            <CaterBoxCard />
          </div>

          {!BUFFET_ENABLED && (
            <p className="mt-5 flex flex-wrap items-center gap-2.5 text-[13.5px] text-ink-tertiary">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-dashed border-line-default">
                <IconChef size={12} /> Buffet
              </span>
              On-site buffet is paused — CaterBox covers the same menus, packed per guest.
            </p>
          )}

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
            it means on each side rather than describing only one of them. */}
        <Section id="why" eyebrow="Why CaterKart" title="True of whichever you pick">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <Why icon={<IconReceipt size={19} />} title="No fees, either way"
              body="₹0 platform fee and ₹0 delivery fee on both. 5% GST shown on the bill and a proper tax invoice every time." />
            <Why icon={<IconClock size={19} />} title="Everything lands together"
              body="Restaurants are fired at staggered times so they converge; CaterBox is delivered to your hour. One doorbell either way." />
            <Why icon={<IconSparkles size={19} />} title="More than the meal"
              body="Live counters, artists, photographers and décor attach to either order — they're ours, not the restaurant's." />
            <Why icon={<IconChef size={19} />} title="People you can check"
              body="CaterBox is cooked in our own kitchen. Where we use vendors, they're hand-picked and carry ratings you can read." />
          </div>
        </Section>

        {/* ── Track ─────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-5 pb-20">
          <div className="wcard flex flex-wrap items-center gap-5 px-7 py-6">
            <div>
              <div className="font-bold text-[17px] tracking-tight text-ink-primary">Already placed an order?</div>
              <div className="mt-0.5 text-[14px] text-ink-secondary">
                Track it with the phone number you ordered on — no login required.
              </div>
            </div>
            <Link to="/orders" className="wbtn-soft ml-auto text-[14.5px]">Track my order</Link>
          </div>
        </section>
      </main>

    </div>
  );
}


/**
 * Option one — Swiggy's own identity. Their orange, their mark, their
 * language: this is their supply and their delivery, and dressing it in our
 * brand would misrepresent who is actually cooking and driving.
 */
function RestaurantsCard() {
  return (
    <Link
      to="/create?mode=restaurants"
      className="group relative overflow-hidden rounded-2xl shadow-floating transition-all duration-200 hover:shadow-glow"
      style={{ background: 'linear-gradient(145deg, #FF5200 0%, #FF6B1F 45%, #FF8A4C 100%)' }}
    >
      {/* soft light bloom, echoing Swiggy's app surfaces */}
      <span
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.28), transparent 65%)' }}
      />
      <div className="relative p-7 flex flex-col h-full text-white">
        <div className="flex h-10 items-center gap-2.5 mb-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white shadow-sm">
            <SwiggyMark size={22} />
          </span>
          <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/80">
            Powered by Swiggy
          </span>
        </div>

        <h3 className="font-display font-black text-[26px] leading-[1.1] tracking-[-0.03em] mb-2.5">
          From multiple restaurants
        </h3>
        <p className="mb-5 min-h-[3.5rem] max-w-sm text-[15px] leading-relaxed text-white/80">
          Everyone&rsquo;s favourite place, in one go. Each kitchen is fired at its own
          time so the whole table lands together.
        </p>

        <div className="mb-6">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.13em] text-white/55">
            Ideal for
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['House party', 'Birthday', 'Team dinner', 'Friends catching up'].map((o) => (
              <span key={o} className="rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-semibold text-white">
                {o}
              </span>
            ))}
          </div>
        </div>

        <ul className="flex flex-col gap-2.5 mb-7">
          {[
            'One order across many restaurants',
            'Synced delivery — all at once',
            'Add-ons from Instamart — plates, cups, ice',
            'One bill at the end',
          ].map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[14.5px] font-medium">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/20 mt-px">
                <IconCheck size={11} className="text-white" />
              </span>
              {f}
            </li>
          ))}
        </ul>

        {/* Mirrors the packaging block on the other card. These are the
            claims the stat rail used to make, said where they apply rather
            than as a row of figures floating under both options. */}
        <div className="mb-6 rounded-xl border border-white/20 bg-white/10 p-4">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.13em] text-white/70">
            <IconReceipt size={13} /> What it costs
          </div>
          <dl className="flex flex-col gap-2">
            {[
              ['No platform fee', 'we add nothing on top'],
              ['No delivery markup', "Swiggy's own prices, as if you ordered direct"],
              ['Pay on delivery', 'from your own Swiggy account'],
            ].map(([name, note]) => (
              <div key={name} className="flex items-baseline gap-2 text-[13px]">
                <dt className="shrink-0 font-semibold text-white">{name}</dt>
                <dd className="truncate text-white/60">— {note}</dd>
              </div>
            ))}
          </dl>
        </div>

        <span className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-[15px] font-bold text-swiggy-orange shadow-sm transition-transform group-active:scale-[0.98]">
          Choose restaurants
          <IconArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

/**
 * Option two — our own identity: CaterKart's warm orange and Fredoka, the
 * white wordmark, and a real photograph of the box that actually turns up.
 * This is our kitchen, so it wears our brand.
 */
function CaterBoxCard() {
  return (
    <Link
      to="/caterbox"
      className="group relative overflow-hidden rounded-2xl shadow-floating transition-all duration-200 hover:shadow-[0_20px_46px_-8px_rgba(236,67,13,0.45)]"
      style={{ background: 'linear-gradient(145deg, #1B1A1F 0%, #2A1B14 55%, #3A1E10 100%)' }}
    >
      <span
        className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(236,67,13,0.55), transparent 68%)' }}
      />
      <div className="relative p-7 flex flex-col h-full text-white">
        <div className="flex h-10 items-center gap-2.5 mb-5">
          <img src={ckLogoWhite} alt="CaterKart" className="h-6 w-auto shrink-0 object-contain" />
          <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/55">
            Our own kitchen
          </span>
        </div>

        <h3 className="font-fredoka font-semibold text-[26px] leading-[1.12] tracking-[-0.02em] mb-2.5">
          CaterBox meal boxes
        </h3>
        <p className="mb-5 min-h-[3.5rem] max-w-sm text-[15px] leading-relaxed text-white/70">
          A menu built dish by dish, cooked by us and our hand-picked vendors, packed
          one box per guest.
        </p>

        {/* Overlaps the other card on purpose — a birthday can go either way.
            What separates them is scale and notice, not the occasion itself. */}
        <div className="mb-6">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.13em] text-white/45">
            Ideal for
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['Office party', 'Birthday', 'Housewarming', 'Wedding function'].map((o) => (
              <span key={o} className="rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-semibold text-white/85">
                {o}
              </span>
            ))}
          </div>
        </div>

        <ul className="flex flex-col gap-2.5 mb-7">
          {[
            'Fully customisable menu',
            'Our own kitchen, our own vendors',
            'Packed one box per guest, 30–500',
            'Live counters & artists on the same order',
          ].map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[14.5px] font-medium">
              <span
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full mt-px"
                style={{ background: 'linear-gradient(135deg,#FF7A45,#EC430D)' }}
              >
                <IconCheck size={11} className="text-white" />
              </span>
              {f}
            </li>
          ))}
        </ul>

        {/* Packaging is a CaterBox choice — it only exists when we pack the
            boxes — so it belongs on this card rather than in a section of its
            own that implied it applied to restaurant orders too. */}
        <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.13em] text-white/45">
            <IconLeaf size={13} /> Pick your packaging
          </div>
          <dl className="flex flex-col gap-2">
            {[
              ['Reusable carriers', 'collected the next day'],
              ['Biodegradable', 'bagasse box, wooden cutlery'],
              ['Co-branded sleeves', 'your brand on every box'],
            ].map(([name, note]) => (
              <div key={name} className="flex items-baseline gap-2 text-[13px]">
                <dt className="shrink-0 font-medium text-white/85">{name}</dt>
                <dd className="truncate text-white/40">— {note}</dd>
              </div>
            ))}
          </dl>
        </div>

        <span
          className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[15px] font-bold text-white transition-transform group-active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg,#FF7A45,#EC430D)' }}
        >
          Build your menu
          <IconArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
        </span>

        {/* The actual box. Decorative, so it stays out of the reading order. */}
        <img
          src={boxImg}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="pointer-events-none absolute -right-8 top-4 w-28 sm:w-32 rotate-[-8deg] opacity-90 drop-shadow-2xl transition-transform duration-300 group-hover:scale-105 group-hover:rotate-[-5deg]"
        />
      </div>
    </Link>
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

function Why({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="wcard p-6">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-50 text-swiggy-orange mb-4">
        {icon}
      </span>
      <h3 className="font-bold text-[16px] tracking-tight text-ink-primary mb-1.5">{title}</h3>
      <p className="text-[13.5px] leading-relaxed text-ink-secondary">{body}</p>
    </div>
  );
}
