import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { BusinessType, BrandStatus } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateBrandDto {
  @ApiProperty()
  @IsString() @MinLength(2) @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: BusinessType })
  @IsEnum(BusinessType)
  businessType!: BusinessType;

  @ApiPropertyOptional()
  @IsOptional() @IsUrl()
  websiteUrl?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUrl()
  coverUrl?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  gstNumber?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  panNumber?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('all', { each: true })
  categoryIds?: string[];
}

export class UpdateBrandDto extends PartialType(CreateBrandDto) {}

export class ListBrandsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: BusinessType })
  @IsOptional() @IsEnum(BusinessType)
  businessType?: BusinessType;

  @ApiPropertyOptional({ enum: BrandStatus })
  @IsOptional() @IsEnum(BrandStatus)
  status?: BrandStatus;
}

export class VerifyBrandDto {
  @ApiProperty({ enum: BrandStatus })
  @IsEnum(BrandStatus)
  status!: BrandStatus;
}
