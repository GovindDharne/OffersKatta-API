import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import {
  AuthResponseDto,
  FirebaseLoginDto,
  LoginDto,
  RefreshDto,
  RegisterCustomerDto,
  RegisterDto,
  RegisterSellerDto,
  RequestOtpDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  VerifyCustomerPhoneDto,
  VerifyOtpDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Register a user (legacy — prefer register/customer or register/seller)' })
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.auth.register(dto);
  }

  @Public()
  @Post('register/customer')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Customer signup: phone required, OTP sent to phone' })
  registerCustomer(@Body() dto: RegisterCustomerDto) {
    return this.auth.registerCustomer(dto);
  }

  @Public()
  @Post('register/seller')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Seller-owner signup: phone optional, role forced to SELLER_OWNER' })
  registerSeller(@Body() dto: RegisterSellerDto): Promise<AuthResponseDto> {
    return this.auth.registerSeller(dto);
  }

  @ApiBearerAuth()
  @Post('customer/verify-phone')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify the OTP sent during registerCustomer' })
  verifyCustomerPhone(@CurrentUser() user: AuthUser, @Body() dto: VerifyCustomerPhoneDto) {
    return this.auth.verifyCustomerPhone(user.id, dto);
  }

  @ApiBearerAuth()
  @Post('customer/resend-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: 'Resend the phone-verification OTP to the current user' })
  resendCustomerOtp(@CurrentUser() user: AuthUser) {
    return this.auth.resendCustomerOtp(user.id);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Email + password login' })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh token for a new access token' })
  refresh(@Body() dto: RefreshDto): Promise<AuthResponseDto> {
    return this.auth.refresh(dto);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current refresh token (or all if omitted)' })
  async logout(
    @CurrentUser() user: AuthUser,
    @Body() body?: Partial<RefreshDto>,
  ): Promise<void> {
    await this.auth.logout(body?.refreshToken, user.id);
  }

  @Public()
  @Post('firebase')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login/register via a Firebase ID token (Google, Apple, etc.)' })
  firebase(@Body() dto: FirebaseLoginDto): Promise<AuthResponseDto> {
    return this.auth.loginWithFirebase(dto);
  }

  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Request a phone OTP (logged to server in dev)' })
  requestOtp(@Body() dto: RequestOtpDto, @Req() _req: Request): Promise<{ sent: true }> {
    return this.auth.requestOtp(dto);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a phone OTP — creates a customer if first time' })
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<AuthResponseDto> {
    return this.auth.verifyOtp(dto);
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Request a password-reset email' })
  forgot(@Body() dto: RequestPasswordResetDto): Promise<{ sent: true }> {
    return this.auth.requestPasswordReset(dto);
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete password reset using a token from the email' })
  reset(@Body() dto: ResetPasswordDto): Promise<{ ok: true }> {
    return this.auth.resetPassword(dto);
  }
}
