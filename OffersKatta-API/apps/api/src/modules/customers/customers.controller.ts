import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import {
  CustomerPreferencesDto,
  RegisterDeviceDto,
  UpdateCustomerLocationDto,
} from '../auth/dto/auth.dto';
import { CustomersService } from './customers.service';

@ApiBearerAuth()
@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Current customer profile (location, devices, preferences)' })
  me(@CurrentUser() user: AuthUser) {
    return this.customers.me(user.id);
  }

  @Patch('me/location')
  @ApiOperation({ summary: 'Update the current customer\'s last known coordinates' })
  updateLocation(@CurrentUser() user: AuthUser, @Body() dto: UpdateCustomerLocationDto) {
    return this.customers.updateLocation(user.id, dto);
  }

  @Patch('me/preferences')
  @ApiOperation({ summary: 'Toggle push opt-in / change preferred notification radius (km)' })
  updatePreferences(@CurrentUser() user: AuthUser, @Body() dto: CustomerPreferencesDto) {
    return this.customers.updatePreferences(user.id, dto);
  }

  @Post('me/devices')
  @ApiOperation({ summary: 'Register an FCM device token for nearby-offer push notifications' })
  addDevice(@CurrentUser() user: AuthUser, @Body() dto: RegisterDeviceDto) {
    return this.customers.addDevice(user.id, dto);
  }

  @Delete('me/devices/:token')
  @ApiOperation({ summary: 'Unregister an FCM device token (on logout / token rotation)' })
  removeDevice(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.customers.removeDevice(user.id, token);
  }
}

@ApiBearerAuth()
@ApiTags('push')
@Controller('push')
export class PushPreviewController {
  constructor(private readonly customers: CustomersService) {}

  @Get('preview/offer/:offerId')
  @ApiOperation({
    summary:
      'Preview the list of customers within radiusKm of the offer\'s branch ' +
      'who would receive a push notification (does not actually send)',
  })
  previewOffer(
    @CurrentUser() user: AuthUser,
    @Param('offerId') offerId: string,
    @Query('radiusKm') radiusKm: string,
  ) {
    return this.customers.previewNearbyForOffer(offerId, user.id, Number(radiusKm) || 10);
  }
}
