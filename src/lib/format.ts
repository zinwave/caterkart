// Indian-rupee formatting helpers shared across the corporate console.

/** ₹1,23,456 — grouped in the Indian numbering system, no decimals. */
export function inr(rupees: number): string {
  return '₹' + Math.round(rupees).toLocaleString('en-IN');
}

/** Compact form for KPIs — ₹1.2L, ₹60k, ₹450. */
export function inrCompact(rupees: number): string {
  const n = Math.round(rupees);
  if (n >= 100000) return '₹' + (n / 100000).toFixed(n % 100000 === 0 ? 0 : 1) + 'L';
  if (n >= 1000) return '₹' + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k';
  return '₹' + n;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
