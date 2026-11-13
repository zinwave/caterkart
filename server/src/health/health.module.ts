import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * PrismaService arrives from the global PrismaModule and the Mongoose
 * connection from the root MongooseModule, so this module only has to supply
 * the controller.
 */
@Module({ controllers: [HealthController] })
export class HealthModule {}
