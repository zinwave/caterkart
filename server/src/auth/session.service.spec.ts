import { SessionService } from './session.service';
import type { ConfigService } from '@nestjs/config';

/**
 * The session cookie is the only thing naming whose Swiggy grant the backend
 * will spend. These tests pin that it cannot be forged, replayed past expiry,
 * or signed with a known default in production.
 */
describe('SessionService', () => {
  const SECRET = 'a'.repeat(64);

  const configWith = (values: Record<string, unknown>) =>
    ({ get: (key: string, fallback?: unknown) => values[key] ?? fallback }) as unknown as ConfigService;

  const build = (over: Record<string, unknown> = {}) =>
    new SessionService(
      configWith({ 'secrets.appJwtSecret': SECRET, nodeEnv: 'test', 'session.ttlDays': 30, ...over }),
    );

  it('round-trips the user it issued a token for', () => {
    const sessions = build();
    expect(sessions.verify(sessions.issue('user_1'))).toBe('user_1');
  });

  it('rejects a token whose payload was edited', () => {
    const sessions = build();
    const token = sessions.issue('user_1');
    const [, signature] = token.split('.');

    const forged = `${Buffer.from(JSON.stringify({ uid: 'user_2', iat: 0, exp: 9e9 })).toString('base64url')}.${signature}`;

    expect(sessions.verify(forged)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const mine = build();
    const theirs = build({ 'secrets.appJwtSecret': 'b'.repeat(64) });

    expect(mine.verify(theirs.issue('user_1'))).toBeNull();
  });

  it('rejects an expired token', () => {
    const sessions = build({ 'session.ttlDays': -1 });
    expect(sessions.verify(sessions.issue('user_1'))).toBeNull();
  });

  it.each([undefined, '', 'not-a-token', '.', 'a.b.c', Buffer.from('{}').toString('base64url')])(
    'rejects malformed input (%p) without throwing',
    (input) => {
      expect(build().verify(input as string | undefined)).toBeNull();
    },
  );

  /**
   * A default secret in production means every session is forgeable by anyone
   * who has read the repository, so this must fail loudly rather than serve.
   */
  it('refuses to sign with the development default in production', () => {
    const sessions = build({ nodeEnv: 'production', 'secrets.appJwtSecret': 'dev-secret' });
    expect(() => sessions.issue('user_1')).toThrow(/APP_JWT_SECRET/);
  });

  it('marks the cookie Secure only in production', () => {
    const cookie = jest.fn();
    build({ nodeEnv: 'production' }).attach({ cookie } as never, 'user_1');
    expect(cookie.mock.calls[0][2]).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax' });

    const devCookie = jest.fn();
    build().attach({ cookie: devCookie } as never, 'user_1');
    expect(devCookie.mock.calls[0][2]).toMatchObject({ httpOnly: true, secure: false });
  });
});
