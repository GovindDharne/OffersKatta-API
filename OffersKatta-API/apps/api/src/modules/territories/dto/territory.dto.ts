import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateRegionDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) name!: string;
}
export class UpdateRegionDto extends PartialType(CreateRegionDto) {}

export class CreateZoneDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @ApiProperty() @IsUUID() regionId!: string;
}
export class UpdateZoneDto extends PartialType(CreateZoneDto) {}

export class ListTerritoriesDto {
  @ApiPropertyOptional({ description: 'Filter zones to one region' })
  @IsOptional() @IsUUID() regionId?: string;
}

/// Assign a user as a territory manager. Identify the user by `userId` OR
/// `email` (email is resolved server-side, friendlier for the admin UI).
/// Exactly one of regionId / zoneId must be provided —
/// regionId ⇒ REGIONAL_MANAGER, zoneId ⇒ ZONE_MANAGER.
export class AssignManagerDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() userId?: string;
  @ApiPropertyOptional({ description: 'Look up the user by email if userId is omitted' })
  @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional({ description: 'Region to manage (regional manager)' })
  @IsOptional() @IsUUID() regionId?: string;
  @ApiPropertyOptional({ description: 'Zone to manage (zone manager)' })
  @IsOptional() @IsUUID() zoneId?: string;
}
