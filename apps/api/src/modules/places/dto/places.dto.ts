import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AutocompleteQueryDto {
  /// Free-text query — what the user is typing (e.g. "Phoenix Marketcity").
  /// Google ignores anything shorter than a few characters, so we require ≥2.
  @MinLength(2) @MaxLength(120) @IsString()
  q!: string;

  /// Google "session token" — a client-generated UUID. Sending the same token
  /// across autocomplete calls + the final place-details call lets Google bill
  /// them as ONE session instead of N. Frontend uses crypto.randomUUID().
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64)
  sessionToken?: string;
}

export class PlaceDetailsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64)
  sessionToken?: string;
}
