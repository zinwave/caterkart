import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The authorization check for everything hanging off a celebration.
 *
 * It exists as one shared service — rather than a copy of the same two lines in
 * each feature service — because this is precisely the check that used to be
 * missing. Every route under `/api/celebrations/:id` took the id straight from
 * the path and acted on it: an anonymous caller could read any party's guest
 * list with their phone numbers, add ₹5,000 of food to a stranger's order for
 * the host to pay for, mint an invite link that browses menus on the host's
 * Swiggy grant, or mark settlement shares paid. One function, called on every
 * path, is the only version of this that stays true as routes are added.
 *
 * It answers with 404, never 403. A 403 confirms the celebration exists, which
 * turns id enumeration into a working oracle; to someone who is not the host,
 * a celebration they may not touch is indistinguishable from one that is not
 * there.
 */
@Injectable()
export class CelebrationAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** The celebration, if this user hosts it. Throws 404 otherwise. */
  async assertHost(celebrationId: string, userId: string) {
    const celebration = await this.prisma.celebration.findUnique({
      where: { id: celebrationId },
      select: { id: true, hostId: true, status: true, swiggyAddressId: true },
    });
    if (!celebration || celebration.hostId !== userId) {
      throw new NotFoundException('celebration not found');
    }
    return celebration;
  }

  /**
   * Resolve a settlement share to the celebration that owns it, and assert the
   * caller hosts that celebration.
   *
   * Marking a share paid is addressed by share id alone, which belongs to no
   * URL namespace the host controls — so the ownership edge has to be walked
   * back from the share itself rather than trusted from the path.
   */
  async assertHostOfShare(shareId: string, userId: string) {
    const share = await this.prisma.settlementShare.findUnique({
      where: { id: shareId },
      select: { id: true, settlement: { select: { celebrationId: true } } },
    });
    if (!share) throw new NotFoundException('share not found');
    await this.assertHost(share.settlement.celebrationId, userId);
    return { shareId: share.id, celebrationId: share.settlement.celebrationId };
  }

  /**
   * Resolve a sub-order to its celebration and assert the caller hosts it.
   *
   * The sub-order id arrives nested under a celebration id in the path, but
   * those two are independent inputs: without this, passing your own
   * celebration id alongside somebody else's sub-order id would delete theirs.
   */
  async assertHostOfSubOrder(celebrationId: string, subOrderId: string, userId: string) {
    await this.assertHost(celebrationId, userId);
    const sub = await this.prisma.subOrder.findUnique({
      where: { id: subOrderId },
      select: { id: true, celebrationId: true },
    });
    if (!sub || sub.celebrationId !== celebrationId) {
      throw new NotFoundException('sub-order not found on this celebration');
    }
    return sub;
  }
}
