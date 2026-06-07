import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Secret123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/)
  phone?: string;

  @ApiPropertyOptional({ enum: [UserRole.CUSTOMER, UserRole.SELLER_OWNER] })
  @IsOptional()
  @IsEnum([UserRole.CUSTOMER, UserRole.SELLER_OWNER])
  role?: UserRole;
}

export class LoginDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Secret123!' })
  @IsString()
  @MinLength(1)
  password!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class FirebaseLoginDto {
  @ApiProperty({ description: 'Firebase ID token from client SDK' })
  @IsString()
  idToken!: string;
}

export class RequestOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/)
  phone!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/)
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  otp!: string;
}

export class RequestPasswordResetDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token!: string;

  @ApiProperty({ example: 'NewSecret123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class AuthResponseDto {
  accessToken!: string;
  refreshToken!: string;
  expiresIn!: number;
  user!: {
    id: string;
    email: string | null;
    fullName: string | null;
    role: UserRole;
    phoneVerified?: boolean;
  };
}

/// Customer-only signup. Phone is required so we can OTP-verify it and target
/// push notifications by location. Email also required for password login.
export class RegisterCustomerDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail() email!: string;

  @ApiProperty({ example: 'Secret123!' })
  @IsString() @MinLength(8) @MaxLength(128) password!: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString() @MinLength(2) @MaxLength(100) fullName!: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString() @Matches(/^\+?[1-9]\d{6,14}$/, { message: 'phone must be a valid E.164 number' })
  phone!: string;

  /// Optional initial location. If omitted, the customer can submit it later via
  /// PATCH /customers/me/location. Used by /push/notify/* radius targeting.
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLatitude() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLongitude() longitude?: number;
}

/// Seller-owner signup. No phone required; sellers manage their business via
/// the admin panel and aren't push targets.
export class RegisterSellerDto {
  @ApiProperty() @IsEmail() email!: string;

  @ApiProperty()
  @IsString() @MinLength(8) @MaxLength(128) password!: string;

  @ApiProperty()
  @IsString() @MinLength(2) @MaxLength(100) fullName!: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional() @IsString() @Matches(/^\+?[1-9]\d{6,14}$/)
  phone?: string;
}

/// Verify the customer's phone with the OTP we sent during registration.
/// Sets `customer_profiles.phoneVerified = true` and `users.isVerified = true`.
export class VerifyCustomerPhoneDto {
  @ApiProperty({ example: '123456' })
  @IsString() @Length(6, 6) otp!: string;
}

export class UpdateCustomerLocationDto {
  @ApiProperty() @Type(() => Number) @IsLatitude() latitude!: number;
  @ApiProperty() @Type(() => Number) @IsLongitude() longitude!: number;
}

export class CustomerPreferencesDto {
  @ApiPropertyOptional({ description: 'Opt in/out of push notifications about nearby offers' })
  @IsOptional() notifyEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Max distance from a shop (km) to receive push, 1–100' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(100)
  notificationRadiusKm?: number;

  @ApiPropertyOptional({ description: 'Skip push during local quiet hours (21:00–09:00)' })
  @IsOptional() quietHoursEnabled?: boolean;
}

export class RegisterDeviceDto {
  @ApiProperty({ description: 'Firebase Cloud Messaging device token' })
  @IsString() @MinLength(8) @MaxLength(4096)
  fcmToken!: string;
}
