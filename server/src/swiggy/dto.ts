import { IsIn, IsNumber, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ADDRESS_CATEGORIES, type AddressCategory } from '../mcp/mcp.types';

/**
 * Body of `POST /swiggy/addresses`.
 *
 * Validated rather than passed straight through because this is the one Swiggy
 * write whose payload is typed by a human into a form. The global pipe runs
 * with `forbidNonWhitelisted`, so a stray field is a 400 here instead of an
 * opaque MCP refusal several layers down.
 */
export class CreateAddressDto {
  /** The address as the user typed it; Swiggy geocodes this when lat/lng are absent. */
  @IsString() @MinLength(5) @MaxLength(500) fullAddress!: string;

  @IsString() @MinLength(1) @MaxLength(200) addressLine!: string;

  /** Swiggy requires the key but accepts "". */
  @IsString() @MaxLength(200) addressLine2!: string;

  @IsString() @MinLength(1) @MaxLength(100) city!: string;

  /** Indian PIN codes are exactly six digits and never start with 0. */
  @Matches(/^[1-9][0-9]{5}$/, { message: 'postalCode must be a 6-digit Indian PIN code' })
  postalCode!: string;

  @IsIn(ADDRESS_CATEGORIES as unknown as string[])
  addressCategory!: AddressCategory;

  @IsString() @MinLength(1) @MaxLength(100) userName!: string;

  /** 10-digit Indian mobile, optionally +91-prefixed. */
  @Matches(/^(?:\+?91)?[6-9][0-9]{9}$/, { message: 'userPhone must be a valid Indian mobile number' })
  userPhone!: string;

  @IsOptional() @IsString() @MaxLength(200) locality?: string;
  @IsOptional() @IsString() @MaxLength(60) addressTag?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsString() @MaxLength(100) receiverName?: string;
  @IsOptional() @IsString() receiverPhone?: string;
}
