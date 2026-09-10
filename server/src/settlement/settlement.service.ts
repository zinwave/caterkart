import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { SettleDto } from '../celebrations/dto';

interface Contribution {
  subOrderId: string;
  amount: number;
}

/**
 * App-side bill splitting. Swiggy is COD-only with no split payment, so one
 * member pays cash at the door and the rest repay via a UPI deeplink we mint.
 *
 *  EQUAL   — total split evenly (remainder distributed to the first members).
 *  BY_ITEM — food lines tagged with a memberId go to that member; untagged food
 *            lines and all Instamart supplies are shared equally.
 */
@Injectable()
export class SettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async settle(celebrationId: string, dto: SettleDto) {
    const c = await this.prisma.celebration.findUnique({
      where: { id: celebrationId },
      include: { members: true, subOrders: true },
    });
    if (!c) throw new NotFoundException('celebration not found');

    const memberIds = c.members.map((m) => m.id);
    const total = c.subOrders.reduce((s, so) => s + so.subtotal, 0);

    const perMember: Record<string, Contribution[]> = {};
    memberIds.forEach((id) => (perMember[id] = []));

    if (dto.mode === 'EQUAL') {
      for (const so of c.subOrders) {
        this.splitEqually(so.id, so.subtotal, memberIds, perMember);
      }
    } else {
      for (const so of c.subOrders) {
        if (so.kind === 'FOOD') {
          const lines = (so.lines as Array<{ qty: number; unitPrice: number; memberId?: string }>) ?? [];
          const tagged = lines.filter((l) => l.memberId && memberIds.includes(l.memberId));
          const untaggedTotal = lines
            .filter((l) => !l.memberId || !memberIds.includes(l.memberId!))
            .reduce((s, l) => s + l.qty * l.unitPrice, 0);
          for (const l of tagged) {
            this.add(perMember, l.memberId!, so.id, l.qty * l.unitPrice);
          }
          if (untaggedTotal > 0) this.splitEqually(so.id, untaggedTotal, memberIds, perMember);
        } else {
          // Shared supplies → split equally.
          this.splitEqually(so.id, so.subtotal, memberIds, perMember);
        }
      }
    }

    // Rebuild settlement rows.
    await this.prisma.settlement.deleteMany({ where: { celebrationId } });
    const settlement = await this.prisma.settlement.create({
      data: {
        celebrationId,
        mode: dto.mode,
        total,
        cashCollectedBy: dto.cashCollectedBy,
        shares: {
          create: c.members.map((m) => {
            const contributions = perMember[m.id] ?? [];
            const amount = contributions.reduce((s, x) => s + x.amount, 0);
            const owesCollector = !!dto.cashCollectedBy && m.id !== dto.cashCollectedBy && amount > 0;
            return {
              memberId: m.id,
              amount,
              contributions: contributions as any,
              upiLink: owesCollector ? this.upiLink(dto.collectorVpa, c.occasion, amount, c.members.find((x) => x.id === dto.cashCollectedBy)?.name) : null,
            };
          }),
        },
      },
      include: { shares: true },
    });

    this.events.emit({ celebrationId, type: 'settlement.updated', payload: settlement });
    return settlement;
  }

  async markPaid(shareId: string) {
    const share = await this.prisma.settlementShare.update({
      where: { id: shareId },
      data: { paid: true, paidAt: new Date() },
      include: { settlement: true },
    });
    this.events.emit({ celebrationId: share.settlement.celebrationId, type: 'settlement.updated', payload: { shareId, paid: true } });
    return share;
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  private splitEqually(subOrderId: string, amount: number, memberIds: string[], acc: Record<string, Contribution[]>) {
    const n = memberIds.length || 1;
    const base = Math.floor(amount / n);
    let remainder = amount - base * n;
    for (const id of memberIds) {
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      this.add(acc, id, subOrderId, base + extra);
    }
  }

  private add(acc: Record<string, Contribution[]>, memberId: string, subOrderId: string, amount: number) {
    if (amount <= 0) return;
    (acc[memberId] ??= []).push({ subOrderId, amount });
  }

  /** upi://pay deeplink — opens any UPI app prefilled to repay the collector. */
  private upiLink(vpa: string | undefined, occasion: string, amount: number, payeeName?: string): string | null {
    if (!vpa) return null;
    const p = new URLSearchParams({
      pa: vpa,
      pn: payeeName ?? 'CaterKart host',
      am: amount.toFixed(2),
      cu: 'INR',
      tn: `CaterKart ${occasion}`.slice(0, 50),
    });
    return `upi://pay?${p.toString()}`;
  }
}
