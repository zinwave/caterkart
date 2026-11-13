import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Deletes personal data once it has stopped being useful.
 *
 * Nothing here was deleting anything. Guest names, phone numbers, email
 * addresses, dietary requirements, delivery addresses and live invite tokens
 * accumulated for the life of the database, long after the party they belonged
 * to was over. That is a straightforward data-minimisation failure under the
 * DPDP Act — personal data may be kept only as long as the purpose it was
 * collected for lasts — and it steadily enlarges the blast radius of any future
 * breach for no operational benefit.
 *
 * The windows below are deliberately generous. A host may legitimately look
 * back at an old celebration; nobody needs a four-year-old guest list.
 */

/** Spent invites. The token is a bearer credential, so this one is urgent. */
const EXPIRED_INVITE_GRACE_DAYS = 7;

/** Completed or failed celebrations, with their members, picks and settlements. */
const CELEBRATION_RETENTION_DAYS = 365;

/** Per-sub-order tracking events. Pure operational telemetry, not a record. */
const ORDER_EVENT_RETENTION_DAYS = 90;

const DAY_MS = 86_400_000;

@Injectable()
export class RetentionService {
  private readonly log = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Runs nightly, off the hour.
   *
   * 03:17 rather than 03:00 so it does not start in the same second as every
   * other cron on the box, and at night because the deletes take row locks on
   * tables the ordering path reads.
   */
  @Cron('17 3 * * *')
  async sweep(): Promise<void> {
    if (this.config.get<string>('RETENTION_SWEEP_ENABLED') === 'false') {
      this.log.log('retention sweep disabled by configuration');
      return;
    }

    const results = await Promise.allSettled([
      this.sweepExpiredInvites(),
      this.sweepOldOrderEvents(),
      this.sweepOldCelebrations(),
    ]);

    // Reported per task: one failing sweep must not hide the other two, and a
    // sweep that silently stops running is how data piles up unnoticed.
    results.forEach((r, i) => {
      const name = ['invites', 'order events', 'celebrations'][i];
      if (r.status === 'rejected') {
        this.log.error(`retention sweep failed for ${name}: ${String(r.reason)}`);
      }
    });
  }

  /**
   * Expired invites.
   *
   * These hold a live-looking token that authorises reading a guest list and
   * browsing menus on the host's Swiggy grant. `findValid` already refuses an
   * expired one, so the row has no function after expiry — it is purely a
   * credential sitting in a table waiting to be read.
   *
   * The grace period exists so a guest who clicks a day-old link still gets
   * "this invite expired" rather than "not found", which is a materially
   * clearer thing to tell them.
   */
  private async sweepExpiredInvites(): Promise<void> {
    const cutoff = new Date(Date.now() - EXPIRED_INVITE_GRACE_DAYS * DAY_MS);
    const { count } = await this.prisma.invite.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });
    if (count) this.log.log(`retention: deleted ${count} expired invite token(s)`);
  }

  /** Raw MCP tracking payloads. Useful for a week, noise after a quarter. */
  private async sweepOldOrderEvents(): Promise<void> {
    const cutoff = new Date(Date.now() - ORDER_EVENT_RETENTION_DAYS * DAY_MS);
    const { count } = await this.prisma.orderEvent.deleteMany({
      where: { at: { lt: cutoff } },
    });
    if (count) this.log.log(`retention: deleted ${count} order event(s)`);
  }

  /**
   * Finished celebrations and everything hanging off them.
   *
   * Members, picks, sub-orders, settlements and invites all cascade from
   * Celebration (onDelete: Cascade in schema.prisma), so deleting the parent
   * removes the guest list and its personal data in one statement rather than
   * leaving orphans behind.
   *
   * Only terminal states are swept. A celebration still PLANNING or IN_FLIGHT
   * is live work regardless of its age.
   */
  private async sweepOldCelebrations(): Promise<void> {
    const cutoff = new Date(Date.now() - CELEBRATION_RETENTION_DAYS * DAY_MS);
    const { count } = await this.prisma.celebration.deleteMany({
      where: {
        updatedAt: { lt: cutoff },
        status: { in: ['COMPLETED', 'FAILED'] },
      },
    });
    if (count) this.log.log(`retention: deleted ${count} celebration(s) past retention`);
  }
}
