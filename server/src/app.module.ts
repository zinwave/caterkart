import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { EventsModule } from './events/events.module';
import { AuthModule } from './auth/auth.module';
import { SessionMiddleware } from './auth/session.middleware';
import { McpModule } from './mcp/mcp.module';
import { SwiggyModule } from './swiggy/swiggy.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { SettlementModule } from './settlement/settlement.module';
import { InvitesModule } from './invites/invites.module';
import { CelebrationsModule } from './celebrations/celebrations.module';
import { CelebrationAccessModule } from './celebrations/celebration-access.module';
import { CorporateModule } from './corporate/corporate.module';
import { CaterboxModule } from './caterbox/caterbox.module';
import { HealthModule } from './health/health.module';
import { CommonModule } from './common/common.module';
import { RequestContextMiddleware } from './common/request-context';
import { HttpLoggerMiddleware, UserContextMiddleware } from './common/http-logger.middleware';

// The BullMQ/Redis-backed placement + tracking queues power the celebration
// orchestration flow. They're opt-in: mock-mode and the CaterKart-for-Work
// console run without Redis, so we don't register the queues (and their
// reconnecting Redis clients) unless ENABLE_QUEUES=true.
const QUEUES_ENABLED = process.env.ENABLE_QUEUES === 'true';

/**
 * CaterKart for Work — mounted only when explicitly switched on.
 *
 * The module is a working prototype, not a shipped feature: its store is an
 * in-memory object seeded at boot (nothing survives a restart) and its routes
 * take the acting employee from an `?as=` query parameter instead of a session,
 * so anyone who can reach them can read invoices and rewrite company billing
 * details. The frontend already hides every entry point behind SHOW_WORK=false.
 *
 * Hiding links is not the same as closing routes, so the routes are now closed
 * too: `/api/work/*` simply does not exist unless ENABLE_WORK=true, which is how
 * it can keep being developed locally without being exposed in production.
 * Delete this flag when the module gets real authentication and real storage.
 */
const WORK_ENABLED = process.env.ENABLE_WORK === 'true';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),

    /**
     * Rate limiting, declared once for the whole API.
     *
     * It lives here rather than inside CaterBox because the guard it registers
     * is global: hanging the configuration off one feature module made the
     * Swiggy half's protection an accident of CaterBox's import list.
     *
     * ONE bucket, deliberately. Every throttler named here is evaluated on
     * every route, so a second, tighter definition would not be "available for
     * the sensitive routes" — it would cap the entire API at its limit. Routes
     * that need something stricter narrow this same bucket with
     * `@Throttle({ default: { ... } })`, which replaces it for that handler.
     *
     * 300/min is a generous ceiling that only stops scripted abuse: browsing a
     * menu legitimately fires many requests in a burst.
     *
     * Correctness here depends on `trust proxy` in main.ts. Without it every
     * caller shares one bucket and this becomes a global cap.
     */
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),

    // In-process cron. Currently one job: sweeping abandoned OAuth handshakes
    // (AuthService.sweepExpiredFlows). Unlike the BullMQ queues this needs no
    // Redis, so it is always on.
    ScheduleModule.forRoot(),

    ...(QUEUES_ENABLED
      ? [
          BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
              const url = new URL(config.get<string>('redisUrl', 'redis://localhost:6379'));
              return {
                connection: {
                  host: url.hostname,
                  port: Number(url.port || 6379),
                  password: url.password || undefined,
                },
              };
            },
          }),
          SchedulerModule,
        ]
      : []),
    PrismaModule,
    // Nightly deletion of personal data past its retention window.
    CommonModule,
    // Global: the celebration ownership check, injectable wherever a
    // celebration id is handled. Declared before the modules that use it.
    CelebrationAccessModule,
    EventsModule,
    AuthModule,
    McpModule,
    SwiggyModule,
    SettlementModule,
    InvitesModule,
    CelebrationsModule,
    ...(WORK_ENABLED ? [CorporateModule] : []),
    // CaterBox — the own-kitchen half, served from /api/ck/* by the same
    // process. See caterbox/caterbox.module.ts for how routes, auth and
    // storage were reconciled.
    CaterboxModule,
    // Declared after CaterBox: the readiness probe checks the Mongo connection
    // that module establishes.
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  /**
   * The per-request pipeline, in the order it has to run.
   *
   *   1. RequestContext — opens the async-local scope holding the request id.
   *      Everything downstream logs into it, so it must be first.
   *   2. HttpLogger     — registers the finish handler that writes the access
   *      line. Registered early so it still fires for requests a later
   *      middleware rejects.
   *   3. Session        — verifies the signed cookie and resolves the app user.
   *   4. UserContext    — copies that user into the logging scope, so every
   *      later line is attributable. Must follow Session.
   *
   * Session resolution is middleware rather than a per-route guard because the
   * failure mode of forgetting a guard is an unauthenticated endpoint. This
   * resolves identity for everything and lets `@CurrentUser()` (required) and
   * `@OptionalUser()` (nullable) decide what to do with it.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestContextMiddleware, HttpLoggerMiddleware, SessionMiddleware, UserContextMiddleware)
      // '*path' is the Express 5 / path-to-regexp v8 spelling of "everything".
      // A bare '*' still works through Nest's legacy converter, but only with a
      // deprecation warning on every boot — and on a compatibility shim, which
      // is not what the session pipeline should depend on.
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
