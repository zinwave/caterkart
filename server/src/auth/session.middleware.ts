import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { SESSION_COOKIE, SessionService, readCookie } from './session.service';

/** Request augmented with the verified app user, if any. */
export interface AuthedRequest extends Request {
  ckUserId?: string | null;
}

/**
 * Verifies the session cookie once per request and hangs the result off the
 * request, so `@CurrentUser()` is a plain property read.
 *
 * Middleware rather than a guard: a guard would have to be applied (or
 * deliberately not applied) on every route, and the failure mode of forgetting
 * one is an unauthenticated endpoint. This resolves identity for everything and
 * lets each decorator decide whether it is required.
 */
@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(private readonly sessions: SessionService) {}

  use(req: AuthedRequest, _res: Response, next: NextFunction): void {
    req.ckUserId = this.sessions.verify(readCookie(req.headers.cookie, SESSION_COOKIE));
    next();
  }
}
