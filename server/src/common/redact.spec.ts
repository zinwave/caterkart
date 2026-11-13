import { maskPhone, maskString, redact, redactToString } from './redact';

/**
 * Logs outlive the data they describe. These tests pin that neither a live
 * credential nor a customer's personal data can reach one through the helpers
 * every log call is supposed to go through.
 */
describe('redact', () => {
  it('blanks credential-bearing keys', () => {
    const out = redact({
      access_token: 'ya29.live-token',
      refresh_token: 'rt_live',
      code_verifier: 'pkce-verifier',
      clientId: 'public-and-fine',
    }) as Record<string, unknown>;

    expect(out.access_token).toBe('[redacted]');
    expect(out.refresh_token).toBe('[redacted]');
    expect(out.code_verifier).toBe('[redacted]');
    // A public client id is not a secret and is useful when debugging.
    expect(out.clientId).toBe('public-and-fine');
  });

  it('blanks personal data on a Swiggy order payload', () => {
    const out = redact({
      orderId: 'ORD123',
      total: 840,
      customer: { name: 'Asha Menon', phone: '9876543210', email: 'asha@example.com' },
      deliveryTo: { addressLine: '12 MG Road', lat: 12.97, lng: 77.59, pincode: '560001' },
      address: { addressLine: '12 MG Road' },
    }) as Record<string, any>;

    // What is useful for debugging survives.
    expect(out.orderId).toBe('ORD123');
    expect(out.total).toBe(840);

    // Identifying fields are blanked wherever they are nested.
    expect(out.customer).toEqual({
      name: '[redacted]',
      phone: '[redacted]',
      email: '[redacted]',
    });
    expect(out.deliveryTo).toEqual({
      addressLine: '[redacted]',
      lat: '[redacted]',
      lng: '[redacted]',
      pincode: '[redacted]',
    });

    // A key that is itself sensitive takes its whole subtree with it, so no
    // field inside it has to be enumerated to be covered.
    expect(out.address).toBe('[redacted]');
  });

  it('masks personal data in a string value under a harmless key', () => {
    const out = redact({ note: 'call Asha on 9876543210 or asha@example.com' }) as Record<string, string>;

    expect(out.note).not.toContain('9876543210');
    expect(out.note).not.toContain('asha@example.com');
  });

  it('masks credentials and personal data loose in a string', () => {
    const line = maskString(
      'POST failed for asha@example.com / 9876543210 with Authorization: Bearer abc123def456ghi',
    );

    expect(line).not.toContain('asha@example.com');
    expect(line).not.toContain('9876543210');
    expect(line).not.toContain('abc123def456ghi');
  });

  it('masks a JWT wherever it appears', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJ1aWQiOiJ1c2VyXzEifQ.c2lnbmF0dXJlX2hlcmU';
    expect(maskString(`token=${jwt}`)).toBe('token=[jwt]');
  });

  it('bounds the output so a log call is never the slow part', () => {
    const huge = { items: Array.from({ length: 5000 }, (_, i) => ({ id: i, name: `item ${i}` })) };
    expect(redactToString(huge, 200).length).toBeLessThanOrEqual(220);
  });

  it('survives a circular structure instead of throwing inside a logger', () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    expect(() => redactToString(circular)).not.toThrow();
  });

  it('keeps only enough of a phone number to match a support ticket', () => {
    expect(maskPhone('+91 98765 43210')).toBe('••••3210');
    expect(maskPhone(undefined)).toBe('[phone]');
  });
});
