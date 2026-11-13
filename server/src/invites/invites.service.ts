import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { CelebrationAccessService } from '../celebrations/celebration-access.service';
import { FoodService } from '../swiggy/food.service';
import { InstamartService } from '../swiggy/instamart.service';
import type { MemberStatus } from '@prisma/client';

export interface GuestPick {
  restaurantId: string;
  restaurantName: string;
  dishId: string;
  dishName: string;
  price: number;
  qty: number;
  veg?: boolean;
  imageUrl?: string;
  restaurantEtaMin?: number;
  restaurantEtaRange?: string;
  restaurantArea?: string;
  restaurantRating?: number;
}

/**
 * Guest invites.
 *
 * The load-bearing idea: a guest has NO Swiggy account and no login. They hold a
 * single unguessable token. Everything they can do — see the party, browse the
 * real menu, save their picks — is authorized by that token alone, and any Swiggy
 * call is made with the HOST's grant, scoped to the host's chosen address. The
 * guest never sees the host's token and can never place an order.
 */
@Injectable()
export class InvitesService {
  private static readonly TTL_MS = 7 * 86400 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly events: EventsService,
    private readonly food: FoodService,
    private readonly instamart: InstamartService,
    private readonly access: CelebrationAccessService,
  ) {}

  // ── Host side ─────────────────────────────────────────────────────────────

  /**
   * Mint an invite link. If `memberId` is given, the link is addressed to that
   * specific person (invited by email/phone); otherwise it's a shareable link
   * anyone can open.
   *
   * Host-only, and that matters more here than anywhere else in the flow: this
   * token is a bearer credential that reads Swiggy through the HOST's grant.
   * While minting was unauthenticated, anyone holding a celebration id could
   * issue themselves one and browse menus — and see the full guest list — on
   * somebody else's account.
   */
  async create(celebrationId: string, userId: string, memberId?: string) {
    await this.access.assertHost(celebrationId, userId);

    // The addressed member must belong to this celebration: otherwise a valid
    // id of the host's own, paired with a member id from another party, would
    // mint a link that writes picks into someone else's order.
    if (memberId) await this.assertMember(celebrationId, memberId);

    // 18 bytes = 144 bits of entropy. The token is the ONLY credential a guest
    // holds, so it has to be unguessable at internet scale, not merely unique.
    const token = randomBytes(18).toString('base64url');
    const invite = await this.prisma.invite.create({
      data: {
        celebrationId,
        token,
        memberId: memberId ?? null,
        expiresAt: new Date(Date.now() + InvitesService.TTL_MS),
      },
    });
    const web = this.config.get<string>('webOrigin', 'http://localhost:5173');
    return {
      token: invite.token,
      url: `${web}/invite/${invite.token}`,
      expiresAt: invite.expiresAt,
      memberId: invite.memberId,
    };
  }

  // ── Guest side ────────────────────────────────────────────────────────────

  /** Everything the invite landing page needs. No auth beyond the token. */
  async preview(token: string) {
    const invite = await this.findValid(token);
    const c = await this.prisma.celebration.findUnique({
      where: { id: invite.celebrationId },
      include: {
        host: true,
        members: { include: { picks: true }, orderBy: { joinedAt: 'asc' } },
      },
    });
    if (!c) throw new NotFoundException('celebration not found');

    // If the host addressed this link to someone, pre-fill their details.
    const invitedMember = invite.memberId
      ? (c.members.find((m) => m.id === invite.memberId) ?? null)
      : null;

    return {
      celebrationId: c.id,
      occasion: c.occasion,
      hostName: c.host.displayName ?? 'Your host',
      addressLabel: c.addressLabel,
      /** whether menus are browsable yet — the host must pick an address first */
      hasAddress: !!c.swiggyAddressId,
      members: c.members.map((m) => ({
        id: m.id,
        name: m.name,
        isHost: m.isHost,
        dietary: m.dietary,
        status: m.status,
      })),
      invitedMember: invitedMember
        ? {
            id: invitedMember.id,
            name: invitedMember.name,
            dietary: invitedMember.dietary,
            isKid: invitedMember.isKid,
            status: invitedMember.status,
            // Their own saved picks, so a guest can resume on ANY device — not
            // just the phone they first opened the link on.
            picks: invitedMember.picks.map((p) => ({
              restaurantId: p.restaurantId,
              restaurantName: p.restaurantName,
              dishId: p.dishId,
              dishName: p.dishName,
              price: p.price,
              qty: p.qty,
              veg: p.veg,
              imageUrl: p.imageUrl ?? undefined,
              restaurantEtaMin: p.restaurantEtaMin ?? undefined,
              restaurantEtaRange: p.restaurantEtaRange ?? undefined,
              restaurantArea: p.restaurantArea ?? undefined,
              restaurantRating: p.restaurantRating ?? undefined,
            })),
          }
        : null,
    };
  }

  /**
   * The guest tells us who they are. If the host already added them by
   * email/phone we UPDATE that member rather than creating a duplicate.
   */
  async accept(
    token: string,
    dto: { name: string; phone?: string; email?: string; dietary?: string; isKid?: boolean },
  ) {
    const invite = await this.findValid(token);

    // Only overwrite what the guest actually told us — the host may already have
    // recorded their email/phone when inviting them, and a blank field here must
    // not erase it.
    const data: {
      name: string;
      status: MemberStatus;
      phone?: string;
      email?: string;
      dietary?: string;
      isKid?: boolean;
    } = { name: dto.name.trim(), status: 'JOINED' };
    if (dto.phone) data.phone = dto.phone;
    if (dto.email) data.email = dto.email;
    if (dto.dietary) data.dietary = dto.dietary;
    if (dto.isKid !== undefined) data.isKid = dto.isKid;

    const member = invite.memberId
      ? await this.prisma.member.update({ where: { id: invite.memberId }, data })
      : await this.prisma.member.create({
          data: { ...data, celebrationId: invite.celebrationId },
        });

    await this.prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedBy: member.id, memberId: member.id },
    });

    this.events.emit({
      celebrationId: invite.celebrationId,
      type: 'suborder.updated',
      payload: { memberJoined: member },
    });

    return { celebrationId: invite.celebrationId, member };
  }

  /**
   * Replace this guest's picks. Idempotent — their cart is the source of truth on
   * their device, and we mirror it here so the host can see it.
   */
  async savePicks(token: string, memberId: string, picks: GuestPick[]) {
    const invite = await this.findValid(token);
    const member = await this.assertMember(invite.celebrationId, memberId);

    const rows = picks
      .filter((p) => p.qty > 0)
      .map((p) => ({
        memberId: member.id,
        restaurantId: p.restaurantId,
        restaurantName: p.restaurantName,
        dishId: p.dishId,
        dishName: p.dishName,
        price: Math.round(p.price),
        qty: p.qty,
        veg: !!p.veg,
        imageUrl: p.imageUrl ?? null,
        restaurantEtaMin: p.restaurantEtaMin ?? null,
        restaurantEtaRange: p.restaurantEtaRange ?? null,
        restaurantArea: p.restaurantArea ?? null,
        restaurantRating: p.restaurantRating ?? null,
      }));

    await this.prisma.$transaction([
      this.prisma.memberPick.deleteMany({ where: { memberId: member.id } }),
      this.prisma.memberPick.createMany({ data: rows }),
      this.prisma.member.update({
        where: { id: member.id },
        data: { status: rows.length ? 'PICKING' : 'JOINED' },
      }),
    ]);

    this.events.emit({
      celebrationId: invite.celebrationId,
      type: 'suborder.updated',
      payload: { memberPicked: member.id },
    });

    return { ok: true, count: rows.length };
  }

  /** The guest is done choosing. */
  async markReady(token: string, memberId: string) {
    const invite = await this.findValid(token);
    const member = await this.assertMember(invite.celebrationId, memberId);

    const updated = await this.prisma.member.update({
      where: { id: member.id },
      data: { status: 'READY', readyAt: new Date() },
    });

    this.events.emit({
      celebrationId: invite.celebrationId,
      type: 'suborder.updated',
      payload: { memberReady: member.id },
    });

    return updated;
  }

  // ── Swiggy, brokered for the guest ────────────────────────────────────────
  /**
   * A guest has no Swiggy grant, so we make the call with the HOST's — scoped to
   * the celebration's chosen address. The token is the only credential, and
   * nothing here can place an order or read anything else of the host's.
   */
  async guestRestaurants(token: string, query: string) {
    const { hostId, addressId } = await this.swiggyContext(token);
    return this.food.getServiceableRestaurants(hostId, addressId, query);
  }

  async guestMenu(token: string, restaurantId: string, page = 1) {
    const { hostId, addressId } = await this.swiggyContext(token);
    return this.food.getRestaurantMenu(hostId, addressId, restaurantId, page);
  }

  /** Instamart for guests — brokered with the host's grant, like restaurants. */
  async guestInstamart(token: string, query: string) {
    const { hostId, addressId } = await this.swiggyContext(token);
    return query.trim()
      ? this.instamart.searchProducts(hostId, addressId, query.trim())
      : this.instamart.yourGoToItems(hostId, addressId);
  }

  private async swiggyContext(token: string) {
    const invite = await this.findValid(token);
    const c = await this.prisma.celebration.findUnique({
      where: { id: invite.celebrationId },
      select: { hostId: true, swiggyAddressId: true },
    });
    if (!c) throw new NotFoundException('celebration not found');
    if (!c.swiggyAddressId) {
      throw new BadRequestException(
        'The host has not picked a delivery address yet, so menus are not available.',
      );
    }
    return { hostId: c.hostId, addressId: c.swiggyAddressId };
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async assertMember(celebrationId: string, memberId: string) {
    const m = await this.prisma.member.findUnique({ where: { id: memberId } });
    // Guard against a token for one party being used to write into another.
    if (!m || m.celebrationId !== celebrationId) {
      throw new NotFoundException('member not found on this celebration');
    }
    return m;
  }

  private async findValid(token: string) {
    const invite = await this.prisma.invite.findUnique({ where: { token } });
    if (!invite) throw new NotFoundException('invite not found');
    if (invite.expiresAt.getTime() < Date.now()) throw new BadRequestException('invite expired');
    return invite;
  }
}
