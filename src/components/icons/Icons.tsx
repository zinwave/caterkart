// =====================================================
// Icons — inline SVG, Lucide-style stroke set.
// Standard: 24×24 viewBox, currentColor, stroke 2,
// linecap/linejoin round. Brand glyphs (X, IG, Apple, etc)
// use solid fill in currentColor for recognizability.
// =====================================================
import { SVGProps } from 'react';
import swiggyLogo from '../../assets/swiggy-logo.png';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const baseStrokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function S({ size = 20, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      {...baseStrokeProps}
      {...rest}
    >
      {children}
    </svg>
  );
}

// ===== UI / Nav =====
export const IconMapPin = (p: IconProps) => (
  <S {...p}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </S>
);

export const IconSearch = (p: IconProps) => (
  <S {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </S>
);

export const IconBell = (p: IconProps) => (
  <S {...p}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </S>
);

export const IconReceipt = (p: IconProps) => (
  <S {...p}>
    <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 2V2H4Z" />
    <path d="M8 7h9M8 11h9M8 15h6" />
  </S>
);

export const IconUser = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a7 7 0 0 1 14 0v1" />
  </S>
);

export const IconChevronDown = (p: IconProps) => (
  <S {...p}><path d="m6 9 6 6 6-6" /></S>
);

export const IconChevronRight = (p: IconProps) => (
  <S {...p}><path d="m9 6 6 6-6 6" /></S>
);

export const IconArrowRight = (p: IconProps) => (
  <S {...p}><path d="M5 12h14M13 5l7 7-7 7" /></S>
);

export const IconPlus = (p: IconProps) => (
  <S {...p}><path d="M12 5v14M5 12h14" /></S>
);

export const IconClose = (p: IconProps) => (
  <S {...p}><path d="m18 6-12 12M6 6l12 12" /></S>
);

export const IconCheck = (p: IconProps) => (
  <S {...p}><path d="M20 6 9 17l-5-5" /></S>
);

export const IconMenu = (p: IconProps) => (
  <S {...p}><path d="M4 6h16M4 12h16M4 18h16" /></S>
);

export const IconHome = (p: IconProps) => (
  <S {...p}><path d="m3 10 9-7 9 7v11a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2V10Z" /></S>
);

export const IconCart = (p: IconProps) => (
  <S {...p}>
    <circle cx="9" cy="20" r="1.5" />
    <circle cx="18" cy="20" r="1.5" />
    <path d="M3 4h2l2.4 12.5A2 2 0 0 0 9.4 18H19a2 2 0 0 0 2-1.6l1.4-7.4H6" />
  </S>
);

export const IconHeart = (p: IconProps) => (
  <S {...p}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
  </S>
);

export const IconHeartFill = (p: IconProps) => (
  <S {...p}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" fill="currentColor" />
  </S>
);

export const IconStar = (p: IconProps) => (
  <S {...p}>
    <path d="m12 2 3.1 6.3 7 1-5 4.9 1.2 6.9L12 17.8 5.7 21l1.2-6.9-5-4.9 7-1L12 2Z" fill="currentColor" />
  </S>
);

export const IconClock = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </S>
);

export const IconBolt = (p: IconProps) => (
  <S {...p}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" fill="currentColor" stroke="none" />
  </S>
);

