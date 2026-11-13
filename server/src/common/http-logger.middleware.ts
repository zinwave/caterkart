import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { currentContext } from './request-context';

/** Paths whose success is pure noise — health probes fire every few seconds. */
const QUIET = /^\/api\/(health|ck\/health-check)/;

/**
 * One access-log line per completed request.
 *
 * Logged on `finish`, not on entry, so the line carries the status and the
 * duration — an entry-time log tells you a request arrived, which is the half
 * of the story you already knew.
 *
 * Only the method, path, status and duration are recorded. Query strings and
 * bodies are deliberately absent: they hold delivery addresses, phone numbers,
 * OTPs and coupon codes, and access logs outlive the data they describe.
 */
@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const startedAt = Date.now();

    res.on('finish', () => {
      const path = req.originalUrl.split('?')[0];
      const ms = Date.now() - startedAt;
      // Health probes still get logged when they FAIL — that is the one time
      // they matter.
      if (QUIET.test(path) && res.statusCode < 400) return;

      const line = `${req.method} ${path} ${res.statusCode} ${ms}ms`;
      if (res.statusCode >= 500) this.logger.error(line);
      else if (res.statusCode >= 400) this.logger.warn(line);
      else this.logger.log(line);
    });

    next();
  }
}

/**
 * Attaches the authenticated user to the logging context.
 *
 * Runs after SessionMiddleware, so every later log line for this request — and
 * the access line above — can be attributed to an account without each service
 * having to pass the id down into its own logger calls.
 */
@Injectable()
export class UserContextMiddleware implements NestMiddleware {
  use(req: Request & { ckUserId?: string | null }, _res: Response, next: NextFunction): void {
    const ctx = currentContext();
    if (ctx) ctx.userId = req.ckUserId ?? null;
    next();
  }
}
