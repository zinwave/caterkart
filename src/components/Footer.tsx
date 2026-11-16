import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LogoMark, IconBrandX, IconBrandLinkedIn, IconBrandInstagram, IconArrowRight, IconGift, IconBriefcase, SwiggyMark } from './icons/Icons';
import { SHOW_WORK } from '../config/features';
import { COMPANY, SOCIAL } from '../lib/company';

/**
 * Minimal, elegant footer — same design language as the landing (white surface,
 * hairline dividers, Swiggy-orange accents, the two-offering framing).
 */

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line-subtle">
      <div className="max-w-5xl mx-auto px-5 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand + offerings */}
          <div className="sm:col-span-2 sm:pr-8">
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
            <p className="text-sm text-ink-secondary leading-relaxed mt-4 max-w-sm">
              Group ordering across many restaurants on Swiggy — synced delivery, one bill.
              For friends, and for teams.
            </p>
            <div className="flex gap-2 mt-5">
              <Link to="/create" className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-orange-50 text-swiggy-orange hover:bg-orange-100 transition">
                <IconGift size={13} /> Personal <IconArrowRight size={13} />
              </Link>
              {SHOW_WORK && (
                <Link to="/work" className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-surface-secondary text-ink-primary hover:bg-surface-tertiary transition">
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
        <div className="mt-10 pt-6 border-t border-line-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-[12px] leading-relaxed text-ink-tertiary text-center sm:text-left">
            <div>
              © {year} CaterKart · a product of{' '}
              <a
                href={COMPANY.parentUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-ink-secondary hover:text-swiggy-orange transition"
              >
                {COMPANY.legalName}
              </a>
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 sm:justify-start">
              <span>Made in Bengaluru</span>
              <span aria-hidden="true" className="text-line-default">·</span>
              <span className="inline-flex items-center gap-1.5">
                Powered by <SwiggyMark size={13} className="align-middle" /> MCP
                <span className="text-ink-disabled">through Swiggy Builders Club</span>
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
      <div className="text-[10px] uppercase tracking-[0.14em] font-black text-ink-tertiary mb-3">{title}</div>
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
  const cls = 'block text-sm text-ink-secondary hover:text-swiggy-orange transition';
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
      className="w-9 h-9 rounded-xl bg-surface-secondary border border-line-subtle grid place-items-center text-ink-secondary hover:bg-swiggy-orange hover:border-swiggy-orange hover:text-white transition"
    >
      {children}
    </a>
  );
}
