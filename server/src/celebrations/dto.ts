import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Bounds, not just types.
 *
 * `@IsInt()` alone accepts 9007199254740991 as a unit price and 50,000 lines in
 * one sub-order. These numbers are summed into the order subtotal, compared
 * against the ₹1,000 Swiggy cap, and divided among guests at settlement — so an
 * unbounded value is an arithmetic-overflow bug and a denial-of-service payload
 * in the same field. The ceilings below are far above any real catering order
 * and far below anything that misbehaves.
 */
const MAX_UNIT_PRICE_RUPEES = 100_000;
const MAX_QTY = 500;
const MAX_LINES = 200;
const MAX_MEMBERS = 200;

/** veg | non-veg | jain | vegan — the vocabulary shared with the guest flow. */
export const DIETARY_OPTIONS = ['veg', 'non-veg', 'jain', 'vegan'] as const;

export class MemberDto {
  @IsString() @Length(1, 80) name!: string;
  @IsOptional() @IsString() @Length(4, 20) phone?: string;
  @IsOptional() @IsBoolean() isHost?: boolean;
}

export class CreateCelebrationDto {
  @IsString() @Length(1, 80) occasion!: string;
  /** the host's real name, from their app session — shown to guests on the invite */
  @IsOptional() @IsString() @Length(1, 80) hostName?: string;
  @IsString() @Length(1, 200) addressLabel!: string;
  @IsOptional() @IsString() @Length(1, 200) swiggyAddressId?: string;
  @IsArray()
  @ArrayMaxSize(MAX_MEMBERS)
  @ValidateNested({ each: true })
  @Type(() => MemberDto)
  members!: MemberDto[];
}

/**
 * Binding the celebration to one of the host's saved Swiggy addresses.
 *
 * A DTO rather than `@Body('swiggyAddressId')`: a bare `@Body(key)` bypasses
 * the global ValidationPipe entirely, so the value reached the database with no
 * type or length check at all.
 */
export class SetAddressDto {
  @IsString() @Length(1, 200) swiggyAddressId!: string;
}

export class AddGuestDto {
  @IsString() @Length(1, 80) name!: string;
  @IsOptional() @IsEmail() @Length(3, 254) email?: string;
  @IsOptional() @IsString() @Length(4, 20) phone?: string;
  @IsOptional() @IsIn(DIETARY_OPTIONS as unknown as string[]) dietary?: string;
  @IsOptional() @IsBoolean() isKid?: boolean;
}

export class UpdateGuestDto {
  @IsOptional() @IsString() @Length(1, 80) name?: string;
  @IsOptional() @IsIn(DIETARY_OPTIONS as unknown as string[]) dietary?: string;
  @IsOptional() @IsBoolean() isKid?: boolean;
}

export class FoodLineDto {
  @IsString() @Length(1, 120) itemId!: string;
  @IsString() @Length(1, 200) name!: string;
  @IsInt() @Min(1) @Max(MAX_QTY) qty!: number;
  @IsInt() @Min(0) @Max(MAX_UNIT_PRICE_RUPEES) unitPrice!: number;
  /** who this dish is for (by-item settlement) */
  @IsOptional() @IsString() @Length(1, 120) memberId?: string;
}

export class AddFoodSubOrderDto {
  @IsString() @Length(1, 120) restaurantId!: string;
  @IsString() @Length(1, 200) restaurantName!: string;
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => FoodLineDto)
  lines!: FoodLineDto[];
  @IsOptional() @IsString() @Length(1, 40) couponCode?: string;
}

export class InstamartLineDto {
  @IsString() @Length(1, 120) spinId!: string;
  @IsString() @Length(1, 200) name!: string;
  @IsInt() @Min(1) @Max(MAX_QTY) qty!: number;
  @IsInt() @Min(0) @Max(MAX_UNIT_PRICE_RUPEES) unitPrice!: number;
  @IsIn(['go-to', 'cuisine-pair', 'host-pick']) from!: 'go-to' | 'cuisine-pair' | 'host-pick';
}

export class AddInstamartSubOrderDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => InstamartLineDto)
  lines!: InstamartLineDto[];
}

export class SettleDto {
  @IsIn(['EQUAL', 'BY_ITEM']) mode!: 'EQUAL' | 'BY_ITEM';
  /** memberId who paid COD at the door; everyone else repays them. */
  @IsOptional() @IsString() @Length(1, 120) cashCollectedBy?: string;
  /**
   * UPI VPA of the collector, used to build `upi://pay` deeplinks.
   *
   * Format-checked because it is interpolated into a URI we hand to the
   * guest's payment app: an unvalidated value can smuggle extra query
   * parameters into the deeplink and redirect the money.
   */
  @IsOptional() @IsString() @Length(3, 100) collectorVpa?: string;
}
