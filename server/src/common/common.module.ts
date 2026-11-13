import { Module } from '@nestjs/common';
import { RetentionService } from './retention.service';

/**
 * Infrastructure that is not a feature. Currently the nightly data-retention
 * sweep, which has no HTTP surface and is reached only by its cron trigger.
 *
 * CryptoService deliberately stays in AuthModule: it is only meaningful
 * alongside the OAuth grant it encrypts.
 */
@Module({ providers: [RetentionService] })
export class CommonModule {}
