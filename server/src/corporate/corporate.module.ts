import { Module } from '@nestjs/common';
import { CorporateController } from './corporate.controller';
import { CorporateService } from './corporate.service';
import { CorporateStore, InMemoryCorporateStore } from './corporate.store';
import { SwiggyModule } from '../swiggy/swiggy.module';

/**
 * CaterKart for Work. All logic lives here; the frontend is a thin client.
 *
 * Mock mode uses the in-memory store. To go durable, implement a
 * PrismaCorporateStore and swap the `useClass` below — nothing else changes.
 */
@Module({
  imports: [SwiggyModule], // FoodService — the reconciliation-safe MCP food flow
  controllers: [CorporateController],
  providers: [
    CorporateService,
    InMemoryCorporateStore,
    { provide: CorporateStore, useExisting: InMemoryCorporateStore },
  ],
  exports: [CorporateService],
})
export class CorporateModule {}
