import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { EnterpriseLeadStatus } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/// Public "Contact Sales" submission. Kept deliberately light — we want the
/// barrier to entry to be low. Everything beyond company/contact/email is
/// optional.
export class CreateEnterpriseLeadDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) companyName!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) contactName!: string;
  @ApiProperty() @IsEmail() @MaxLength(160) email!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @ApiPropertyOptional({ description: 'Rough store/branch count for sizing' })
  @IsOptional() @IsInt() @Min(1) @Max(100000) estimatedBranches?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) message?: string;

  /// Optional: when a signed-in seller submits, the brand they want upgraded.
  @ApiPropertyOptional() @IsOptional() @IsUUID() brandId?: string;
}

/// Super-admin update of the sales pipeline state + private notes.
export class UpdateEnterpriseLeadDto {
  @ApiPropertyOptional({ enum: EnterpriseLeadStatus })
  @IsOptional() @IsEnum(EnterpriseLeadStatus) status?: EnterpriseLeadStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) internalNotes?: string;
}

export class ListEnterpriseLeadsDto {
  @ApiPropertyOptional({ enum: EnterpriseLeadStatus })
  @IsOptional() @IsEnum(EnterpriseLeadStatus) status?: EnterpriseLeadStatus;
}

/// Provision the Enterprise tier for a brand once a deal is WON. The brand can
/// come from the lead (if linked) or be supplied explicitly. termMonths sets
/// the contract length; amount is recorded for reporting (billed offline).
export class ProvisionEnterpriseDto {
  @ApiPropertyOptional({ description: 'Overrides the lead-linked brand if set' })
  @IsOptional() @IsUUID() brandId?: string;
  @ApiPropertyOptional({ default: 12 })
  @IsOptional() @IsInt() @Min(1) @Max(120) termMonths?: number;
  @ApiPropertyOptional({ description: 'Contract value recorded for reporting (INR)' })
  @IsOptional() @IsInt() @Min(0) amount?: number;
}

// (PartialType kept available for future symmetric update DTOs.)
export class _UpdateEnterpriseLeadFull extends PartialType(CreateEnterpriseLeadDto) {}
