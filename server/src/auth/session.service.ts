import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';

export const SESSION_COOKIE = 'ck_session';

interface SessionPayload {
  /** User.id */
  uid: string;
  /** issued-at / expiry, seconds since epoch */
  iat: number;
  exp: number;
}

/**
 * The app's own session, separate from the Swiggy grant.
 *
 * A signed cookie rather than a bearer token in localStorage: the token is
 * httpOnly, so a script injected into the page cannot read it and mint requests
 * that place real food orders on someone's Swiggy account.
 *
 * Signed, not encrypted — the payload is a user id and two timestamps, none of
 * it secret. What matters is that it cannot be forged, which is what replaced
 * the `x-user-id` header this used to trust.
 */
@Injectable()
export class SessionService {
  private readonly log = new Logger(SessionService.name);

  constructor(private readonly config: ConfigService) {}

  private get secret(): string {
    const s = this.config.get<string>('secrets.appJwtSecret') ?? '';
    // A default-valued secret in production means every session is forgeable by
    // anyone who has read the repository. Fail at the first issue rather than
    // silently accepting it.
    if (this.config.get<string>('nodeEnv') === 'production' && (!s || s === 'dev-secret')) {
      throw new Error('APP_JWT_SECRET must be set in production (openssl rand -hex 32)');
    }
    return s || 'dev-secret';
  }

  /** Mint a session token for a user. */
  issue(userId: string): string {
    const ttlDays = this.config.get<number>('session.ttlDays', 30);
    const now = Math.floor(Date.now() / 1000);
    const payload: SessionPayload = { uid: userId, iat: now, exp: now + ttlDays * 86400 };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${body}.${this.sign(body)}`;
  }

  /** The user id in a token, or null if absent, malformed, forged or expired. */
  verify(token: string | undefined): string | null {
    if (!token) return null;
    const dot = token.lastIndexOf('.');
    if (dot <= 0) return null;

    const body = token.slice(0, dot);
    const sig = token.slice(dot + 1);

    const expected = Buffer.from(this.sign(body));
    const actual = Buffer.from(sig);
    // Length check first: timingSafeEqual throws on a length mismatch.
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
      if (!payload.uid || typeof payload.exp !== 'number') return null;
      if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
      return payload.uid;
    } catch {
      return null;
    }
  }

  /**
   * Attach the session cookie to a response.
   *
   * No `domain`: the cookie stays host-only on the API's own hostname, which is
   * where every XHR goes anyway. `caterkart.in` and `api.caterkart.in` share a
   * registrable domain, so those requests are same-site and SameSite=Lax lets
   * the cookie through — while a genuinely cross-site page cannot use it.
   */
  attach(res: Response, userId: string): void {
    const isProd = this.config.get<string>('nodeEnv') === 'production';
    res.cookie(SESSION_COOKIE, this.issue(userId), {
      httpOnly: true,
      secure: isProd, // dev runs on http://localhost
      sameSite: 'lax',
      path: '/',
      maxAge: this.config.get<number>('session.ttlDays', 30) * 86400 * 1000,
    });
  }

  clear(res: Response): void {
    const isProd = this.config.get<string>('nodeEnv') === 'production';
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
    });
  }

  private sign(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }
}

/** Pull one cookie out of a raw Cookie header. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}
