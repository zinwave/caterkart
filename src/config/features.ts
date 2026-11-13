// =====================================================
// Feature visibility.
//
// These hide entry points only. The routes, pages, state and API behind them
// are untouched and keep working — /work and /addons can still be opened
// directly, and every flow still functions. Flipping a flag back to `true`
// restores the links with no other change.
// =====================================================

/**
 * CaterKart for Work — the corporate console (cost centres, per-head caps,
 * consolidated GST invoices). Hidden from the landing page, the footer and the
 * profile menu; /work and everything under it still resolve.
 */
export const SHOW_WORK = false;

/**
 * The landing page's standalone "Add to any order" showcase — the grid of live
 * counters, artists, décor and games. Hidden: those are configured inside the
 * CaterBox flow, so the section was a second front door to the same thing.
 */
export const SHOW_ADDONS_SECTION = false;

/**
 * The Instamart step inside the celebration flow (guests → cart → add-ons →
 * confirm), where plates, cups, ice and candles get picked.
 *
 * Separate from the showcase above, and deliberately ON: the restaurants card
 * advertises Instamart add-ons, so the step it promises has to exist. Turning
 * this off reroutes the cart straight to confirm rather than dead-ending.
 */
export const SHOW_INSTAMART_STEP = true;

/** Where the cart continues. */
export const AFTER_CART = SHOW_INSTAMART_STEP ? '/addons' : '/confirm';
/** Where confirm's back-link goes. */
export const BEFORE_CONFIRM = SHOW_INSTAMART_STEP ? '/addons' : '/group';
