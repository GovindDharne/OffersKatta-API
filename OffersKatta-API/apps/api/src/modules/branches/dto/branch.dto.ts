import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { BranchStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateBranchDto {
  @ApiProperty() @IsUUID() brandId!: string;

  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;

  @ApiProperty() @IsString() @MinLength(2) @MaxLength(200) addressLine1!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) addressLine2?: string;
  @ApiProperty() @IsString() @MaxLength(100) city!: string;
  @ApiProperty() @IsString() @MaxLength(100) state!: string;
  @ApiProperty() @IsString() @MaxLength(100) country!: string;
  @ApiProperty() @IsString() @MaxLength(20) postalCode!: string;

  @ApiProperty() @Type(() => Number) @IsLatitude() latitude!: number;
  @ApiProperty() @Type(() => Number) @IsLongitude() longitude!: number;

  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;

  @ApiPropertyOptional() @IsOptional() @IsObject() workingHours?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsUrl({}, { each: true })
  images?: string[];

  // Optional mall placement. If mallId is set, shopNumber typically holds the
  // unit identifier ("F-23", "Ground floor, Block C") shoppers will look for.
  @ApiPropertyOptional() @IsOptional() @IsUUID() mallId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) shopNumber?: string;

  /// Optional zone placement for chains that operate large internal territories
  /// (e.g. "Bombay North"). Zones live under regions — see TerritoriesModule.
  /// We only persist zoneId on the branch; the region is reached via the zone.
  @ApiPropertyOptional() @IsOptional() @IsUUID() zoneId?: string;

  /// Free-form labels (e.g. "flagship", "metro", "tier-2"). Sellers create
  /// offers with scope=TAGS and target the tag instead of each branch id.
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(20)
  @IsString({ each: true }) @MaxLength(40, { each: true })
  tags?: string[];
}

export class UpdateBranchDto extends PartialType(CreateBranchDto) {
  @ApiPropertyOptional({ enum: BranchStatus })
  @IsOptional() @IsEnum(BranchStatus)
  status?: BranchStatus;
}

export class ListBranchesDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() brandId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() mallId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional({ enum: BranchStatus }) @IsOptional() @IsEnum(BranchStatus) status?: BranchStatus;

  /// Filter by direct zone assignment.
  @ApiPropertyOptional() @IsOptional() @IsUUID() zoneId?: string;
  /// Filter by region — joins through the zone (any branch whose zone belongs
  /// to this region). Lets the admin "view all branches in Bombay region".
  @ApiPropertyOptional() @IsOptional() @IsUUID() regionId?: string;

  @ApiPropertyOptional({ description: 'Free-text search across name, address, city, PIN' })
  @IsOptional() @IsString() @MaxLength(120) search?: string;
}
