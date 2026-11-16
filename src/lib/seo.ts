/**
 * One source of truth for everything a crawler — human-facing or AI — reads.
 *
 * `index.html`, `robots.txt`, `sitemap.xml`, `llms.txt` and the per-route <Seo>
 * component all derive from the constants here. They used to disagree: the Seo
 * component declared `https://www.caterkart.in` canonical while the CloudFront
 * distribution 301s www → apex, so every canonical tag pointed at a URL that
 * immediately redirected away — which splits ranking signals between two hosts
 * and is one of the few SEO mistakes that actively costs you positions.
 */

/** The apex. CloudFront 301s www → here, so this is what canonicals must say. */
export const SITE_URL = 'https://caterkart.in';

export const SITE_NAME = 'CaterKart';

export const DEFAULT_TITLE = 'CaterKart — Party Catering & Meal Boxes in Bangalore';

export const DEFAULT_DESCRIPTION =
  'CaterKart plans the whole party: order from any Swiggy restaurant for a group, let every guest pick their own dish from one shared link, and have it all arrive together. Plus CaterBox meal boxes, cooked to order by our FSSAI-licensed partner kitchens, for birthdays, house parties and office lunches in Bangalore.';

export const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

export const ORGANIZATION = {
  legalName: 'CaterKart',
  areaServed: 'Bengaluru, Karnataka, India',
  email: 'hello@caterkart.in',
} as const;

/**
 * Routes that must NEVER be indexed.
 *
 * Two different reasons, and the first is a security control, not an SEO
 * preference:
 *
 *   BEARER URLS — `/invite/:token` and `/work/join/:token` carry the only
 *   credential a guest holds. Indexed, the token becomes public and anyone can
 *   read the guest list and browse menus on the host's Swiggy grant. These are
 *   excluded from the sitemap, marked noindex, AND disallowed in robots.txt.
 *
 *   PRIVATE OR THIN PAGES — carts, checkouts, order history and the ops
 *   console have nothing to offer a searcher and would dilute the crawl budget
 *   that should go to the pages that do.
 */
export const NOINDEX_PREFIXES = [
  '/invite',
  '/confirm',
  '/group',
  '/addons',
  '/event',
  '/settle',
  '/orders',
  '/checkout',
  '/create-menu',
  '/track-order',
  '/admin',
  '/vendor',
  '/work',
  '/login',
] as const;

/** Should this path be kept out of the index? */
export function isNoindexPath(pathname: string): boolean {
  return NOINDEX_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * The public, indexable surface — and the sitemap's contents.
 *
 * `changefreq`/`priority` are advisory at best these days; `lastmod` is the one
 * signal Google still acts on, so it is generated at build time rather than
 * hand-maintained and left to rot.
 */
export const PUBLIC_ROUTES: Array<{ path: string; priority: number; changefreq: string }> = [
  { path: '/', priority: 1.0, changefreq: 'weekly' },
  { path: '/caterbox', priority: 0.9, changefreq: 'weekly' },
  { path: '/our-kitchen', priority: 0.7, changefreq: 'monthly' },
  { path: '/about', priority: 0.6, changefreq: 'monthly' },
  { path: '/contact', priority: 0.7, changefreq: 'monthly' },
  { path: '/privacy-policy', priority: 0.3, changefreq: 'yearly' },
  { path: '/terms', priority: 0.3, changefreq: 'yearly' },
  { path: '/refund-policy', priority: 0.3, changefreq: 'yearly' },
  { path: '/shipping-policy', priority: 0.3, changefreq: 'yearly' },
  { path: '/cookie-policy', priority: 0.3, changefreq: 'yearly' },
  { path: '/grievance-redressal', priority: 0.3, changefreq: 'yearly' },
];

// ── Structured data ─────────────────────────────────────────────────────────
// Schema.org JSON-LD. This is what produces rich results in search, and it is
// also the most reliable thing an LLM reads off a page: it is unambiguous,
// typed, and does not depend on the model inferring meaning from prose.

export const organizationJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  legalName: ORGANIZATION.legalName,
  url: SITE_URL,
  logo: { '@type': 'ImageObject', url: `${SITE_URL}/favicon.svg` },
  email: ORGANIZATION.email,
  areaServed: { '@type': 'City', name: 'Bengaluru' },
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Bengaluru',
    addressRegion: 'KA',
    addressCountry: 'IN',
  },
});

