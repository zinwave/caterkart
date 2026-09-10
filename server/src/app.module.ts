import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
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
import { CorporateModule } from './corporate/corporate.module';

// The BullMQ/Redis-backed placement + tracking queues power the celebration
// orchestration flow. They're opt-in: mock-mode and the CaterKart-for-Work
// console run without Redis, so we don't register the queues (and their
// reconnecting Redis clients) unless ENABLE_QUEUES=true.
const QUEUES_ENABLED = process.env.ENABLE_QUEUES === 'true';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
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
    EventsModule,
    AuthModule,
    McpModule,
    SwiggyModule,
    SettlementModule,
    InvitesModule,
    CelebrationsModule,
    CorporateModule,
  ],
})
export class AppModule implements NestModule {
  /**
   * Resolve the app session for every request before it reaches a controller.
   *
   * Applied here rather than as a per-route guard: forgetting a guard leaves an
   * endpoint unauthenticated, whereas this resolves identity everywhere and lets
   * `@CurrentUser()` (required) and `@OptionalUser()` (nullable) decide.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessionMiddleware).forRoutes('*');
  }
}
