import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsObject, IsOptional, IsUUID } from 'class-validator';

export class InviteTeamMemberDto {
  @ApiProperty() @IsUUID() brandId!: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;

  @ApiProperty() @IsEmail() email!: string;

  @ApiProperty({ enum: [UserRole.BUSINESS_MANAGER, UserRole.STAFF] })
  @IsEnum([UserRole.BUSINESS_MANAGER, UserRole.STAFF])
  role!: UserRole;
}

export class AcceptInvitationDto {
  @ApiProperty() token!: string;
  @ApiProperty({ required: false }) fullName?: string;
  @ApiProperty({ required: false }) password?: string;
}

export class UpdateMemberPermissionsDto {
  @ApiPropertyOptional() @IsOptional() @IsObject() permissions?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
