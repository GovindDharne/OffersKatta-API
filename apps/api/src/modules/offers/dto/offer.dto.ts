import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { OfferScope, OfferStatus, OfferType, OfferVisibility } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

// A single card-type link with optional benefit detail
// (e.g. "10% cashback on an HDFC Credit Card, min spend ₹2000").
export class CardOfferDto {
  @ApiProperty() @IsUUID() cardTypeId!: string;

  @ApiPropertyOptional({ description: 'Credit | Debit | Both — blank = any' })
  @IsOptional() @IsString() @MaxLength(20) cardCategory?: string;

  @ApiPropertyOptional({ description: 'Cashback | Discount | No-cost EMI | Extra Off | Reward Points' })
  @IsOptional() @IsString() @MaxLength(30) benefitType?: string;

  @ApiPropertyOptional({ description: 'Free-form, e.g. "10%" or "₹500"' })
  @IsOptional() @IsString() @MaxLength(50) benefitValue?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minSpend?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxBenefit?: number;
}

// An online platform the offer also runs on (Amazon, Flipkart, brand site).
export class OfferPlatformDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) platformName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^(https?:\/\/|\/)/, { message: 'url must be a URL or absolute path' })
  url?: string;
}

export class CreateOfferDto {
  @ApiProperty() @IsUUID() branchId!: string;

  @ApiPropertyOptional({ type: [String], description: 'Extra branch ids the offer also applies to' })
  @IsOptional() @IsArray() @IsUUID('all', { each: true })
  branchIds?: string[];

  @ApiProperty() @IsString() @MinLength(3) @MaxLength(200) title!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) titleHindi?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) description?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) descriptionRegional?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) termsAndConditions?: string;

  @ApiProperty({ enum: OfferType }) @IsEnum(OfferType) offerType!: OfferType;

  @ApiProperty() @Type(() => Number) @IsNumber() @IsPositive() discountValue!: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxDiscountAmount?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minPurchaseAmount?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) originalPrice?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) finalPrice?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) couponCode?: string;

  // Allow both relative paths (/api/uploads/files/foo.png) and absolute URLs.
  // class-validator's @IsUrl rejects bare paths, so we use a permissive @Matches.
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(10)
  @Matches(/^(https?:\/\/|\/)/, { each: true, message: 'Each image must be a URL or absolute path' })
  images?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^(https?:\/\/|\/)/, { message: 'videoUrl must be a URL or absolute path' })
  videoUrl?: string;

  // Optional thumbnail shown on offer cards only (list/grid views).
  // Detail page ignores this field.
  @ApiPropertyOptional({ description: 'Thumbnail for the offer card; not shown on the detail page' })
  @IsOptional()
  @Matches(/^(https?:\/\/|\/)/, { message: 'listImage must be a URL or absolute path' })
  listImage?: string;

  @ApiProperty() @IsDateString() startsAt!: string;
  @ApiProperty() @IsDateString() expiresAt!: string;

  @ApiPropertyOptional({ enum: OfferStatus })
  @IsOptional() @IsEnum(OfferStatus) status?: OfferStatus;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isFeatured?: boolean;
  @ApiPropertyOptional({ description: 'Can be combined with other offers' })
  @IsOptional() @IsBoolean() isStackable?: boolean;

  @ApiPropertyOptional({ description: 'Display priority 1 (highest) – 10 (lowest)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10) priority?: number;

  @ApiPropertyOptional({ enum: OfferVisibility })
  @IsOptional() @IsEnum(OfferVisibility) visibility?: OfferVisibility;

  // ── Scope: who in the brand sees this offer ──
  // Default BRANCH preserves the existing pick-branches-explicitly behaviour.
  // BRAND/CITY/TAGS let chain sellers target many branches without listing them.
  @ApiPropertyOptional({ enum: OfferScope, default: OfferScope.BRANCH })
  @IsOptional() @IsEnum(OfferScope) scope?: OfferScope;

  @ApiPropertyOptional({ description: 'City name (case-insensitive) — required when scope=CITY' })
  @IsOptional() @IsString() @MaxLength(100) scopeCity?: string;

  @ApiPropertyOptional({ type: [String], description: 'Branch tags — required when scope=TAGS' })
  @IsOptional() @IsArray() @ArrayMaxSize(20)
  @IsString({ each: true }) @MaxLength(40, { each: true })
  scopeTags?: string[];

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) applicableProducts?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) excludedProducts?: string;

  @ApiPropertyOptional({ type: [String], description: 'Discovery tags (max 15)' })
  @IsOptional() @IsArray() @ArrayMaxSize(15)
  @IsString({ each: true }) @MaxLength(50, { each: true })
  tags?: string[];

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @IsPositive() maxRedemptions?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @IsPositive() redemptionPerUser?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsUUID('all', { each: true })
  categoryIds?: string[];

  // ─── Recurring window (happy hours etc.) ───
  @ApiPropertyOptional({ description: 'If true, the offer is only valid on the listed days + time window' })
  @IsOptional() @IsBoolean() isRecurring?: boolean;

  @ApiPropertyOptional({ type: [Number], description: 'Days of week as ISO numbers (0=Sun … 6=Sat)' })
  @IsOptional() @IsArray() @ArrayMaxSize(7)
  @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true })
  recurringDays?: number[];

  @ApiPropertyOptional({ example: '16:00', description: 'Start of the daily window (24h HH:MM)' })
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'recurringStartTime must be HH:MM' })
  recurringStartTime?: string;

  @ApiPropertyOptional({ example: '21:00' })
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'recurringEndTime must be HH:MM' })
  recurringEndTime?: string;

  // ─── Bank / card offers (with per-card benefit detail) ───
  @ApiPropertyOptional({ type: [CardOfferDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CardOfferDto)
  cardOffers?: CardOfferDto[];

  // ─── Online platforms ───
  @ApiPropertyOptional({ type: [OfferPlatformDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => OfferPlatformDto)
  platforms?: OfferPlatformDto[];
}

export class UpdateOfferDto extends PartialType(CreateOfferDto) {}

export class ListOffersDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() brandId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional({ enum: OfferStatus })
  @IsOptional() @IsEnum(OfferStatus) status?: OfferStatus;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() @Type(() => Boolean) isFeatured?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() @Type(() => Boolean) isRecurring?: boolean;
  @ApiPropertyOptional({ description: 'Show only offers that apply to at least one card from this bank' })
  @IsOptional() @IsUUID() bankId?: string;
  @ApiPropertyOptional({ description: 'Show only offers that apply to this specific card type' })
  @IsOptional() @IsUUID() cardTypeId?: string;
  @ApiPropertyOptional({ description: 'Show only offers whose branch is inside this mall' })
  @IsOptional() @IsUUID() mallId?: string;
}

export class NearbyOffersDto extends PaginationDto {
  @ApiProperty() @Type(() => Number) @IsLatitude() latitude!: number;
  @ApiProperty() @Type(() => Number) @IsLongitude() longitude!: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.5) @Max(100)
  radiusKm = 10;

  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;

  @ApiPropertyOptional({ description: 'Show only offers that apply to at least one card from this bank' })
  @IsOptional() @IsUUID() bankId?: string;

  @ApiPropertyOptional({ description: 'Show only offers that apply to this specific card type' })
  @IsOptional() @IsUUID() cardTypeId?: string;

  @ApiPropertyOptional({ description: 'Show only offers whose branch is inside this mall' })
  @IsOptional() @IsUUID() mallId?: string;
}
