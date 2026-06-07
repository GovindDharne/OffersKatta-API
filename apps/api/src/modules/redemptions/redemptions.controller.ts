import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { RedemptionsService } from './redemptions.service';

class ConfirmRedemptionDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsNumber() @Min(0) finalAmount?: number;
}

@ApiBearerAuth()
@ApiTags('redemptions')
@Controller('redemptions')
export class RedemptionsController {
  constructor(private readonly redemptions: RedemptionsService) {}

  @Post('offer/:offerId')
  @ApiOperation({ summary: 'Customer issues a redemption (QR) for an offer' })
  issue(@Param('offerId') offerId: string, @CurrentUser() user: AuthUser) {
    return this.redemptions.issue(user.id, offerId);
  }

  @Post(':qr/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Staff/manager scans QR and confirms redemption' })
  confirm(
    @Param('qr') qrCode: string,
    @Body() dto: ConfirmRedemptionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.redemptions.confirm(qrCode, user.id, user.role as UserRole, dto.notes, dto.finalAmount);
  }

  @Post(':qr/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Customer cancels a pending redemption' })
  cancel(@Param('qr') qrCode: string, @CurrentUser() user: AuthUser) {
    return this.redemptions.cancel(qrCode, user.id);
  }

  @Get('me')
  @ApiOperation({ summary: 'List the current user’s redemptions' })
  mine(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
    return this.redemptions.myRedemptions(user.id, q);
  }

  @Get('branch/:branchId')
  @ApiOperation({ summary: 'List redemptions for a branch (manager/staff/owner/admin)' })
  branch(@Param('branchId') branchId: string, @Query() q: PaginationDto) {
    return this.redemptions.branchRedemptions(branchId, q);
  }
}
