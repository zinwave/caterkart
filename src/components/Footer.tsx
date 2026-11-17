import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LogoMark, IconBrandX, IconBrandLinkedIn, IconBrandInstagram, IconArrowRight, IconGift, IconBriefcase, SwiggyMark } from './icons/Icons';
import { SHOW_WORK } from '../config/features';
import { COMPANY, SOCIAL } from '../lib/company';

/**
 * Dark footer, matching the landing design.
 *
 * Dark rather than white so the page ends on a deliberate edge instead of
 * fading out — the last band before it is the orange tracking panel, and a
 * white footer under that reads as the page having run out rather than
 * finished.
 *
 * The link columns are the routes that actually exist. The design mock showed
 * a longer list (Multi-Restaurant Cart, News & Press, Help Center and so on);
 * those are not pages, and shipping them as links that go nowhere is the exact
 * bug this column had before — four items rendered as <a> with no href.
 * Add them here when the pages exist.
 */

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-[#231F22] text-white/70">
      <div className="max-w-6xl mx-auto px-5 py-14">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand + offerings */}
          <div className="sm:col-span-2 sm:pr-8">
            <div className="flex items-center gap-2.5">
              <LogoMark size={30} />
              <div className="leading-tight">
                <div className="font-display font-black text-[19px] tracking-tight text-white">
                  Cater<span className="text-swiggy-orange">Kart</span>
                </div>
              </div>
            </div>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/70">
              <SwiggyMark size={11} /> Powered by Swiggy
            </span>
            <p className="text-sm text-white/55 leading-relaxed mt-4 max-w-sm">
              Group ordering across many restaurants on Swiggy — synced delivery, one bill.
              For friends, and for teams.
            </p>
            <div className="flex gap-2 mt-5">
              <Link to="/create" className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-full bg-swiggy-orange text-white hover:bg-swiggy-dark transition">
                <IconGift size={13} /> Personal <IconArrowRight size={13} />
              </Link>
              {SHOW_WORK && (
                <Link to="/work" className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-full bg-white/10 text-white hover:bg-white/15 transition">
                  <IconBriefcase size={13} /> For Work <IconArrowRight size={13} />
                </Link>
              )}
            </div>
          </div>

          <FooterCol title="Product">
            <FooterLink to="/create">Personal</FooterLink>
            {SHOW_WORK && <FooterLink to="/work">For Work</FooterLink>}
            <FooterLink to="/orders">My orders</FooterLink>
          </FooterCol>

          <FooterCol title="Company">
            <FooterLink to="/about">About</FooterLink>
            {/* Hiring is run by the parent company, so this leaves the app. */}
            <FooterLink href={COMPANY.careersUrl}>Careers</FooterLink>
            <FooterLink to="/our-kitchen">Our kitchen</FooterLink>
            <FooterLink to="/contact">Contact us</FooterLink>
          </FooterCol>

          <FooterCol title="Legal">
            <FooterLink to="/privacy-policy">Privacy</FooterLink>
            <FooterLink to="/terms">Terms</FooterLink>
            <FooterLink to="/refund-policy">Refunds</FooterLink>
            <FooterLink to="/shipping-policy">Delivery</FooterLink>
            <FooterLink to="/cookie-policy">Cookies</FooterLink>
            <FooterLink to="/grievance-redressal">Grievances</FooterLink>
          </FooterCol>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-[12px] leading-relaxed text-white/40 text-center sm:text-left">
            <div>
              © {year} CaterKart · a product of{' '}
              <a
                href={COMPANY.parentUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-white/60 hover:text-swiggy-orange transition"
              >
                {COMPANY.legalName}
              </a>
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 sm:justify-start">
              <span>Made in Bengaluru</span>
              <span aria-hidden="true" className="text-white/20">·</span>
              <span className="inline-flex items-center gap-1.5">
                Powered by <SwiggyMark size={13} className="align-middle" /> MCP
                <span className="text-white/30">through Swiggy Builders Club</span>
              </span>
            </div>
          </div>
          {/*
            Rendered only where a handle is configured. A social icon that does
            nothing when clicked reads as an abandoned product — see SOCIAL in
            src/lib/company.ts.
          */}
          <div className="flex items-center gap-1.5">
            <Social label="X (Twitter)" href={SOCIAL.x}><IconBrandX size={15} /></Social>
            <Social label="LinkedIn" href={SOCIAL.linkedin}><IconBrandLinkedIn size={15} /></Social>
            <Social label="Instagram" href={SOCIAL.instagram}><IconBrandInstagram size={15} /></Social>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.14em] font-black text-white mb-3.5">{title}</div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

/**
 * An in-app route (`to`) or an external destination (`href`).
 *
 * Previously a bare `<a>` with neither was rendered when both were omitted —
 * which is how About, Careers, Partner and Privacy ended up looking like links
 * that did nothing. There is no "no destination" case now: a link either goes
 * somewhere or is not rendered.
 */
function FooterLink({
  to,
  href,
  children,
}: {
  to?: string;
  href?: string;
  children: ReactNode;
}) {
  const cls = 'block text-[13.5px] text-white/55 hover:text-white transition';
  if (to) return <Link to={to} className={cls}>{children}</Link>;
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  return null;
}

function Social({ label, href, children }: { label: string; href?: string; children: ReactNode }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className="w-9 h-9 rounded-full bg-white/10 grid place-items-center text-white/60 hover:bg-swiggy-orange hover:text-white transition"
    >
      {children}
    </a>
  );
}
