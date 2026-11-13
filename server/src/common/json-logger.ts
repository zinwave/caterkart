import { ConsoleLogger, LoggerService, LogLevel } from '@nestjs/common';
import { currentContext } from './request-context';

/**
 * Structured logging for production, pretty logging for a terminal.
 *
 * In production every line is one JSON object on stdout, which is what a log
 * shipper (CloudWatch, Loki, Datadog) can actually index — Nest's default
 * colourised format has to be regex-scraped, and the escape codes corrupt the
 * field values when it is. Locally the default stays, because a human reads it.
 *
 * Both paths stamp the current request id, so lines emitted from deep inside a
 * service — or from a promise that settles after the response was sent — still
 * join up with the request that caused them.
 */
export class JsonLogger extends ConsoleLogger implements LoggerService {
  constructor(private readonly json: boolean) {
    super();
  }

  log(message: unknown, ...rest: unknown[]): void {
    this.emit('info', message, rest, () => super.log(message as string, ...(rest as string[])));
  }

  error(message: unknown, ...rest: unknown[]): void {
    this.emit('error', message, rest, () => super.error(message as string, ...(rest as string[])));
  }

  warn(message: unknown, ...rest: unknown[]): void {
    this.emit('warn', message, rest, () => super.warn(message as string, ...(rest as string[])));
  }

  debug(message: unknown, ...rest: unknown[]): void {
    this.emit('debug', message, rest, () => super.debug(message as string, ...(rest as string[])));
  }

  verbose(message: unknown, ...rest: unknown[]): void {
    this.emit('verbose', message, rest, () => super.verbose(message as string, ...(rest as string[])));
  }

  private emit(level: LogLevel | 'info', message: unknown, rest: unknown[], pretty: () => void): void {
    if (!this.json) {
      pretty();
      return;
    }

    // Nest passes the context (the class name) as the LAST argument, with any
    // stack trace before it. Peel them apart rather than stringifying the lot.
    const args = [...rest];
    const context = typeof args[args.length - 1] === 'string' ? (args.pop() as string) : undefined;
    const stack = args.find((a) => typeof a === 'string') as string | undefined;

    const ctx = currentContext();
    const line = {
      level,
      time: new Date().toISOString(),
      context,
      message: typeof message === 'string' ? message : safeStringify(message),
      ...(stack ? { stack } : {}),
      ...(ctx
        ? { requestId: ctx.requestId, method: ctx.method, path: ctx.path, userId: ctx.userId ?? undefined }
        : {}),
    };

    // One write, one line: a partially-flushed multi-line record is an
    // unparseable record, and stdout is shared with every other logger.
    process.stdout.write(`${safeStringify(line)}\n`);
  }
}

/** Never let a circular object or a throwing getter take the process down. */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
