// API base URL.
//
// CaterBox used to be its own service on its own host. It is now part of the
// single API, served from /api/ck/*, so it shares VITE_API_BASE with the rest
// of the app — there is no separate CaterBox host to configure any more.
export const api_base = `${import.meta.env.VITE_API_BASE || 'http://localhost:4000'}/api/ck`;

export const verify_api_base = `${api_base}/verify`;
export const order_api_base = `${api_base}/order`;
export const food_api_base = `${api_base}/food`;
export const services_api_base = `${api_base}/services`;
export const combos_api_base = `${api_base}/combos`;
export const vendors_api_base = `${api_base}/vendors`;
export const admins_api_base = `${api_base}/admins`;
export const pincodes_api_base = `${api_base}/pincodes`;
export const reviews_api_base = `${api_base}/reviews`;
export const subscriptions_api_base = `${api_base}/subscriptions`;
export const payments_api_base = `${api_base}/payments`;
