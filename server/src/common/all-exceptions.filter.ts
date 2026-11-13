import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { NeedsReauthError, PlacementFailedError, ToolError } from '../mcp/mcp.errors';
import { currentRequestId } from './request-context';

/** What the client gets. Identical shape for every failure, success or not. */
interface ErrorBody {
  statusCode: number;
  /** Stable, machine-readable. Clients branch on this, never on `message`. */
  code: string;
  message: string | string[];
  requestId?: string;
  timestamp: string;
}

/**
 * The single exit point for every error leaving the API.
 *
 * Two jobs, and the second is the security-relevant one:
 *
 *  1. Give clients ONE envelope with a stable `code`, so the frontend branches
 *     on a constant rather than regex-matching prose that changes.
 *
 *  2. Decide what the outside world is allowed to learn. Anything unrecognised
 *     becomes a flat 500 "Internal server error" — no stack, no driver text, no
 *     SQL, no record ids. Prisma and Mongo errors in particular carry column
 *     names, constraint names and sometimes the offending values, which hand an
 *     attacker the schema for free. The real detail is logged server-side
 *     against the request id, which is the only thing the client is told.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    // A streaming response (SSE) may already be mid-flight; headers are gone and
    // writing a JSON body would corrupt the stream. Just end it.
    if (res.headersSent) {
      this.logError(exception, req, 500);
      res.end();
      return;
    }

    const { status, code, message } = this.classify(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logError(exception, req, status);
    } else if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
      // Authorization failures are the signal in an intrusion investigation, so
      // they are logged even though they are not server faults.
      this.logger.warn(`${req.method} ${req.originalUrl} -> ${status} ${code}`);
    }

    const body: ErrorBody = {
      statusCode: status,
      code,
      message,
      requestId: currentRequestId(),
      timestamp: new Date().toISOString(),
    };
    res.status(status).json(body);
  }

  private classify(exception: unknown): { status: number; code: string; message: string | string[] } {
    // ── Swiggy MCP domain errors ────────────────────────────────────────────
    if (exception instanceof NeedsReauthError) {
      // The error's own message embeds the internal user id — never echo it.
      return {
        status: HttpStatus.UNAUTHORIZED,
        code: 'SWIGGY_REAUTH_REQUIRED',
        message: 'Your Swiggy session has expired. Reconnect to continue.',
      };
    }
    if (exception instanceof ToolError) {
      // Swiggy's refusal reason is written for a human ("Add ₹610 more to avail
      // this offer") and is the whole point of surfacing it.
      return { status: HttpStatus.UNPROCESSABLE_ENTITY, code: 'SWIGGY_REFUSED', message: exception.reason };
    }
    if (exception instanceof PlacementFailedError) {
      return {
        status: HttpStatus.BAD_GATEWAY,
        code: 'PLACEMENT_FAILED',
        message: 'We could not confirm this order with Swiggy. Check your Swiggy orders before retrying.',
      };
    }

    // ── Nest / validation ───────────────────────────────────────────────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        return { status, code: codeFor(status), message: payload };
      }
      const obj = payload as Record<string, unknown>;
      return {
        status,
        code: typeof obj.code === 'string' ? obj.code : codeFor(status),
        message: (obj.message as string | string[]) ?? exception.message,
      };
    }

    // ── Prisma ──────────────────────────────────────────────────────────────
    // Mapped by code only. `err.message` is multi-line and quotes the model and
    // field names, so it is logged and never returned.
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2025':
          return { status: HttpStatus.NOT_FOUND, code: 'NOT_FOUND', message: 'Not found.' };
        case 'P2002':
          return { status: HttpStatus.CONFLICT, code: 'ALREADY_EXISTS', message: 'That already exists.' };
        case 'P2003':
          return { status: HttpStatus.BAD_REQUEST, code: 'INVALID_REFERENCE', message: 'Invalid reference.' };
        default:
          break;
      }
    }
    if (
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientRustPanicError
    ) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Service temporarily unavailable. Please try again.',
      };
    }

    // ── Mongo / Mongoose ────────────────────────────────────────────────────
    const name = (exception as { name?: string })?.name;
    if (name === 'CastError' || name === 'ValidationError') {
      return { status: HttpStatus.BAD_REQUEST, code: 'INVALID_INPUT', message: 'Invalid request.' };
    }
    if ((exception as { code?: number })?.code === 11000) {
      return { status: HttpStatus.CONFLICT, code: 'ALREADY_EXISTS', message: 'That already exists.' };
    }
    if (name === 'MongoNetworkError' || name === 'MongooseServerSelectionError') {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Service temporarily unavailable. Please try again.',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    };
  }

  private logError(exception: unknown, req: Request, status: number): void {
    const err = exception as Error;
    this.logger.error(
      `${req.method} ${req.originalUrl.split('?')[0]} -> ${status}: ${err?.message ?? String(exception)}`,
      err?.stack,
    );
  }
}

function codeFor(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'INVALID_INPUT';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHENTICATED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'ALREADY_EXISTS';
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'UNPROCESSABLE';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    case HttpStatus.SERVICE_UNAVAILABLE:
      return 'SERVICE_UNAVAILABLE';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED';
  }
}
