import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export interface RequestContext {
  /** Correlates every log line, and the error envelope the client receives. */
  requestId: string;
  /** App-session user (Celebrations half), once SessionMiddleware has run. */
  userId?: string | null;
  method: string;
  path: string;
  startedAt: number;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** The context for the request currently being handled, if any. */
export function currentContext(): RequestContext | undefined {
  return storage.getStore();
}

export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

/** Header carrying the id in and out, so a trace spans the proxy and the client. */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Opens an async-local scope per request holding a stable request id.
 *
 * Every log line and every error response carries that id, which is what makes
 * a production incident traceable: a user reports "it failed with id abc123"
 * and the whole request — including work that happened in a promise chain long
 * after the handler returned — is one grep away.
 *
 * An inbound id is honoured so a trace started at the edge (Caddy, or a mobile
 * client) continues here rather than restarting, but it is sanitised first: it
 * is echoed back in a response header, and unvalidated header reflection is how
 * response-splitting and log-injection get in.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = sanitizeId(req.header(REQUEST_ID_HEADER)) ?? randomUUID();
    res.setHeader(REQUEST_ID_HEADER, requestId);

    const ctx: RequestContext = {
      requestId,
      method: req.method,
      // `originalUrl` minus the query string: query values carry addresses and
      // search terms, and logs are retained far longer than request bodies.
      path: req.originalUrl.split('?')[0],
      startedAt: Date.now(),
    };
    storage.run(ctx, () => next());
  }
}

/** Opaque, bounded, and free of anything that could break a header or a log line. */
function sanitizeId(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return /^[A-Za-z0-9_.:-]{8,128}$/.test(trimmed) ? trimmed : null;
}
