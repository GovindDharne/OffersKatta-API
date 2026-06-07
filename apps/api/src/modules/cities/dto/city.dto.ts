import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCityDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) state!: string;
  @ApiPropertyOptional({ default: 'India' })
  @IsOptional() @IsString() @MaxLength(80) country?: string;
}

export class UpdateCityDto extends PartialType(CreateCityDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ListCitiesDto {
  @ApiPropertyOptional({ description: 'Case-insensitive name/state search' })
  @IsOptional() @IsString() @MaxLength(80) search?: string;
  @ApiPropertyOptional({ description: 'Filter to one state' })
  @IsOptional() @IsString() @MaxLength(80) state?: string;
}
