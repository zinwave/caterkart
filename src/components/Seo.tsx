import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_IMAGE,
  DEFAULT_TITLE,
  SITE_NAME,
  SITE_URL,
  isNoindexPath,
} from '../lib/seo';

interface SeoProps {
  /** Page title. The brand suffix is appended unless this is the home page. */
  title?: string;
  description?: string;
  /** Route path, e.g. "/caterbox". Defaults to the current location. */
  path?: string;
  image?: string;
  type?: string;
  /**
   * Force noindex. Usually unnecessary — any path matching NOINDEX_PREFIXES is
   * excluded automatically, so a new private route is private by default rather
   * than by remembering to say so.
   */
  noindex?: boolean;
  jsonLd?: object | object[];
}

/**
 * Per-route meta for JavaScript-executing crawlers and in-app navigations.
 *
 * The static tags in index.html are what a non-JS crawler and every link
 * preview read; this refines them once the app has booted and the user has
 * navigated somewhere specific.
 *
 * The important behaviour is the default: `noindex` is derived from the path,
 * not passed in. `/invite/:token` carries the guest's only credential in the
 * URL, so an indexed one is a leaked credential — and that must not depend on
 * whoever adds the next private route remembering a prop. robots.txt disallows
 * the same prefixes; this is the belt to that's braces, for a crawler that
 * reached the URL from a link rather than from the root.
 */
export default function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  image = DEFAULT_IMAGE,
  type = 'website',
  noindex,
  jsonLd,
}: SeoProps) {
  const location = useLocation();
  const pathname = path ?? location.pathname;

  const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
  const canonical = `${SITE_URL}${pathname === '/' ? '/' : pathname}`;
  const hidden = noindex ?? isNoindexPath(pathname);
  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta
        name="robots"
        content={hidden ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'}
      />
      {/*
        A canonical on a noindex page is a contradictory signal, and on a
        token-bearing URL it would publish the token into the one tag crawlers
        are most likely to store. Omitted entirely for those.
      */}
      {hidden ? null : <link rel="canonical" href={canonical} />}

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_IN" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      {hidden ? null : <meta property="og:url" content={canonical} />}
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={`${SITE_NAME} — party catering in Bangalore`} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {blocks.map((block, i) => (
        <script type="application/ld+json" key={i}>
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  );
}
