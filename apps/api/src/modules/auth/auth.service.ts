import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, type User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { customAlphabet } from 'nanoid';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { MailService } from '../mail/mail.service';
import { FirebaseService } from '../firebase/firebase.service';
import { PermissionsService } from '../rbac/permissions.service';
import type {
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

const otpGen = customAlphabet('0123456789', 6);
const OTP_TTL = 10 * 60;
const RESET_TTL = 60 * 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly mail: MailService,
    private readonly firebase: FirebaseService,
    private readonly permissions: PermissionsService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, dto.phone ? { phone: dto.phone } : undefined].filter(Boolean) as object[] },
    });
    if (existing) throw new ConflictException('Email or phone already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role ?? UserRole.CUSTOMER,
        isVerified: false,
        isActive: true,
      },
    });
    await this.assignDefaultRole(user.id, user.role);
    return this.issueTokens(user);
  }

  /// Customer-specific signup. Phone is mandatory (we OTP-verify it for push
  /// targeting trust). Creates the User, the linked CustomerProfile, and
  /// fires an OTP to the phone. Tokens are issued immediately so the client
  /// can prompt the user to enter the OTP in-app, post-signup.
  async registerCustomer(dto: RegisterCustomerDto): Promise<AuthResponseDto & { otpSent: boolean }> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { phone: dto.phone }], deletedAt: null },
    });
    if (existing) throw new ConflictException('Email or phone already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        fullName: dto.fullName,
        role: UserRole.CUSTOMER,
        isVerified: false,
        isActive: true,
        latitude: dto.latitude,
        longitude: dto.longitude,
        customerProfile: {
          create: {
            phoneVerified: false,
            notifyEnabled: true,
            notificationRadiusKm: 10,
          },
        },
      },
    });
    await this.assignDefaultRole(user.id, user.role);

    // Send OTP — best-effort, don't fail signup if the SMS gateway hiccups.
    let otpSent = false;
    try {
      await this.requestOtp({ phone: dto.phone });
      otpSent = true;
    } catch (e) {
      this.logger.warn(`Customer ${user.id} registered but OTP send failed: ${(e as Error).message}`);
    }

    const tokens = await this.issueTokens(user);
    return { ...tokens, otpSent };
  }

  /// Seller-owner signup. Role is forced to SELLER_OWNER regardless of input.
  /// Phone is optional (sellers manage their business via panel; they aren't
  /// push targets). Same uniqueness rules as the generic register.
  async registerSeller(dto: RegisterSellerDto): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, dto.phone ? { phone: dto.phone } : undefined].filter(Boolean) as object[], deletedAt: null },
    });
    if (existing) throw new ConflictException('Email or phone already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        fullName: dto.fullName,
        role: UserRole.SELLER_OWNER,
        isVerified: false,
        isActive: true,
      },
    });
    await this.assignDefaultRole(user.id, user.role);
    return this.issueTokens(user);
  }

  /// Verifies the OTP we sent during registerCustomer and flips
  /// `customer_profiles.phoneVerified = true` + `users.isVerified = true`.
  /// Returns the updated user (no new tokens needed).
  async verifyCustomerPhone(userId: string, dto: VerifyCustomerPhoneDto): Promise<{ phoneVerified: true }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { customerProfile: true },
    });
    if (!user || !user.phone) throw new BadRequestException('User has no phone on file');
    if (user.customerProfile?.phoneVerified) {
      return { phoneVerified: true }; // idempotent
    }
    // Reuse the same OTP cache key + bcrypt-hashed value the public endpoint uses.
    const key = `otp:${user.phone}`;
    const hash = await this.cache.get<string>(key);
    if (!hash) throw new BadRequestException('OTP expired or not requested');
    const ok = await bcrypt.compare(dto.otp, hash);
    if (!ok) throw new BadRequestException('Invalid OTP');
    await this.cache.del(key);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { isVerified: true } }),
      this.prisma.customerProfile.upsert({
        where: { userId },
        update: { phoneVerified: true },
        create: { userId, phoneVerified: true },
      }),
    ]);
    return { phoneVerified: true };
  }

  /// Re-sends the OTP to the customer's stored phone. Throttled by the same
  /// rate-limit as the public /auth/otp/request.
  async resendCustomerOtp(userId: string): Promise<{ sent: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.phone) throw new BadRequestException('User has no phone on file');
    return this.requestOtp({ phone: user.phone });
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account is disabled');
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issueTokens(user);
  }

  async refresh(dto: RefreshDto): Promise<AuthResponseDto> {
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string }>(dto.refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashToken(dto.refreshToken);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }
    if (record.userId !== payload.sub) {
      throw new UnauthorizedException('Refresh token mismatch');
    }
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException('User unavailable');
    return this.issueTokens(user);
  }

  async logout(refreshToken: string | undefined, userId: string | undefined): Promise<void> {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });
    } else if (userId) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    if (userId) await this.permissions.invalidate(userId);
  }

  async loginWithFirebase(dto: FirebaseLoginDto): Promise<AuthResponseDto> {
    if (!this.firebase.isEnabled()) {
      throw new BadRequestException('Firebase auth is not configured on this server');
    }
    const claims = await this.firebase.verifyIdToken(dto.idToken).catch(() => {
      throw new UnauthorizedException('Invalid Firebase ID token');
    });

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ firebaseUid: claims.uid }, claims.email ? { email: claims.email } : undefined].filter(
          Boolean,
        ) as object[],
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: claims.email,
          phone: claims.phoneNumber,
          firebaseUid: claims.uid,
          fullName: claims.name ?? claims.email ?? 'OffersKatta User',
          avatarUrl: claims.picture,
          isVerified: claims.emailVerified ?? false,
          role: UserRole.CUSTOMER,
          isActive: true,
        },
      });
      await this.assignDefaultRole(user.id, user.role);
    } else if (!user.firebaseUid) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { firebaseUid: claims.uid, avatarUrl: claims.picture ?? user.avatarUrl, lastLoginAt: new Date() },
      });
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }
    return this.issueTokens(user);
  }

  async requestOtp(dto: RequestOtpDto): Promise<{ sent: true }> {
    const otp = otpGen();
    const hash = await bcrypt.hash(otp, 8);
    await this.cache.set(`otp:${dto.phone}`, hash, OTP_TTL);
    this.logger.log(`OTP for ${dto.phone}: ${otp}`);
    return { sent: true };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResponseDto> {
    const hash = await this.cache.get<string>(`otp:${dto.phone}`);
    if (!hash) throw new UnauthorizedException('OTP expired or not requested');
    const ok = await bcrypt.compare(dto.otp, hash);
    if (!ok) throw new UnauthorizedException('Invalid OTP');
    await this.cache.del(`otp:${dto.phone}`);

    let user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone: dto.phone,
          fullName: 'OffersKatta User',
          role: UserRole.CUSTOMER,
          isVerified: true,
          isActive: true,
        },
      });
      await this.assignDefaultRole(user.id, user.role);
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true, lastLoginAt: new Date() },
      });
    }
    return this.issueTokens(user);
  }

  async requestPasswordReset(dto: RequestPasswordResetDto): Promise<{ sent: true }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await this.cache.set(`reset:${token}`, user.id, RESET_TTL);
      const link = `https://offerhub.example/reset?token=${token}`;
      await this.mail.sendPasswordReset(user.email!, link);
    }
    return { sent: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ ok: true }> {
    const userId = await this.cache.get<string>(`reset:${dto.token}`);
    if (!userId) throw new UnauthorizedException('Invalid or expired reset token');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.cache.del(`reset:${dto.token}`);
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  private async issueTokens(user: User): Promise<AuthResponseDto> {
    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL') ?? '15m';
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL') ?? '30d';

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      { secret: this.config.get<string>('JWT_SECRET'), expiresIn: accessTtl },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id },
      { secret: this.config.get<string>('JWT_REFRESH_SECRET'), expiresIn: refreshTtl },
    );

    const refreshExp = new Date(Date.now() + parseTtlMs(refreshTtl));
    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: this.hashToken(refreshToken), expiresAt: refreshExp },
    });

    // Tell the client whether the customer's phone has been OTP-verified yet so
    // the UI can prompt for the code post-signup. Cheap join, only the boolean.
    const profile = user.role === UserRole.CUSTOMER
      ? await this.prisma.customerProfile.findUnique({
          where: { userId: user.id },
          select: { phoneVerified: true },
        })
      : null;

    return {
      accessToken,
      refreshToken,
      expiresIn: Math.floor(parseTtlMs(accessTtl) / 1000),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        phoneVerified: profile?.phoneVerified,
      },
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async assignDefaultRole(userId: string, role: UserRole): Promise<void> {
    const dbRole = await this.prisma.role.findUnique({ where: { slug: role } });
    if (!dbRole) return;
    const exists = await this.prisma.userRoleAssignment.findFirst({
      where: { userId, roleId: dbRole.id, scopeType: 'GLOBAL' },
    });
    if (!exists) {
      await this.prisma.userRoleAssignment.create({
        data: { userId, roleId: dbRole.id, scopeType: 'GLOBAL' },
      });
    }
  }
}

function parseTtlMs(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!m) return Number(ttl) || 900_000;
  const v = Number(m[1]);
  switch (m[2]) {
    case 's': return v * 1000;
    case 'm': return v * 60_000;
    case 'h': return v * 3_600_000;
    case 'd': return v * 86_400_000;
    default: return 900_000;
  }
}
