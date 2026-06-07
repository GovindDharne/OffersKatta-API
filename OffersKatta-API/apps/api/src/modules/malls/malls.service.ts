import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Mall } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, type PaginatedResult } from '../../common/dto/pagination.dto';
import { slugify, uniqueSlugSuffix } from '../../common/utils/slug';
import type { CreateMallDto, ListMallsDto, NearbyMallsDto, UpdateMallDto } from './dto/mall.dto';

@Injectable()
export class MallsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actorId: string, dto: CreateMallDto): Promise<Mall> {
    const slug = await this.uniqueSlug(dto.name);
    return this.prisma.mall.create({
      data: {
        ...dto,
        slug,
        workingHours: dto.workingHours as Prisma.InputJsonValue | undefined,
        createdById: actorId,
        updatedById: actorId,
      },
    });
  }

  async list(query: ListMallsDto): Promise<PaginatedResult<Mall>> {
    const where: Prisma.MallWhereInput = { deletedAt: null, isActive: true };
    if (query.city) where.city = { equals: query.city, mode: 'insensitive' };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { city: { contains: query.search, mode: 'insensitive' } },
        { addressLine1: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [total, data] = await Promise.all([
      this.prisma.mall.count({ where }),
      this.prisma.mall.findMany({
        where,
        include: { _count: { select: { branches: true } } },
        skip: query.skip,
        take: query.limit,
        orderBy: { [query.sortBy ?? 'name']: query.sortOrder ?? 'asc' },
      }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  /// Malls within `radiusKm` of (latitude, longitude), sorted by distance.
  /// PostGIS phase 1: ST_DWithin (GIST-indexed) gets the in-range mall ids +
  /// exact spherical distances. Phase 2: hydrate via Prisma so we keep the
  /// `_count.branches` include. Distances are mapped back and the rows
  /// re-sorted to preserve nearest-first order.
  async nearby(query: NearbyMallsDto): Promise<PaginatedResult<Mall & { distanceKm: number }>> {
    const lng = query.longitude;
    const lat = query.latitude;
    const radiusMeters = query.radiusKm * 1000;
    const hits = await this.prisma.$queryRaw<Array<{ id: string; distanceKm: number }>>(Prisma.sql`
      SELECT
        "id",
        ST_Distance("geog", ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000.0 AS "distanceKm"
      FROM "malls"
      WHERE "deletedAt" IS NULL
        AND "isActive" = true
        AND "geog" IS NOT NULL
        AND ST_DWithin("geog", ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusMeters})
      ORDER BY "distanceKm" ASC
      LIMIT 500
    `);
    if (hits.length === 0) {
      return paginate<Mall & { distanceKm: number }>([], 0, query.page, query.limit);
    }
    const distById = new Map(hits.map((h) => [h.id, Number(h.distanceKm)]));
    const rows = await this.prisma.mall.findMany({
      where: { id: { in: hits.map((h) => h.id) } },
      include: { _count: { select: { branches: true } } },
    });
    const ranked = rows
      .map((m) => ({ ...m, distanceKm: distById.get(m.id) ?? Number.POSITIVE_INFINITY }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
    return paginate(ranked, ranked.length, query.page, query.limit);
  }

  async findById(id: string): Promise<Mall> {
    const mall = await this.prisma.mall.findFirst({
      where: { id, deletedAt: null },
      include: {
        branches: {
          where: { deletedAt: null, status: 'ACTIVE' },
          select: {
            id: true, name: true, shopNumber: true,
            brand: { select: { id: true, name: true, slug: true, businessType: true } },
          },
        },
      },
    });
    if (!mall) throw new NotFoundException('Mall not found');
    return mall;
  }

  async update(id: string, dto: UpdateMallDto, actorId: string): Promise<Mall> {
    const { workingHours, ...rest } = dto;
    return this.prisma.mall.update({
      where: { id },
      data: {
        ...rest,
        workingHours: workingHours as Prisma.InputJsonValue | undefined,
        updatedById: actorId,
      },
    });
  }

  async remove(id: string, actorId: string): Promise<void> {
    await this.prisma.mall.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, updatedById: actorId },
    });
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    for (let i = 0; i < 50; i++) {
      const candidate = uniqueSlugSuffix(base, i);
      const exists = await this.prisma.mall.findUnique({ where: { slug: candidate } });
      if (!exists) return candidate;
    }
    return `${base}-${Date.now()}`;
  }
}
