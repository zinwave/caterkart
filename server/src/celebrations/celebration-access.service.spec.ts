import { NotFoundException } from '@nestjs/common';
import { CelebrationAccessService } from './celebration-access.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * These tests exist because this service is the only thing standing between a
 * celebration and anyone who knows its id. Every assertion below corresponds to
 * something that was previously possible against the live API.
 */
describe('CelebrationAccessService', () => {
  const HOST = 'user_host';
  const STRANGER = 'user_stranger';
  const CELEBRATION = 'celeb_1';

  function build(overrides: Record<string, unknown> = {}) {
    const prisma = {
      celebration: { findUnique: jest.fn() },
      settlementShare: { findUnique: jest.fn() },
      subOrder: { findUnique: jest.fn() },
      ...overrides,
    };
    return { prisma, service: new CelebrationAccessService(prisma as unknown as PrismaService) };
  }

  describe('assertHost', () => {
    it('returns the celebration to its host', async () => {
      const { prisma, service } = build();
      prisma.celebration.findUnique.mockResolvedValue({
        id: CELEBRATION,
        hostId: HOST,
        status: 'PLANNING',
        swiggyAddressId: 'addr_1',
      });

      await expect(service.assertHost(CELEBRATION, HOST)).resolves.toMatchObject({ id: CELEBRATION });
    });

    it('refuses a signed-in user who is not the host', async () => {
      const { prisma, service } = build();
      prisma.celebration.findUnique.mockResolvedValue({ id: CELEBRATION, hostId: HOST });

      await expect(service.assertHost(CELEBRATION, STRANGER)).rejects.toBeInstanceOf(NotFoundException);
    });

    /**
     * 404 and not 403, deliberately: a 403 would confirm the id is real, which
     * is all an enumeration attack needs.
     */
    it('reports a forbidden celebration exactly like a missing one', async () => {
      const { prisma, service } = build();

      prisma.celebration.findUnique.mockResolvedValue({ id: CELEBRATION, hostId: HOST });
      const forbidden = await service.assertHost(CELEBRATION, STRANGER).catch((e) => e);

      prisma.celebration.findUnique.mockResolvedValue(null);
      const missing = await service.assertHost('celeb_does_not_exist', STRANGER).catch((e) => e);

      expect(forbidden).toBeInstanceOf(NotFoundException);
      expect(missing).toBeInstanceOf(NotFoundException);
      expect(forbidden.getStatus()).toBe(missing.getStatus());
      expect(forbidden.message).toBe(missing.message);
    });
  });

  describe('assertHostOfShare', () => {
    it('resolves a share through to its celebration', async () => {
      const { prisma, service } = build();
      prisma.settlementShare.findUnique.mockResolvedValue({
        id: 'share_1',
        settlement: { celebrationId: CELEBRATION },
      });
      prisma.celebration.findUnique.mockResolvedValue({ id: CELEBRATION, hostId: HOST });

      await expect(service.assertHostOfShare('share_1', HOST)).resolves.toEqual({
        shareId: 'share_1',
        celebrationId: CELEBRATION,
      });
    });

    it("refuses to clear a share on someone else's celebration", async () => {
      const { prisma, service } = build();
      prisma.settlementShare.findUnique.mockResolvedValue({
        id: 'share_1',
        settlement: { celebrationId: CELEBRATION },
      });
      prisma.celebration.findUnique.mockResolvedValue({ id: CELEBRATION, hostId: HOST });

      await expect(service.assertHostOfShare('share_1', STRANGER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('assertHostOfSubOrder', () => {
    /**
     * The celebration id and the sub-order id are independent path segments.
     * Pairing one you own with one you do not must not work.
     */
    it('refuses a sub-order that belongs to a different celebration', async () => {
      const { prisma, service } = build();
      prisma.celebration.findUnique.mockResolvedValue({ id: CELEBRATION, hostId: HOST });
      prisma.subOrder.findUnique.mockResolvedValue({ id: 'sub_1', celebrationId: 'celeb_other' });

      await expect(
        service.assertHostOfSubOrder(CELEBRATION, 'sub_1', HOST),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('accepts a sub-order on the host’s own celebration', async () => {
      const { prisma, service } = build();
      prisma.celebration.findUnique.mockResolvedValue({ id: CELEBRATION, hostId: HOST });
      prisma.subOrder.findUnique.mockResolvedValue({ id: 'sub_1', celebrationId: CELEBRATION });

      await expect(service.assertHostOfSubOrder(CELEBRATION, 'sub_1', HOST)).resolves.toMatchObject({
        id: 'sub_1',
      });
    });
  });
});
