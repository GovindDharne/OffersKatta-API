import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import {
  BillingInterval,
  SubscriptionPlan,
  UserRole,
} from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { SubscriptionsService } from './subscriptions.service';

class ChangePlanDto {
  @ApiProperty() @IsUUID() brandId!: string;
  @ApiProperty({ enum: SubscriptionPlan }) @IsEnum(SubscriptionPlan) plan!: SubscriptionPlan;
  @ApiProperty({ enum: BillingInterval, default: BillingInterval.MONTHLY })
  @IsEnum(BillingInterval) billingInterval!: BillingInterval;
}

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'List available subscription plans + pricing' })
  plans() {
    return this.subscriptions.getPlans();
  }

  @ApiBearerAuth()
  @Get(':brandId')
  get(@Param('brandId') brandId: string, @CurrentUser() user: AuthUser) {
    return this.subscriptions.getForBrand(brandId, user.id, user.role as UserRole);
  }

  @ApiBearerAuth()
  @Post('change')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Change plan (returns amount the client should pay via /payments/create-order)' })
  change(@Body() dto: ChangePlanDto, @CurrentUser() user: AuthUser) {
    return this.subscriptions.changePlan(
      dto.brandId,
      dto.plan,
      dto.billingInterval,
      user.id,
      user.role as UserRole,
    );
  }

  @ApiBearerAuth()
  @Post(':brandId/cancel')
  cancel(@Param('brandId') brandId: string, @CurrentUser() user: AuthUser) {
    return this.subscriptions.cancel(brandId, user.id, user.role as UserRole);
  }
}
