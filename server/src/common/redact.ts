/**
 * Scrubbing for anything that goes into a log line or an error report.
 *
 * Logs are the quiet leak. They are retained far longer than the data they
 * describe, replicated to a shipper, and readable by people who have no reason
 * to see a customer's address — and nobody notices, because nothing breaks.
 * Two kinds of value get scrubbed here:
 *
 *   CREDENTIALS — access and refresh tokens, PKCE verifiers, authorization
 *   codes, signatures. An OAuth error body can echo back the very parameters
 *   that were sent, so logging a failed token exchange verbatim can write a
 *   live credential to disk.
 *
 *   PERSONAL DATA — names, phone numbers, email addresses, delivery addresses
 *   and coordinates. Swiggy's payloads are full of them, and the debugging
 *   value is in the SHAPE of a response, not in whose address it carried.
 */

/** Keys whose values are never useful in a log and often harmful. */
const SENSITIVE_KEYS = new Set([
  // Credentials
  'access_token', 'accesstoken', 'refresh_token', 'refreshtoken', 'id_token',
  'token', 'code', 'code_verifier', 'codeverifier', 'client_secret', 'clientsecret',
  'authorization', 'password', 'secret', 'signature', 'apikey', 'api_key',
  // Personal data
  'phone', 'phonenumber', 'mobile', 'email', 'name', 'displayname', 'customername',
  'address', 'addressline', 'addressline1', 'addressline2', 'street', 'landmark',
  'flatno', 'houseno', 'pincode', 'postalcode', 'lat', 'lng', 'latitude', 'longitude',
  'upi', 'vpa', 'contact',
]);

const REDACTED = '[redacted]';

/** Free-text patterns, for strings that never went through a key at all. */
const PATTERNS: Array<[RegExp, string]> = [
  [/\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[jwt]'],
  [/\bBearer\s+[A-Za-z0-9._~+/-]{8,}=*/gi, 'Bearer [redacted]'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  [/\b(?:\+?91[-\s]?)?[6-9]\d{9}\b/g, '[phone]'],
];

/**
 * A log-safe version of a value.
 *
 * Recurses through objects and arrays, blanking sensitive keys and masking
 * patterns in the strings that remain. `depth` and `maxLength` bound the work:
 * a log call must never be the slow part of a request, and a deeply nested or
 * self-referential payload must not be able to stall it.
 */
export function redact(value: unknown, depth = 6): unknown {
  if (value == null) return value;

  if (typeof value === 'string') return maskString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth <= 0) return '[truncated]';

  if (Array.isArray(value)) {
    // A long array tells you nothing a short one does not.
    return value.slice(0, 20).map((v) => redact(v, depth - 1));
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.has(key.toLowerCase().replace(/[_-]/g, ''))
        ? REDACTED
        : redact(v, depth - 1);
    }
    return out;
  }

  return String(value);
}

/** A bounded, scrubbed JSON rendering — what to put in a log line. */
export function redactToString(value: unknown, maxLength = 600): string {
  let out: string;
  try {
    out = JSON.stringify(redact(value)) ?? String(value);
  } catch {
    // Circular, or a throwing getter. The shape is lost but the line survives.
    out = '[unserializable]';
  }
  return out.length > maxLength ? `${out.slice(0, maxLength)}…[truncated]` : out;
}

/** Mask credentials and personal data inside a free-text string. */
export function maskString(input: string): string {
  let out = input;
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement);
  return out;
}

/**
 * The last 4 digits of a phone number, for a log line that has to identify a
 * customer at all. Enough to match against a support ticket, useless on its own.
 */
export function maskPhone(phone: string | undefined | null): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? `••••${digits.slice(-4)}` : '[phone]';
}
