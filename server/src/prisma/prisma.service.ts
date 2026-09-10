import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(PrismaService.name);

  async onModuleInit() {
    // Tolerant boot: mock-mode features (e.g. CaterKart for Work, in-memory) run
    // without Postgres. Don't crash the whole app if the DB isn't up — features
    // that actually touch Prisma surface their own errors on use.
    try {
      await this.$connect();
    } catch (err) {
      this.log.warn(`Prisma could not connect (${String(err)}). Continuing — DB-backed features unavailable.`);
    }
  }
  async onModuleDestroy() {
    await this.$disconnect().catch(() => undefined);
  }
}
