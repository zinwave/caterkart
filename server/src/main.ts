import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { JsonLogger } from './common/json-logger';
import { validateEnvironment } from './config/env.validation';

async function bootstrap() {
  // Before Nest builds anything: refuse to start a production process that is
  // missing a secret it needs, rather than discovering it at checkout.
  validateEnvironment();

  const isProd = process.env.NODE_ENV === 'production';

  // `rawBody` is required by the Razorpay webhook, which verifies an HMAC over
  // the exact bytes received — a parsed-and-restringified body will not match.
  // Typed as an Express app so body-parser limits and the proxy setting can be
  // applied without losing that raw-body capture.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
    logger: new JsonLogger(isProd),
  });
  const config = app.get(ConfigService);

  /**
   * Trust exactly the proxies that actually sit in front of this process.
   *
   * In production that is Caddy, one hop, on the same Docker network — the API
   * publishes no host port, so Caddy is the only thing that can reach it. Until
   * this was set, `req.ip` was Caddy's container address for EVERY request, and
   * the rate limiters bucketed the entire internet together: the 3-per-minute
   * OTP cap became three SMS per minute for all customers combined.
   *
   * The count matters. Trusting more hops than exist lets a client prepend its
   * own X-Forwarded-For entry and choose the address it is rate-limited by, so
   * this is deliberately NOT `true`, and defaults to 0 outside production where
   * there is no proxy at all.
   */
  const trustedHops = parseInt(process.env.TRUST_PROXY_HOPS ?? (isProd ? '1' : '0'), 10);
  app.set('trust proxy', trustedHops);

  // Order and combo payloads are small; reject anything larger outright.
  const bodyLimit = config.get<string>('BODY_LIMIT', '1mb');
  app.useBodyParser('json', { limit: bodyLimit });
  app.useBodyParser('urlencoded', { limit: bodyLimit, extended: true });

  app.use(
    helmet({
      // CSP is off: this process serves JSON, not HTML. The SPA is served by
      // CloudFront, which carries its own policy.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: false,
      // Tell browsers to stay on HTTPS for a year once they have seen it, so a
      // later http:// link cannot be stripped into a plaintext session.
      hsts: isProd ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
      // The default `no-referrer` would also strip the Referer from the Swiggy
      // OAuth redirect; same-origin keeps it where it is ours to read.
      referrerPolicy: { policy: 'same-origin' },
    }),
  );

  app.setGlobalPrefix('api', { exclude: ['auth/swiggy/callback'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      // Validation messages name fields, which is useful to a client and fine
      // to expose; they must not quote the submitted VALUES back, because those
      // get written to logs and error trackers (card-adjacent data, addresses).
      validationError: { target: false, value: false },
    }),
  );

  // One envelope, one place that decides what an error is allowed to reveal.
  app.useGlobalFilters(new AllExceptionsFilter());

  // Reflect the configured web origin, plus any localhost/127.0.0.1 port (Vite
  // often falls back from 5173 → 5174…), and allow non-browser callers (no
  // Origin header). Reflecting the exact origin is required for credentialed
  // requests — a wildcard '*' is rejected by the browser when credentials:'include'.
  const webOrigin = config.get<string>('WEB_ORIGIN', 'http://localhost:5173');
  app.enableCors({
    origin: (origin, cb) => {
      // In production the allowlist is exactly the configured web origin.
      // Reflecting any localhost port is a development convenience (Vite falls
      // back 5173 → 5174…), and with `credentials: true` it would otherwise let
      // a page served from the user's own machine make authenticated calls.
      const ok =
        !origin ||
        origin === webOrigin ||
        (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
      cb(null, ok);
    },
    credentials: true,
    // Let the browser read the correlation id, so a client-side error report
    // can quote the id that identifies the failure in our logs.
    exposedHeaders: ['x-request-id'],
  });

  /**
   * Run onModuleDestroy hooks on SIGTERM.
   *
   * Without this, a deploy kills the process outright: pooled Swiggy MCP
   * sessions are never closed, Prisma never drains, and any BullMQ job that was
   * mid-placement is abandoned without recording what it had already done.
   */
  app.enableShutdownHooks();

  const port = config.get<number>('PORT', 4000);
  await app.listen(port);
  new Logger('Bootstrap').log(
    `CaterKart API on :${port} — Swiggy MCP at /api/*, CaterBox at /api/ck/*, health at /api/health`,
  );
}

bootstrap().catch((err) => {
  // NestFactory.create rejects on a bad module graph or a failed env check.
  // Print it plainly and exit non-zero so the orchestrator restarts (or, for a
  // config error, stops) instead of leaving a dead container reported healthy.
  new Logger('Bootstrap').error(`Failed to start: ${(err as Error)?.message}`, (err as Error)?.stack);
  process.exit(1);
});