export const websiteJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: SITE_URL,
  publisher: { '@id': `${SITE_URL}/#organization` },
  inLanguage: 'en-IN',
});

/** The catering service itself, which is what a local search actually matches. */
export const serviceJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'FoodEstablishment',
  '@id': `${SITE_URL}/#business`,
  name: SITE_NAME,
  url: SITE_URL,
  servesCuisine: ['North Indian', 'South Indian', 'Chinese', 'Continental'],
  priceRange: '₹₹',
  areaServed: { '@type': 'City', name: 'Bengaluru' },
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Bengaluru',
    addressRegion: 'KA',
    addressCountry: 'IN',
  },
  makesOffer: [
    {
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: 'Group ordering for parties',
        description:
          'Order from any Swiggy restaurant for a group. Every guest picks their own dish from one shared link, and the orders are timed to arrive together.',
      },
    },
    {
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: 'CaterBox meal boxes',
        description:
          'Individually packed meal boxes, cooked to a CaterKart menu by FSSAI-licensed partner kitchens, for office lunches, birthdays and house parties in Bangalore.',
      },
    },
  ],
});

/** A breadcrumb trail, which search results render in place of a raw URL. */
export const breadcrumbJsonLd = (trail: Array<{ name: string; path: string }>) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: trail.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.name,
    item: `${SITE_URL}${item.path}`,
  })),
});

/**
 * FAQ data, in the one shape that both search engines and chat assistants
 * reliably extract.
 *
 * Deliberately phrased as the questions a person actually types or asks aloud
 * — "how do I order food for a party" rather than "group ordering solutions" —
 * because that is what a retrieval step matches against.
 */
export const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'How do I order food for a party where everyone wants something different?',
    a: 'Open a CaterKart celebration, share one link with your guests, and each person picks their own dish from real Swiggy menus. CaterKart groups the picks by restaurant and times each order so everything arrives together, instead of one guest ordering for everyone or five separate deliveries turning up an hour apart.',
  },
  {
    q: 'Do my guests need a Swiggy account or an app to join?',
    a: 'No. Guests open the link you share, enter their name, and pick their food in the browser. Only the host signs in with Swiggy. Guests never see your account and cannot place an order themselves.',
  },
  {
    q: 'What is a CaterBox meal box?',
    a: 'CaterBox is CaterKart’s meal-box service: individually packed boxes built from a menu you choose, cooked to our specification by FSSAI-licensed partner kitchens, and delivered for office lunches, birthdays and house parties across Bangalore. You configure the box, see live pricing, and pay an advance online.',
  },
  {
    q: 'Which areas does CaterKart deliver to?',
    a: 'CaterKart serves Bengaluru. Swiggy group orders are available wherever Swiggy delivers in the city; CaterBox meal boxes are delivered to serviceable pincodes, which you can check at checkout.',
  },
  {
    q: 'How does payment work?',
    a: 'Swiggy group orders are paid through Swiggy itself, on the host’s account, and CaterKart can split the bill afterwards with a UPI link for each guest. CaterBox orders are paid directly to CaterKart through Razorpay, usually as an advance with the balance on delivery.',
  },
  {
    q: 'How far ahead should I order?',
    a: 'Swiggy group orders are same-day and arrive in about an hour. CaterBox meal boxes are cooked to order, so place those at least a day ahead for small groups and earlier for large events.',
  },
];

export const faqJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
});
