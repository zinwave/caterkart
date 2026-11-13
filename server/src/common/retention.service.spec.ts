import { RetentionService } from './retention.service';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * A retention sweep that quietly stops working looks exactly like one that has
 * nothing to delete, so the behaviour is pinned here: what it removes, what it
 * must leave alone, and that one failing table does not cancel the others.
 */
describe('RetentionService', () => {
  const DAY = 86_400_000;

  function build(enabled = true) {
    const prisma = {
      invite: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
      orderEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 12 }) },
      celebration: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const config = {
      get: () => (enabled ? 'true' : 'false'),
    } as unknown as ConfigService;

    const service = new RetentionService(prisma as unknown as PrismaService, config);
    const log = service['log'];
    jest.spyOn(log, 'log').mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(log, 'error').mockImplementation(() => undefined);
    return { service, prisma, errorSpy };
  }

  it('deletes expired invites once their grace period is up', async () => {
    const { service, prisma } = build();
    await service.sweep();

    const where = prisma.invite.deleteMany.mock.calls[0][0].where;
    const cutoff = where.expiresAt.lt.getTime();

    // Roughly 7 days ago — the grace period that keeps "this invite expired"
    // answerable instead of "not found".
    expect(Date.now() - cutoff).toBeGreaterThan(6.5 * DAY);
    expect(Date.now() - cutoff).toBeLessThan(7.5 * DAY);
  });

  /**
   * The whole point: an invite row is a live-looking bearer token. It must not
   * survive on the grounds that the celebration is still open.
   */
  it('deletes expired invites regardless of celebration state', async () => {
    const { service, prisma } = build();
    await service.sweep();

    expect(Object.keys(prisma.invite.deleteMany.mock.calls[0][0].where)).toEqual(['expiresAt']);
  });

  it('only sweeps celebrations that have actually finished', async () => {
    const { service, prisma } = build();
    await service.sweep();

    const where = prisma.celebration.deleteMany.mock.calls[0][0].where;
    expect(where.status.in).toEqual(['COMPLETED', 'FAILED']);
    // Live work is never swept, however old the row is.
    expect(where.status.in).not.toContain('PLANNING');
    expect(where.status.in).not.toContain('IN_FLIGHT');
    expect(where.status.in).not.toContain('PLACING');
  });

  it('keeps finished celebrations for a year', async () => {
    const { service, prisma } = build();
    await service.sweep();

    const cutoff = prisma.celebration.deleteMany.mock.calls[0][0].where.updatedAt.lt.getTime();
    expect(Date.now() - cutoff).toBeGreaterThan(364 * DAY);
  });

  it('carries on when one table fails, and says which', async () => {
    const { service, prisma, errorSpy } = build();
    prisma.invite.deleteMany.mockRejectedValue(new Error('deadlock detected'));

    await expect(service.sweep()).resolves.toBeUndefined();

    // The other two still ran.
    expect(prisma.orderEvent.deleteMany).toHaveBeenCalled();
    expect(prisma.celebration.deleteMany).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('invites'));
  });

  it('does nothing at all when the sweep is switched off', async () => {
    const { service, prisma } = build(false);
    await service.sweep();

    expect(prisma.invite.deleteMany).not.toHaveBeenCalled();
    expect(prisma.celebration.deleteMany).not.toHaveBeenCalled();
  });
});
