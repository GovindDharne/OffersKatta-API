import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BrandStatus, type BusinessBrand, type Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { paginate, type PaginatedResult } from '../../common/dto/pagination.dto';
import { slugify, uniqueSlugSuffix } from '../../common/utils/slug';
import type {
  CreateBrandDto,
  ListBrandsDto,
  UpdateBrandDto,
  VerifyBrandDto,
} from './dto/brand.dto';

@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async create(ownerId: string, dto: CreateBrandDto): Promise<BusinessBrand> {
    const slug = await this.uniqueSlug(dto.name);
    const brand = await this.prisma.businessBrand.create({
      data: {
        ownerId,
        createdById: ownerId,
        updatedById: ownerId,
        name: dto.name,
        slug,
        description: dto.description,
        businessType: dto.businessType,
        websiteUrl: dto.websiteUrl,
        logoUrl: dto.logoUrl,
        coverUrl: dto.coverUrl,
        gstNumber: dto.gstNumber,
        panNumber: dto.panNumber,
        categories: dto.categoryIds?.length
          ? { create: dto.categoryIds.map((categoryId) => ({ categoryId })) }
          : undefined,
        subscription: { create: {} },
      },
    });
    return brand;
  }

  async findById(id: string): Promise<BusinessBrand> {
    const cached = await this.cache.get<BusinessBrand>(`brand:${id}`);
    if (cached) return cached;
    const brand = await this.prisma.businessBrand.findFirst({
      where: { id, deletedAt: null },
      include: { categories: { include: { category: true } }, subscription: true },
    });
    if (!brand) throw new NotFoundException('Brand not found');
    await this.cache.set(`brand:${id}`, brand, 60 * 60);
    return brand;
  }

  async findBySlug(slug: string): Promise<BusinessBrand> {
    const brand = await this.prisma.businessBrand.findFirst({
      where: { slug, deletedAt: null },
      include: { categories: { include: { category: true } } },
    });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async list(query: ListBrandsDto): Promise<PaginatedResult<BusinessBrand>> {
    const where: Prisma.BusinessBrandWhereInput = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.businessType) where.businessType = query.businessType;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [total, data] = await Promise.all([
      this.prisma.businessBrand.count({ where }),
      this.prisma.businessBrand.findMany({
        where,
        include: { _count: { select: { branches: true } } },
        skip: query.skip,
        take: query.limit,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder },
      }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async listOwn(ownerId: string, query: ListBrandsDto): Promise<PaginatedResult<BusinessBrand>> {
    const where: Prisma.BusinessBrandWhereInput = { deletedAt: null, ownerId };
    if (query.status) where.status = query.status;
    if (query.businessType) where.businessType = query.businessType;
    const [total, data] = await Promise.all([
      this.prisma.businessBrand.count({ where }),
      this.prisma.businessBrand.findMany({
        where,
        include: { _count: { select: { branches: true } }, subscription: true },
        skip: query.skip,
        take: query.limit,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder },
      }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async update(id: string, dto: UpdateBrandDto, actorId: string, actorRole: UserRole): Promise<BusinessBrand> {
    await this.ensureWriteAccess(id, actorId, actorRole);
    const data: Prisma.BusinessBrandUpdateInput = {
      name: dto.name,
      description: dto.description,
      businessType: dto.businessType,
      websiteUrl: dto.websiteUrl,
      logoUrl: dto.logoUrl,
      coverUrl: dto.coverUrl,
      gstNumber: dto.gstNumber,
      panNumber: dto.panNumber,
      updatedById: actorId,
    };
    if (dto.categoryIds) {
      data.categories = {
        deleteMany: {},
        create: dto.categoryIds.map((categoryId) => ({ categoryId })),
      };
    }
    const brand = await this.prisma.businessBrand.update({ where: { id }, data });
    await this.cache.del(`brand:${id}`);
    return brand;
  }

  async verify(id: string, dto: VerifyBrandDto): Promise<BusinessBrand> {
    const brand = await this.prisma.businessBrand.update({
      where: { id },
      data: {
        status: dto.status,
        isVerified: dto.status === BrandStatus.ACTIVE,
        verifiedAt: dto.status === BrandStatus.ACTIVE ? new Date() : null,
      },
    });
    await this.cache.del(`brand:${id}`);
    return brand;
  }

  async remove(id: string, actorId: string, actorRole: UserRole): Promise<void> {
    await this.ensureWriteAccess(id, actorId, actorRole);
    await this.prisma.businessBrand.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    await this.cache.del(`brand:${id}`);
  }

  // ─── Follow / unfollow ────────────────────────────────────
  // Customers follow brands to receive push for new offers regardless of
  // distance. We don't enforce role=CUSTOMER here — sellers/admins can also
  // follow brands for the same reason; the push targeting will still respect
  // each user's notification opt-ins.

  async follow(brandId: string, userId: string): Promise<{ following: true }> {
    // Make sure the brand actually exists + isn't soft-deleted.
    const brand = await this.prisma.businessBrand.findFirst({
      where: { id: brandId, deletedAt: null },
      select: { id: true },
    });
    if (!brand) throw new NotFoundException('Brand not found');
    // Idempotent upsert — second tap on "Follow" just no-ops.
    await this.prisma.brandFollow.upsert({
      where: { userId_brandId: { userId, brandId } },
      create: { userId, brandId },
      update: {},
    });
    return { following: true };
  }

  async unfollow(brandId: string, userId: string): Promise<{ following: false }> {
    await this.prisma.brandFollow.deleteMany({ where: { userId, brandId } });
    return { following: false };
  }

  async followStatus(brandId: string, userId: string): Promise<{ following: boolean; followerCount: number }> {
    const [row, count] = await Promise.all([
      this.prisma.brandFollow.findUnique({
        where: { userId_brandId: { userId, brandId } },
        select: { userId: true },
      }),
      this.prisma.brandFollow.count({ where: { brandId } }),
    ]);
    return { following: Boolean(row), followerCount: count };
  }

  async listFollowsByUser(userId: string) {
    return this.prisma.brandFollow.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        brand: {
          select: { id: true, name: true, slug: true, logoUrl: true, businessType: true, isVerified: true },
        },
      },
    });
  }

  /// Used by PushService to fan out an offer to brand followers. Returns
  /// just user-id + fcm-token pairs for the brand's active followers who
  /// have notifications enabled.
  async followersForPush(brandId: string): Promise<Array<{ userId: string; fcmTokens: string[]; latitude: number | null; longitude: number | null }>> {
    const rows = await this.prisma.brandFollow.findMany({
      where: {
        brandId,
        user: {
          isActive: true,
          deletedAt: null,
          customerProfile: { is: { notifyEnabled: true, phoneVerified: true } },
        },
      },
      select: {
        user: {
          select: {
            id: true, latitude: true, longitude: true,
            customerProfile: { select: { fcmTokens: true } },
          },
        },
      },
    });
    return rows
      .map((r) => ({
        userId: r.user.id,
        fcmTokens: r.user.customerProfile?.fcmTokens ?? [],
        latitude: r.user.latitude,
        longitude: r.user.longitude,
      }))
      .filter((r) => r.fcmTokens.length > 0);
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    for (let i = 0; i < 50; i++) {
      const candidate = uniqueSlugSuffix(base, i);
      const exists = await this.prisma.businessBrand.findUnique({ where: { slug: candidate } });
      if (!exists) return candidate;
    }
    return `${base}-${Date.now()}`;
  }

  private async ensureWriteAccess(brandId: string, actorId: string, actorRole: UserRole): Promise<void> {
    if (actorRole === UserRole.SUPER_ADMIN) return;
    const brand = await this.prisma.businessBrand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException('Brand not found');
    if (brand.ownerId !== actorId) throw new ForbiddenException('Not the brand owner');
  }
}
