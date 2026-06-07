import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export enum PushAudience {
  NEARBY    = 'NEARBY',     // Customers within radiusKm of any reachable branch
  FOLLOWERS = 'FOLLOWERS',  // Anyone who follows the brand, regardless of distance
  BOTH      = 'BOTH',       // Union of the two (default)
}

export class NotifyOfferDto {
  @ApiProperty({ default: 5, description: 'Send to customers within this many km of any reachable branch (1–100). Only matters when audience is NEARBY or BOTH.' })
  @Type(() => Number) @IsInt() @Min(1) @Max(100)
  radiusKm!: number;

  @ApiPropertyOptional({ enum: PushAudience, default: PushAudience.BOTH })
  @IsOptional() @IsEnum(PushAudience)
  audience?: PushAudience;
}

export class ListPushJobsDto {
  @ApiPropertyOptional({ description: 'Filter to one brand. Sellers see only their brands; admins see all.' })
  @IsOptional() @IsUUID()
  brandId?: string;
}
