import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvitesService } from './invites.service';

const DIETS = ['veg', 'non-veg', 'jain', 'vegan'];

class AcceptInviteDto {
  @IsString() name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsIn(DIETS) dietary?: string;
  @IsOptional() @IsBoolean() isKid?: boolean;
}

class PickDto {
  @IsString() restaurantId!: string;
  @IsString() restaurantName!: string;
  @IsString() dishId!: string;
  @IsString() dishName!: string;
  @IsNumber() price!: number;
  @IsNumber() qty!: number;
  @IsOptional() @IsBoolean() veg?: boolean;
  @IsOptional() @IsString() imageUrl?: string;
  /** 'instamart' for grocery/supplies picks; defaults to a restaurant dish. */
  @IsOptional() @IsIn(['food', 'instamart']) kind?: string;
  // Restaurant metadata so the host can show ETA / area for guest-added spots.
  @IsOptional() @IsNumber() restaurantEtaMin?: number;
  @IsOptional() @IsString() restaurantEtaRange?: string;
  @IsOptional() @IsString() restaurantArea?: string;
  @IsOptional() @IsNumber() restaurantRating?: number;
}

class SavePicksDto {
  @IsString() memberId!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => PickDto) picks!: PickDto[];
}

class ReadyDto {
  @IsString() memberId!: string;
}

/**
 * Everything a guest can do, authorized by the invite token ALONE — they have no
 * account and no Swiggy login. Menu reads are brokered with the HOST's grant (see
 * InvitesService); nothing here can place an order.
 */
@Controller('invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get(':token')
  preview(@Param('token') token: string) {
    return this.invites.preview(token);
  }

  @Post(':token/accept')
  accept(@Param('token') token: string, @Body() dto: AcceptInviteDto) {
    return this.invites.accept(token, dto);
  }

  // ── Browse the host's real Swiggy menus ──
  @Get(':token/restaurants')
  restaurants(@Param('token') token: string, @Query('query') query = '') {
    return this.invites.guestRestaurants(token, query);
  }

  @Get(':token/restaurants/:restaurantId/menu')
  menu(
    @Param('token') token: string,
    @Param('restaurantId') restaurantId: string,
    @Query('page') page = '1',
  ) {
    return this.invites.guestMenu(token, restaurantId, Number(page) || 1);
  }

  // Instamart for guests — search, or the host's go-to items when empty.
  @Get(':token/instamart')
  instamart(@Param('token') token: string, @Query('query') query = '') {
    return this.invites.guestInstamart(token, query);
  }

  // ── Picks ──
  @Put(':token/picks')
  savePicks(@Param('token') token: string, @Body() dto: SavePicksDto) {
    return this.invites.savePicks(token, dto.memberId, dto.picks);
  }

  @Post(':token/ready')
  ready(@Param('token') token: string, @Body() dto: ReadyDto) {
    return this.invites.markReady(token, dto.memberId);
  }
}
