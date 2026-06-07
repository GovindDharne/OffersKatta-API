import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsNumber, Max, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateMallDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(160) name!: string;
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
  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_tld: false }) websiteUrl?: string;
  @ApiPropertyOptional() @IsOptional()
  @Matches(/^(https?:\/\/|\/)/, { message: 'logoUrl must be a URL or absolute path' })
  logoUrl?: string;
  @ApiPropertyOptional() @IsOptional()
  @Matches(/^(https?:\/\/|\/)/, { message: 'coverUrl must be a URL or absolute path' })
  coverUrl?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(10)
  @Matches(/^(https?:\/\/|\/)/, { each: true, message: 'Each image must be a URL or absolute path' })
  images?: string[];

  @ApiPropertyOptional() @IsOptional() @IsObject() workingHours?: Record<string, unknown>;
}

export class UpdateMallDto extends PartialType(CreateMallDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ListMallsDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
}

/// Filter malls by proximity to a point. Used by the customer "Nearby" page
/// to populate its mall dropdown — only malls within the selected radius
/// should show up.
export class NearbyMallsDto extends PaginationDto {
  @ApiProperty() @Type(() => Number) @IsLatitude() latitude!: number;
  @ApiProperty() @Type(() => Number) @IsLongitude() longitude!: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.5) @Max(100)
  radiusKm = 10;
}
