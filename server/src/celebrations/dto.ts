import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class MemberDto {
  @IsString() name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsBoolean() isHost?: boolean;
}

export class CreateCelebrationDto {
  @IsString() occasion!: string;
  /** the host's real name, from their app session — shown to guests on the invite */
  @IsOptional() @IsString() hostName?: string;
  @IsString() addressLabel!: string;
  @IsOptional() @IsString() swiggyAddressId?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => MemberDto) members!: MemberDto[];
}

export class FoodLineDto {
  @IsString() itemId!: string;
  @IsString() name!: string;
  @IsInt() @Min(1) qty!: number;
  @IsInt() @Min(0) unitPrice!: number;
  @IsOptional() @IsString() memberId?: string; // who this dish is for (by-item settlement)
}

export class AddFoodSubOrderDto {
  @IsString() restaurantId!: string;
  @IsString() restaurantName!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => FoodLineDto) lines!: FoodLineDto[];
  @IsOptional() @IsString() couponCode?: string;
}

export class InstamartLineDto {
  @IsString() spinId!: string;
  @IsString() name!: string;
  @IsInt() @Min(1) qty!: number;
  @IsInt() @Min(0) unitPrice!: number;
  @IsIn(['go-to', 'cuisine-pair', 'host-pick']) from!: 'go-to' | 'cuisine-pair' | 'host-pick';
}

export class AddInstamartSubOrderDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => InstamartLineDto) lines!: InstamartLineDto[];
}

export class SettleDto {
  @IsIn(['EQUAL', 'BY_ITEM']) mode!: 'EQUAL' | 'BY_ITEM';
  /** memberId who paid COD at the door; everyone else repays them. */
  @IsOptional() @IsString() cashCollectedBy?: string;
  /** UPI VPA of the collector, used to build upi://pay deeplinks. */
  @IsOptional() @IsString() collectorVpa?: string;
}
