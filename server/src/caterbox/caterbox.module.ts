import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OTPModule } from './otp/otp.module';
import { OrdersModule } from './orders/orders.moudle';
import { FoodModule } from './food/food.module';
import { ServicesModule } from './services/services.module';
import { CombosModule } from './combos/combos.module';
import { VendorsModule } from './vendors/vendors.module';
import { AdminsModule } from './admins/admins.module';
import { PincodesModule } from './pincodes/pincodes.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PaymentsModule } from './payments/payments.module';
import { DatabaseModule } from './database/database.module';
import { PricingModule } from './pricing/pricing.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';

/**
 * CaterBox — the own-kitchen commerce half of the product: catalogue, orders,
 * pricing, GST invoicing, Razorpay payments, vendors, subscriptions.
 *
 * It was a standalone Nest service (caterkart-api) and is now a module of the
 * single API. Three things had to be reconciled in the merge:
 *
 *  1. ROUTES — every controller here is namespaced under `ck/`, so with the
 *     app's global `api` prefix the surface is /api/ck/*. The Swiggy and
 *     Celebrations routes keep /api/*. One service, two unambiguous surfaces.
 *
 *  2. AUTH — this half authenticates with a Bearer JWT over a phone+OTP
 *     identity (staff AND customers), while the other half uses a cookie
 *     session. The guards below are registered app-wide so a new CaterBox
 *     controller is protected by default, and JwtAuthGuard stands aside for
 *     anything outside /api/ck rather than 401-ing the Swiggy routes.
 *
 *  3. STORAGE — Mongo lives alongside Prisma/Postgres. Not an accident: the
 *     bespoke, every-event-differs quote documents here want flexible schemas,
 *     while corporate invoicing wants immutable typed rows. Collapsing one into
 *     the other is a separate decision, not a prerequisite for one deploy.
 */
@Module({
  imports: [
    OTPModule,
    OrdersModule,
    FoodModule,
    ServicesModule,
    CombosModule,
    VendorsModule,
    AdminsModule,
    PincodesModule,
    ReviewsModule,
    SubscriptionsModule,
    PaymentsModule,
    DatabaseModule,
    PricingModule,
    AuthModule,

    // Pool + timeout + retry + compression tuned for a small, resilient,
    // cost-predictable Atlas connection. All overridable via env.
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const num = (key: string, fallback: number) =>
          Number(configService.get<string>(key)) || fallback;
        return {
          uri: configService.get<string>('MONGO_URI'),
          dbName: configService.get<string>('MONGO_DB_NAME'),
          maxPoolSize: num('MONGO_MAX_POOL', 10),
          minPoolSize: num('MONGO_MIN_POOL', 0),
          maxIdleTimeMS: num('MONGO_MAX_IDLE_MS', 60_000),
          serverSelectionTimeoutMS: num('MONGO_SERVER_SELECTION_MS', 8_000),
          socketTimeoutMS: num('MONGO_SOCKET_TIMEOUT_MS', 45_000),
          connectTimeoutMS: num('MONGO_CONNECT_TIMEOUT_MS', 10_000),
          heartbeatFrequencyMS: num('MONGO_HEARTBEAT_MS', 30_000),
          retryWrites: true,
          retryReads: true,
          compressors: ['zlib'],
          zlibCompressionLevel: 6,
        };
      },
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Rate limiting is declared in AppModule (it guards the whole API, not just
    // this half). These two run after it: authenticate, then authorize.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class CaterboxModule {}
