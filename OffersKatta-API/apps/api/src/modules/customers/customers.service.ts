import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CustomerPreferencesDto,
  RegisterDeviceDto,
  UpdateCustomerLocationDto,
} from '../auth/dto/auth.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /// GET /customers/me — current customer's user record + profile (location,
  /// notify settings, registered device tokens). For non-customers, returns 403.
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, fullName: true, phone: true, role: true,
        latitude: true, longitude: true, city: true, state: true, country: true,
        customerProfile: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== UserRole.CUSTOMER) {
      throw new ForbiddenException('Only customers have a customer profile');
    }
    // Ensure the profile row exists — covers users created before the split.
    if (!user.customerProfile) {
      const created = await this.prisma.customerProfile.create({
        data: { userId, phoneVerified: !!user.phone, fcmTokens: [], notifyEnabled: true },
      });
      return { ...user, customerProfile: created };
    }
    return user;
  }

  async updateLocation(userId: string, dto: UpdateCustomerLocationDto) {
    await this.assertCustomer(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: { latitude: dto.latitude, longitude: dto.longitude },
      select: { id: true, latitude: true, longitude: true },
    });
  }

  async updatePreferences(userId: string, dto: CustomerPreferencesDto) {
    await this.assertCustomer(userId);
    return this.prisma.customerProfile.upsert({
      where: { userId },
      create: {
        userId,
        notifyEnabled: dto.notifyEnabled ?? true,
        notificationRadiusKm: dto.notificationRadiusKm ?? 10,
        quietHoursEnabled: dto.quietHoursEnabled ?? true,
      },
      update: {
        ...(dto.notifyEnabled !== undefined ? { notifyEnabled: dto.notifyEnabled } : {}),
        ...(dto.notificationRadiusKm !== undefined ? { notificationRadiusKm: dto.notificationRadiusKm } : {}),
        ...(dto.quietHoursEnabled !== undefined ? { quietHoursEnabled: dto.quietHoursEnabled } : {}),
      },
    });
  }

  /// Add an FCM device token to the customer's profile. Idempotent — won't
  /// duplicate the same token. Capped at 10 devices to bound storage.
  async addDevice(userId: string, dto: RegisterDeviceDto) {
    await this.assertCustomer(userId);
    const profile = await this.prisma.customerProfile.findUnique({ where: { userId } });
    const current = profile?.fcmTokens ?? [];
    if (current.includes(dto.fcmToken)) return profile ?? this.ensureProfile(userId);
    if (current.length >= 10) current.shift(); // drop oldest
    const next = [...current, dto.fcmToken];
    return this.prisma.customerProfile.upsert({
      where: { userId },
      create: { userId, fcmTokens: next },
      update: { fcmTokens: next },
    });
  }

  async removeDevice(userId: string, token: string) {
    await this.assertCustomer(userId);
    const profile = await this.prisma.customerProfile.findUnique({ where: { userId } });
    if (!profile) return;
    await this.prisma.customerProfile.update({
      where: { userId },
      data: { fcmTokens: profile.fcmTokens.filter((t) => t !== token) },
    });
  }

  /// "Who would receive a push if I notified within radiusKm of this offer?"
  /// Returns the recipient count + a redacted sample for the seller's UI to
  /// confirm before triggering the real send. No FCM call happens here.
  ///
  /// Resolves the offer's branch coords first, then bounding-box filters
  /// customer_profiles with phoneVerified=true, notifyEnabled=true, last-known
  /// lat/lng inside the box, then exact-distance filters with haversine.
  async previewNearbyForOffer(offerId: string, requestingUserId: string, radiusKm: number) {
    if (radiusKm <= 0 || radiusKm > 100) {
      throw new BadRequestException('radiusKm must be between 1 and 100');
    }
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: { branch: { select: { id: true, latitude: true, longitude: true, brand: { select: { ownerId: true } } } } },
    });
    if (!offer) throw new NotFoundException('Offer not found');

    // Authorisation: only the brand owner or SUPER_ADMIN may peek.
    const requester = await this.prisma.user.findUnique({ where: { id: requestingUserId } });
    const isAdmin = requester?.role === UserRole.SUPER_ADMIN;
    const isOwner = offer.branch.brand?.ownerId === requestingUserId;
    if (!isAdmin && !isOwner) throw new ForbiddenException('Only the offer owner can preview push recipients');

    // PostGIS: ST_DWithin enforces the requested radius (GIST-indexed), and
    // the trailing ST_Distance comparison enforces each customer's own opt-in
    // radius. Only TABLE names are snake_cased via @@map — columns stay
    // camelCase, hence the double-quoting.
    const lng = offer.branch.longitude;
    const lat = offer.branch.latitude;
    const radiusMeters = radiusKm * 1000;
    interface Cand {
      id: string;
      fullName: string | null;
      distanceKm: number;
      fcmTokens: string[];
    }
    const inRangeRaw = await this.prisma.$queryRaw<Cand[]>(Prisma.sql`
      SELECT
        u."id"                 AS "id",
        u."fullName"           AS "fullName",
        cp."fcmTokens"         AS "fcmTokens",
        ST_Distance(u."geog", ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000.0 AS "distanceKm"
      FROM "users" u
      JOIN "customer_profiles" cp ON cp."userId" = u."id"
      WHERE u."role"           = 'CUSTOMER'
        AND u."isActive"       = true
        AND u."deletedAt"      IS NULL
        AND u."geog"           IS NOT NULL
        AND cp."phoneVerified" = true
        AND cp."notifyEnabled" = true
        AND ST_DWithin(u."geog", ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusMeters})
        AND ST_Distance(u."geog", ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000.0
            <= cp."notificationRadiusKm"
      ORDER BY "distanceKm" ASC
      LIMIT 5000
    `);
    const inRange = inRangeRaw.map((c) => ({
      ...c,
      fcmTokens: c.fcmTokens ?? [],
      distanceKm: Number(c.distanceKm),
    }));

    const reachableTokens = inRange.flatMap((c) => c.fcmTokens);
    return {
      offerId,
      radiusKm,
      branchCoords: { latitude: offer.branch.latitude, longitude: offer.branch.longitude },
      customerCount: inRange.length,
      deviceCount: reachableTokens.length,
      sample: inRange.slice(0, 10).map((c) => ({
        id: c.id,
        fullName: c.fullName,
        distanceKm: Number(c.distanceKm.toFixed(2)),
      })),
    };
  }

  private async assertCustomer(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (u?.role !== UserRole.CUSTOMER) {
      throw new ForbiddenException('Only customers can perform this action');
    }
  }

  private async ensureProfile(userId: string) {
    return this.prisma.customerProfile.upsert({
      where: { userId }, update: {}, create: { userId },
    });
  }
}