export const IconShield = (p: IconProps) => (
  <S {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    <path d="m9 12 2 2 4-4" />
  </S>
);

export const IconSparkles = (p: IconProps) => (
  <S {...p}>
    <path d="M12 3v3m0 12v3M5 12H2m20 0h-3M6 6l2 2m8 8 2 2M6 18l2-2m8-8 2-2" />
  </S>
);

/** Coupon / offer tag. */
export const IconTag = (p: IconProps) => (
  <S {...p}>
    <path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
  </S>
);

export const IconQr = (p: IconProps) => (
  <S {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h3v3M21 14v.01M14 21h3M21 17v4" />
  </S>
);

export const IconTruck = (p: IconProps) => (
  <S {...p}>
    <path d="M14 5H2v11h12V5Z" />
    <path d="M14 9h4l4 4v3h-8" />
    <circle cx="6" cy="19" r="2" />
    <circle cx="18" cy="19" r="2" />
  </S>
);

export const IconHelp = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.1 9a3 3 0 1 1 5.5 1.7c-.8.8-1.6 1.3-1.6 2.3M12 17h.01" />
  </S>
);

export const IconMail = (p: IconProps) => (
  <S {...p}>
    <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
    <path d="m3 7 9 7 9-7" />
  </S>
);

export const IconPhone = (p: IconProps) => (
  <S {...p}>
    <path d="M21 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 1.1 5.2 2 2 0 0 1 3.1 3h3a2 2 0 0 1 2 1.7c.1 1 .3 1.9.6 2.8a2 2 0 0 1-.5 2.1L7 10.8a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.8.6a2 2 0 0 1 1.7 2Z" />
  </S>
);

export const IconChef = (p: IconProps) => (
  <S {...p}>
    <path d="M6 13a4 4 0 1 1 1-7.9A5 5 0 0 1 17 5a4 4 0 1 1 1 8H6Z" />
    <path d="M6 13v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5" />
    <path d="M9 17h6" />
  </S>
);

export const IconStore = (p: IconProps) => (
  <S {...p}>
    <path d="M3 9 4 4h16l1 5" />
    <path d="M4 9v11h16V9" />
    <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
    <path d="M9 20v-5h6v5" />
  </S>
);

export const IconLeaf = (p: IconProps) => (
  <S {...p}>
    <path d="M11 20A7 7 0 0 1 4 13c0-5 4-9 11-11 0 7-2 11-7 13" />
    <path d="M2 22c0-3 1-9 11-9" />
  </S>
);

export const IconCalendar = (p: IconProps) => (
  <S {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </S>
);

export const IconUsers = (p: IconProps) => (
  <S {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 21v-1a6.5 6.5 0 0 1 13 0v1" />
    <path d="M16 4.2a3.5 3.5 0 0 1 0 6.6" />
    <path d="M21.5 21v-1a6 6 0 0 0-4-5.6" />
  </S>
);

// ===== Brand glyphs (filled) =====
export const IconBrandX = (p: IconProps) => (
  <svg viewBox="0 0 24 24" width={p.size ?? 20} height={p.size ?? 20} {...p}>
    <path fill="currentColor" d="M18.244 2H21.5l-7.34 8.39L23 22h-6.65l-5.2-6.81L4.96 22H1.7l7.86-8.98L1 2h6.83l4.7 6.21L18.24 2Zm-2.33 18h1.83L7.18 4H5.21l10.7 16Z" />
  </svg>
);

export const IconBrandLinkedIn = (p: IconProps) => (
  <svg viewBox="0 0 24 24" width={p.size ?? 20} height={p.size ?? 20} {...p}>
    <path fill="currentColor" d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14ZM8.4 18V10H5.8v8h2.6Zm-1.3-9.1a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM18.2 18v-4.4c0-2.4-1.3-3.5-3-3.5-1.4 0-2 .8-2.4 1.3V10H10.2v8h2.6v-4.4c0-.2 0-.5.1-.7.2-.5.7-1 1.4-1 1 0 1.4.8 1.4 1.9V18h2.5Z" />
  </svg>
);

export const IconBrandInstagram = (p: IconProps) => (
  <svg viewBox="0 0 24 24" width={p.size ?? 20} height={p.size ?? 20} {...p}>
    <path fill="currentColor" d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4 1 .5.4.8.8 1 1.4.2.4.4 1 .4 2.2.1 1.2.1 1.6.1 4.7s0 3.5-.1 4.7c-.1 1.2-.2 1.8-.4 2.2a3.7 3.7 0 0 1-1 1.4 3.7 3.7 0 0 1-1.4 1c-.4.2-1 .4-2.2.4-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4a3.7 3.7 0 0 1-1.4-1 3.7 3.7 0 0 1-1-1.4c-.2-.4-.4-1-.4-2.2-.1-1.2-.1-1.6-.1-4.7s0-3.5.1-4.7c.1-1.2.2-1.8.4-2.2.2-.6.5-1 1-1.4.4-.5.8-.8 1.4-1 .4-.2 1-.4 2.2-.4 1.2-.1 1.6-.1 4.8-.1ZM12 0C8.7 0 8.3 0 7.1.1 5.8.1 5 .3 4.2.6c-.8.3-1.5.7-2.2 1.4A6 6 0 0 0 .6 4.2C.3 5 .1 5.8 0 7c0 1.2-.1 1.6-.1 4.9 0 3.3 0 3.7.1 4.9.1 1.3.3 2.1.6 2.9.3.8.7 1.5 1.4 2.2a6 6 0 0 0 2.2 1.4c.8.3 1.6.5 2.9.6 1.2 0 1.6.1 4.9.1s3.7 0 4.9-.1c1.3-.1 2.1-.3 2.9-.6a6 6 0 0 0 2.2-1.4 6 6 0 0 0 1.4-2.2c.3-.8.5-1.6.6-2.9 0-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.1-1.3-.3-2.1-.6-2.9a6 6 0 0 0-1.4-2.2A6 6 0 0 0 19.8.6c-.8-.3-1.6-.5-2.9-.6C15.7 0 15.3 0 12 0Zm0 5.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.4-11.8a1.4 1.4 0 1 0 0 2.9 1.4 1.4 0 0 0 0-2.9Z" />
  </svg>
);

export const IconBrandFacebook = (p: IconProps) => (
  <svg viewBox="0 0 24 24" width={p.size ?? 20} height={p.size ?? 20} {...p}>
    <path fill="currentColor" d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.5V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
  </svg>
);

export const IconBrandYouTube = (p: IconProps) => (
  <svg viewBox="0 0 24 24" width={p.size ?? 20} height={p.size ?? 20} {...p}>
    <path fill="currentColor" d="M23.5 6.5a3 3 0 0 0-2.1-2.1C19.6 4 12 4 12 4s-7.6 0-9.4.4A3 3 0 0 0 .5 6.5C0 8.4 0 12 0 12s0 3.6.5 5.5a3 3 0 0 0 2.1 2.1C4.4 20 12 20 12 20s7.6 0 9.4-.4a3 3 0 0 0 2.1-2.1C24 15.6 24 12 24 12s0-3.6-.5-5.5ZM9.6 15.5V8.5l6.4 3.5-6.4 3.5Z" />
  </svg>
);

export const IconBrandApple = (p: IconProps) => (
  <svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22} {...p}>
    <path fill="currentColor" d="M16.4 12.7c0-2.6 2.1-3.9 2.2-4-1.2-1.7-3-2-3.7-2-1.6-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.3 2.6 1.3-.1 1.8-.9 3.4-.9s2 .9 3.4.9c1.4 0 2.3-1.2 3.1-2.5.7-1 1.2-2.1 1.5-3.1-.1-.1-2.7-1-2.7-3.7Zm-2.6-7.4c.7-.9 1.2-2 1-3.3-1 0-2.2.7-2.9 1.6-.7.8-1.2 1.9-1.1 3.1 1.2.1 2.3-.6 3-1.4Z" />
  </svg>
);

export const IconBrandGooglePlay = (p: IconProps) => (
  <svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22} {...p}>
    <path fill="#34A853" d="M3 3v18l9-9-9-9Z" />
    <path fill="#FBBC04" d="m12 12 9 5.5L13.5 21 3 21l9-9Z" opacity=".75" />
    <path fill="#EA4335" d="m12 12 9-5.5L13.5 3 3 3l9 9Z" opacity=".75" />
    <path fill="#4285F4" d="m12 12 6 3.5V8.5L12 12Z" />
  </svg>
);

// ===== Added UI glyphs (emoji replacements) =====
export const IconBriefcase = (p: IconProps) => (
  <S {...p}>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2 13h20" />
  </S>
);

export const IconBuilding = (p: IconProps) => (
  <S {...p}>
    <rect x="4" y="2" width="16" height="20" rx="1" />
    <path d="M9 22v-4h6v4M9 6h.01M15 6h.01M9 10h.01M15 10h.01M9 14h.01M15 14h.01" />
  </S>
);

export const IconLink = (p: IconProps) => (
  <S {...p}>
    <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  </S>
);

export const IconPrinter = (p: IconProps) => (
  <S {...p}>
    <path d="M6 9V2h12v7" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" rx="1" />
  </S>
);

export const IconLock = (p: IconProps) => (
  <S {...p}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </S>
);

export const IconAlertTriangle = (p: IconProps) => (
  <S {...p}>
    <path d="M12 3 2 20h20L12 3Z" />
    <path d="M12 9v5M12 17h.01" />
  </S>
);

export const IconGift = (p: IconProps) => (
  <S {...p}>
    <path d="M19 12v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8" />
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M12 8v14" />
    <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8M16.5 8a2.5 2.5 0 0 0 0-5C13 3 12 8 12 8" />
  </S>
);

export const IconWallet = (p: IconProps) => (
  <S {...p}>
    <rect x="3" y="6" width="18" height="14" rx="2" />
    <path d="M3 10h18" />
    <circle cx="16.5" cy="15" r="1.2" fill="currentColor" stroke="none" />
  </S>
);

export const IconRefresh = (p: IconProps) => (
  <S {...p}>
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    <path d="M3 21v-5h5" />
  </S>
);

export const IconEye = (p: IconProps) => (
  <S {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </S>
);

export const IconUtensils = (p: IconProps) => (
  <S {...p}>
    <path d="M4 3v7a2 2 0 0 0 4 0V3" />
    <path d="M6 12v9" />
    <path d="M17 3c-1.7 0-3 2-3 4.5S15.3 12 17 12v9" />
  </S>
);

// CaterKart logo icon — gradient stops mirror the Swiggy MCP hero palette
export const LogoMark = ({ size = 28, className = '' }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} className={className}>
    <defs>
      <linearGradient id="lk" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stopColor="#FF5200" />
        <stop offset="55%"  stopColor="#FF7A45" />
        <stop offset="100%" stopColor="#FFB088" />
      </linearGradient>
    </defs>
    <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill="url(#lk)" />
    <g fill="white" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11.5" cy="22" r="1.4" fill="white" />
      <circle cx="20" cy="22" r="1.4" fill="white" />
      <path d="M7 9h2.6l1.9 8.5a1.7 1.7 0 0 0 1.7 1.3h7.6a1.7 1.7 0 0 0 1.7-1.3l1.4-6.5H10.5" fill="none" />
    </g>
  </svg>
);

// Swiggy's own mark, used wherever a credit reads "powered by". It replaces
// the word "Swiggy" outright, so it carries its own accessible name: with the
// text gone, a bare image would leave screen readers saying "powered by" and
// nothing at all.
//
// The logo is a tall pin, so `size` sets the HEIGHT and the width follows the
// aspect ratio — matching it to the line height rather than squashing it into
// a square box.
export const SwiggyMark = ({
  size = 16,
  className = '',
  alt = 'Swiggy',
}: {
  size?: number;
  className?: string;
  /** Pass "" where the word "Swiggy" is already in the surrounding copy —
   *  otherwise "powered by <mark>" is announced as "powered by Swiggy Swiggy". */
  alt?: string;
}) => (
  <img
    src={swiggyLogo}
    alt={alt}
    aria-hidden={alt === '' ? true : undefined}
    height={size}
    style={{ height: size, width: 'auto' }}
    className={className}
    loading="lazy"
    decoding="async"
  />
);

// ===== Occasion glyphs (event-type icons) =====
export const IconCake = (p: IconProps) => (
  <S {...p}>
    <path d="M4 20v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7" />
    <path d="M3 20h18" />
    <path d="M4 15c1.2 1 2.6 1 4 0s2.8-1 4 0 2.8 1 4 0 2.8-1 4 0" />
    <path d="M12 11V8" />
    <path d="M12 3.5c1 1 1 2.3 0 3.2-1-.9-1-2.2 0-3.2Z" fill="currentColor" stroke="none" />
  </S>
);

export const IconGamepad = (p: IconProps) => (
  <S {...p}>
    <path d="M7 8h10a5 5 0 0 1 5 5 4 4 0 0 1-4 4c-1.4 0-2-.5-3-1.5l-.8-.8a1 1 0 0 0-.7-.3h-3a1 1 0 0 0-.7.3l-.8.8C8.9 16.5 8.4 17 7 17a4 4 0 0 1-4-4 5 5 0 0 1 5-5Z" />
    <path d="M7 11v3M5.5 12.5h3" />
    <circle cx="16" cy="11.5" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="18" cy="13.5" r="0.9" fill="currentColor" stroke="none" />
  </S>
);

export const IconFilm = (p: IconProps) => (
  <S {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
  </S>
);

export const IconTrophy = (p: IconProps) => (
  <S {...p}>
    <path d="M6 4h12v3a6 6 0 0 1-12 0V4Z" />
    <path d="M6 6H4a2 2 0 0 0 0 4h2.3M18 6h2a2 2 0 0 1 0 4h-2.3" />
    <path d="M12 13v4M8.5 21h7M10 21v-1.2a2 2 0 0 1 4 0V21" />
  </S>
);

export const IconPlane = (p: IconProps) => (
  <S {...p}>
    <path d="M21 3 3 10.6l6.2 2.2L11.4 19 21 3Z" />
    <path d="M9.2 12.8 21 3" />
  </S>
);

export const IconLantern = (p: IconProps) => (
  <S {...p}>
    <path d="M12 2v2.5M12 19.5V22" />
    <path d="M8 6.5h8" />
    <path d="M8.5 6.5c-1.4 2-1.4 6.5 0 9.5h7c1.4-3 1.4-7.5 0-9.5" />
    <path d="M7.5 16h9" />
    <path d="M12 11c.9-.7.9-1.8 0-2.4-.9.6-.9 1.7 0 2.4Z" fill="currentColor" stroke="none" />
  </S>
);
