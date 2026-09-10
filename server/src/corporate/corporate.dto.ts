import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested,
} from 'class-validator';
import type { InvoiceStatus } from './corporate.types';

export class SignInDto {
  @IsString() employeeId!: string;
}
export class SignInEmailDto {
  @IsString() email!: string;
}
export class CreateGroupOrderDto {
  @IsString() title!: string;
  @IsString() costCenterId!: string;
  @IsString() organizerId!: string;
  @IsString() date!: string;
}
export class JoinDto {
  @IsString() employeeId!: string;
}

export class OrderLineDto {
  @IsString() employeeId!: string;
  @IsString() restaurantId!: string;
  @IsString() restaurantName!: string;
  @IsString() dishId!: string;
  @IsString() dishName!: string;
  @IsInt() @Min(1) qty!: number;
  @IsInt() @Min(0) price!: number;
}
export class SetLinesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  lines!: OrderLineDto[];
}

export class InvoiceStatusDto {
  @IsIn(['issued', 'claimed', 'reconciled', 'void'])
  status!: InvoiceStatus;
}

export class UpdateCompanyDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() billingEmail?: string;
  @IsOptional() @IsString() addressLabel?: string;
  @IsOptional() @IsString() gstin?: string;
  @IsOptional() @IsIn(['pilot', 'standard', 'enterprise']) plan?: 'pilot' | 'standard' | 'enterprise';
  @IsOptional() @IsBoolean() billingLinked?: boolean;
  @IsOptional() @IsInt() @Min(0) walletBalance?: number;
}

export class UpdateCostCenterDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsInt() @Min(0) budgetRup?: number;
  @IsOptional() @IsInt() @Min(0) perHeadCapRup?: number;
  @IsOptional() @IsBoolean() vegOnly?: boolean;
  @IsOptional() @IsBoolean() allowAlcohol?: boolean;
  @IsOptional() @IsInt() @Min(0) requireApprovalAboveRup?: number | null;
}
