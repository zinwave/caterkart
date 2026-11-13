import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../caterbox/auth/decorators';

type Check = 'ok' | 'down';

/**
 * Liveness and readiness, kept apart on purpose.
 *
 * `/live` answers "is this process wedged?" and touches nothing else — if it
 * checked the database, a brief Postgres blip would make the orchestrator kill
 * and restart every healthy container, turning a recoverable outage into one.
 *
 * `/ready` answers "should this process receive traffic?" and does check the
 * stores, because a container that cannot reach them serves nothing but 500s
 * and should be pulled out of rotation until it can.
 */
@Public()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectConnection() private readonly mongo: Connection,
  ) {}

  @Get()
  live(): { status: string; uptime: number } {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }

  @Get('ready')
  async ready(): Promise<{ status: string; checks: Record<string, Check> }> {
    const [postgres, mongo] = await Promise.all([this.checkPostgres(), this.checkMongo()]);
    const checks = { postgres, mongo };

    if (Object.values(checks).some((c) => c === 'down')) {
      // 503 with the detail attached: the body tells an operator WHICH store is
      // down without them having to go read the logs first.
      throw new ServiceUnavailableException({ status: 'degraded', checks });
    }
    return { status: 'ok', checks };
  }

  private async checkPostgres(): Promise<Check> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch (err) {
      this.logger.warn(`postgres health check failed: ${(err as Error).message}`);
      return 'down';
    }
  }

  private async checkMongo(): Promise<Check> {
    try {
      // readyState 1 === connected. `db.admin().ping()` would also work but
      // allocates a round trip on a path that runs every few seconds.
      if (this.mongo.readyState !== 1) return 'down';
      await this.mongo.db?.admin().ping();
      return 'ok';
    } catch (err) {
      this.logger.warn(`mongo health check failed: ${(err as Error).message}`);
      return 'down';
    }
  }
}
