import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { FoodService } from '../swiggy/food.service';
import { EventsService } from '../events/events.service';
import {
  AddFoodSubOrderDto,
  AddInstamartSubOrderDto,
  CreateCelebrationDto,
} from './dto';

@Injectable()
export class CelebrationsService {
  private readonly cap: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly food: FoodService,
    private readonly events: EventsService,
  ) {
    this.cap = this.config.get<number>('orchestration.foodOrderCapRupees', 1000);
  }

  private async ensureUser(userId: string) {
    await this.prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, displayName: 'Host' },
      update: {},
    });
  }

  async create(userId: string, dto: CreateCelebrationDto) {
    await this.ensureUser(userId);

    // The OAuth flow only knows the host as "Swiggy user"; their real name comes
    // from the app session. Guests see this on the invite, so keep it current.
    if (dto.hostName?.trim()) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { displayName: dto.hostName.trim() },
      });
    }

    return this.prisma.celebration.create({
      data: {
        hostId: userId,
        occasion: dto.occasion,
        addressLabel: dto.addressLabel,
        swiggyAddressId: dto.swiggyAddressId,
        members: {
          create: dto.members.map((m, i) => ({
            name: m.name,
            phone: m.phone,
            isHost: m.isHost ?? i === 0,
          })),
        },
      },
      include: { members: true },
    });
  }

  list(userId: string) {
    return this.prisma.celebration.findMany({
      where: { hostId: userId },
      orderBy: { createdAt: 'desc' },
      include: { members: true, subOrders: true },
    });
  }

  async get(id: string) {
    const c = await this.prisma.celebration.findUnique({
      where: { id },
      include: {
        members: { include: { picks: true }, orderBy: { joinedAt: 'asc' } },
        subOrders: { include: { events: { orderBy: { at: 'desc' }, take: 5 } } },
        plan: { include: { entries: true } },
        settlement: { include: { shares: true } },
      },
    });
    if (!c) throw new NotFoundException('celebration not found');
    return c;
  }

  // ── Guests ────────────────────────────────────────────────────────────────

  /**
   * Add someone the host invited by email or phone. They exist as an INVITED
   * member straight away (so the host can see them in the list) and get their own
   * invite link — the guest fills in the rest when they open it.
   */
  async addGuest(
    celebrationId: string,
    dto: { name: string; email?: string; phone?: string; dietary?: string; isKid?: boolean },
  ) {
    const c = await this.prisma.celebration.findUnique({ where: { id: celebrationId } });
    if (!c) throw new NotFoundException('celebration not found');

    return this.prisma.member.create({
      data: {
        celebrationId,
        name: dto.name.trim(),
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        dietary: dto.dietary ?? null,
        isKid: dto.isKid ?? false,
        status: 'INVITED',
      },
    });
  }

  async removeGuest(celebrationId: string, memberId: string) {
    const m = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!m || m.celebrationId !== celebrationId) throw new NotFoundException('member not found');
    if (m.isHost) throw new BadRequestException('cannot remove the host');
    await this.prisma.member.delete({ where: { id: memberId } });
    return { ok: true };
  }

  async updateGuest(
    celebrationId: string,
    memberId: string,
    patch: { name?: string; dietary?: string; isKid?: boolean },
  ) {
    const m = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!m || m.celebrationId !== celebrationId) throw new NotFoundException('member not found');
    return this.prisma.member.update({ where: { id: memberId }, data: patch });
  }

  /**
   * The host's REAL address book: everyone they have actually invited before,
   * across their past celebrations. There is no seeded friends list — a brand-new
   * host sees an empty state until they invite their first guest.
   */
  async contacts(userId: string) {
    const rows = await this.prisma.member.findMany({
      where: { celebration: { hostId: userId }, isHost: false },
      orderBy: { joinedAt: 'desc' },
      take: 200,
      select: { name: true, email: true, phone: true, dietary: true, joinedAt: true },
    });

    // Collapse to one entry per person (same email/phone, else same name).
    const byKey = new Map<
      string,
      { name: string; email?: string; phone?: string; dietary?: string; times: number; lastAt: Date }
    >();
    for (const r of rows) {
      const key = (r.email || r.phone || r.name).toLowerCase();
      const cur = byKey.get(key);
      if (cur) {
        cur.times += 1;
        continue;
      }
      byKey.set(key, {
        name: r.name,
        email: r.email ?? undefined,
        phone: r.phone ?? undefined,
        dietary: r.dietary ?? undefined,
        times: 1,
        lastAt: r.joinedAt,
      });
    }
    return [...byKey.values()].sort((a, b) => +b.lastAt - +a.lastAt);
  }

  /** List the user's Swiggy addresses so the host can bind one. */
  resolveAddresses(userId: string) {
    return this.food.getAddresses(userId);
  }

  async setAddress(id: string, swiggyAddressId: string) {
    await this.get(id);
    return this.prisma.celebration.update({ where: { id }, data: { swiggyAddressId } });
  }

  async addFoodSubOrder(id: string, dto: AddFoodSubOrderDto) {
    await this.get(id);
    const subtotal = dto.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    const capExceeded = subtotal > this.cap;
    const sub = await this.prisma.subOrder.create({
      data: {
        celebrationId: id,
        kind: 'FOOD',
        restaurantId: dto.restaurantId,
        restaurantName: dto.restaurantName,
        lines: dto.lines as any,
        subtotal,
        couponCode: dto.couponCode,
        capExceeded,
      },
    });
    this.events.emit({ celebrationId: id, type: 'suborder.updated', payload: sub });
    if (capExceeded) {
      // surfaced, not thrown — UI must split before placement.
      return { ...sub, warning: `Food order ₹${subtotal} exceeds the ₹${this.cap} per-order cap. Split into multiple orders.` };
    }
    return sub;
  }

  async addInstamartSubOrder(id: string, dto: AddInstamartSubOrderDto) {
    await this.get(id);
    const subtotal = dto.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    if (subtotal < 99) {
      throw new BadRequestException('Instamart minimum order is ₹99');
    }
    const sub = await this.prisma.subOrder.create({
      data: {
        celebrationId: id,
        kind: 'INSTAMART',
        lines: dto.lines as any,
        subtotal,
        // pre-drop lands first → negative offset applied by the planner
      },
    });
    this.events.emit({ celebrationId: id, type: 'suborder.updated', payload: sub });
    return sub;
  }

  async removeSubOrder(id: string, subOrderId: string) {
    await this.prisma.subOrder.delete({ where: { id: subOrderId } });
    this.events.emit({ celebrationId: id, type: 'suborder.updated', payload: { removed: subOrderId } });
    return { ok: true };
  }
}
