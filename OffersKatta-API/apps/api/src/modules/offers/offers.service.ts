import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OfferStatus, Prisma, type Offer, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { paginate, type PaginatedResult } from '../../common/dto/pagination.dto';
import { slugify, uniqueSlugSuffix } from '../../common/utils/slug';
import { TerritoryScopeService } from '../territories/territory-scope.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type {
  CreateOfferDto,
  ListOffersDto,
  NearbyOffersDto,
  UpdateOfferDto,
} from './dto/offer.dto';

/// A store an offer reaches, with enough detail for the offer-detail UI to
/// render an address + "Get directions". `isPrimary` marks the offer's anchor
/// branch (shown first / most prominently).
export interface ReachableBranch {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  phone: string | null;
  latitude: number;
  longitude: number;
  isPrimary: boolean;
}

/// Minimal shape resolveReachableBranches() reads off a findById() result.
type OfferWithScope = Offer & {
  branch?: { brandId?: string; brand?: { id: string } | null } | null;
  branches?: Array<{ branchId: string }>;
};

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly scope: TerritoryScopeService,
  ) {}

  async create(actorId: string, actorRole: UserRole, dto: CreateOfferDto): Promise<Offer> {
    await this.assertBranchWritable(dto.branchId, actorId, actorRole);
    const slug = await this.uniqueSlug(dto.branchId, dto.title);
    const offer = await this.prisma.offer.create({
      data: {
        branchId: dto.branchId,
        title: dto.title,
        titleHindi: dto.titleHindi,
        slug,
        description: dto.description,
        descriptionRegional: dto.descriptionRegional,
        termsAndConditions: dto.termsAndConditions,
        offerType: dto.offerType,
        discountValue: dto.discountValue,
        maxDiscountAmount: dto.maxDiscountAmount,
        minPurchaseAmount: dto.minPurchaseAmount,
        originalPrice: dto.originalPrice,
        finalPrice: dto.finalPrice,
        couponCode: dto.couponCode,
        images: dto.images ?? [],
        videoUrl: dto.videoUrl,
        listImage: dto.listImage,
        startsAt: new Date(dto.startsAt),
        expiresAt: new Date(dto.expiresAt),
        status: dto.status ?? OfferStatus.DRAFT,
        isFeatured: dto.isFeatured ?? false,
        isStackable: dto.isStackable ?? false,
        priority: dto.priority,
        visibility: dto.visibility,
        applicableProducts: dto.applicableProducts,
        excludedProducts: dto.excludedProducts,
        tags: dto.tags ?? [],
        maxRedemptions: dto.maxRedemptions,
        redemptionPerUser: dto.redemptionPerUser,
        createdById: actorId,
        updatedById: actorId,
        // Recurring window (happy hours, etc.)
        isRecurring: dto.isRecurring ?? false,
        recurringDays: dto.recurringDays ?? [],
        recurringStartTime: dto.recurringStartTime,
        recurringEndTime: dto.recurringEndTime,
        // Scope of the offer across the brand's branches (defaults to BRANCH).
        scope: dto.scope,
        scopeCity: dto.scope === 'CITY' ? dto.scopeCity : undefined,
        scopeTags: dto.scope === 'TAGS' ? (dto.scopeTags ?? []) : [],
        categories: dto.categoryIds?.length
          ? { create: dto.categoryIds.map((id) => ({ categoryId: id })) }
          : undefined,
        cardTypes: dto.cardOffers?.length
          ? {
              create: dto.cardOffers.map((c) => ({
                cardTypeId: c.cardTypeId,
                cardCategory: c.cardCategory,
                benefitType: c.benefitType,
                benefitValue: c.benefitValue,
                minSpend: c.minSpend,
                maxBenefit: c.maxBenefit,
              })),
            }
          : undefined,
        branches: dto.branchIds?.length
          ? { create: dto.branchIds.map((branchId) => ({ branchId })) }
          : undefined,
        platforms: dto.platforms?.length
          ? {
              create: dto.platforms.map((p) => ({
                platformName: p.platformName,
                url: p.url,
              })),
            }
          : undefined,
      },
    });
    await this.cache.invalidatePrefix('nearby:');
    return offer;
  }

  async list(query: ListOffersDto, actor?: AuthUser): Promise<PaginatedResult<Offer>> {
    await this.expireBoosts();
    const where: Prisma.OfferWhereInput = { deletedAt: null };
    // Territory managers only see offers whose branch is in their region/zone.
    const scopeWhere = await this.scope.branchScopeWhere(actor?.id, actor?.role as UserRole | undefined);
    if (scopeWhere) where.AND = [{ branch: { is: scopeWhere } }];
    if (query.status) where.status = query.status;
    if (query.branchId) where.branchId = query.branchId;
    if (query.brandId) where.branch = { brandId: query.brandId };
    if (query.mallId) {
      // Compose with brandId if both are present.
      where.branch = { ...(where.branch as object | undefined), mallId: query.mallId };
    }
    if (query.isFeatured !== undefined) where.isFeatured = query.isFeatured;
    if (query.isRecurring !== undefined) where.isRecurring = query.isRecurring;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.categoryId) {
      where.categories = { some: { categoryId: query.categoryId } };
    }
    // Bank / card filters: an offer matches if any of its OfferCardType links
    // point to a card whose bank (or id) matches the query.
    if (query.cardTypeId) {
      where.cardTypes = { some: { cardTypeId: query.cardTypeId } };
    } else if (query.bankId) {
      where.cardTypes = { some: { cardType: { bankId: query.bankId } } };
    }

    // Featured offers always float to the top regardless of the user's chosen sort.
    // The user's sortBy/sortOrder then becomes the tiebreaker among (featured)
    // and (non-featured) groups.
    const orderBy: Prisma.OfferOrderByWithRelationInput[] = [
      { isFeatured: 'desc' },
      { [query.sortBy ?? 'createdAt']: query.sortOrder } as Prisma.OfferOrderByWithRelationInput,
    ];

    const [total, data] = await Promise.all([
      this.prisma.offer.count({ where }),
      this.prisma.offer.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true, city: true, brand: { select: { id: true, name: true } } } },
          cardTypes: { include: { cardType: { include: { bank: true } } } },
          // Needed by decorateWithBranchCount() for BRANCH-scope offers —
          // count = primary + explicit additional branches.
          branches: { select: { branchId: true } },
        },
        skip: query.skip,
        take: query.limit,
        orderBy,
      }),
    ]);
    const decorated = await this.decorateWithBranchCount(data);
    return paginate(decorated, total, query.page, query.limit);
  }

  async listForBranch(branchId: string, query: ListOffersDto): Promise<PaginatedResult<Offer>> {
    query.branchId = branchId;
    return this.list(query);
  }

  async findById(id: string): Promise<Offer> {
    const offer = await this.prisma.offer.findFirst({
      where: { id, deletedAt: null },
      include: {
        branch: { include: { brand: { select: { id: true, name: true, slug: true } } } },
        categories: { include: { category: true } },
        cardTypes: { include: { cardType: { include: { bank: true } } } },
        branches: { include: { branch: { select: { id: true, name: true, city: true } } } },
        platforms: true,
      },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }

  /// Public detail fetch — same as findById but also resolves the offer's
  /// SCOPE into the concrete list of stores it actually reaches, so the detail
  /// page can show every store (matching the "N stores" badge), not just the
  /// primary branch. The primary branch is flagged + sorted first.
  async findByIdWithReach(id: string): Promise<Offer & { reachableBranches: ReachableBranch[] }> {
    const offer = await this.findById(id);
    const reachableBranches = await this.resolveReachableBranches(offer as OfferWithScope);
    return { ...(offer as Offer), reachableBranches };
  }

  /// Expand an offer's scope to the active branches it covers:
  ///   BRANCH → primary + explicitly-linked branches
  ///   BRAND  → every active branch of the brand
  ///   CITY   → brand's active branches in scopeCity
  ///   TAGS   → brand's active branches matching any scopeTag
  /// The primary branch is always included (union) so we never show fewer
  /// stores than the customer expects.
  private async resolveReachableBranches(offer: OfferWithScope): Promise<ReachableBranch[]> {
    const primaryId = offer.branchId;
    const brandId = offer.branch?.brand?.id ?? offer.branch?.brandId;

    let where: Prisma.BusinessBranchWhereInput;
    if (!brandId) {
      where = { id: primaryId };
    } else {
      switch (offer.scope) {
        case 'BRAND':
          where = { brandId, deletedAt: null, status: 'ACTIVE' };
          break;
        case 'CITY':
          where = offer.scopeCity
            ? { brandId, deletedAt: null, status: 'ACTIVE', city: { equals: offer.scopeCity, mode: 'insensitive' } }
            : { id: primaryId };
          break;
        case 'TAGS':
          where = offer.scopeTags?.length
            ? { brandId, deletedAt: null, status: 'ACTIVE', tags: { hasSome: offer.scopeTags } }
            : { id: primaryId };
          break;
        default: {
          // BRANCH scope — primary + explicit additional links.
          const extraIds = (offer.branches ?? []).map((b) => b.branchId);
          where = { id: { in: [primaryId, ...extraIds] } };
        }
      }
    }

    const rows = await this.prisma.businessBranch.findMany({
      where,
      select: {
        id: true, name: true, addressLine1: true, addressLine2: true,
        city: true, state: true, postalCode: true, phone: true,
        latitude: true, longitude: true,
      },
      orderBy: { name: 'asc' },
      take: 200,
    });

    // Guarantee the primary is present even if scope filtered it out (e.g. the
    // primary branch sits in a different city than scopeCity).
    if (primaryId && !rows.some((r) => r.id === primaryId)) {
      const primary = await this.prisma.businessBranch.findUnique({
        where: { id: primaryId },
        select: {
          id: true, name: true, addressLine1: true, addressLine2: true,
          city: true, state: true, postalCode: true, phone: true,
          latitude: true, longitude: true,
        },
      });
      if (primary) rows.unshift(primary);
    }

    return rows
      .map((r) => ({ ...r, isPrimary: r.id === primaryId }))
      .sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1));
  }

  async incrementView(id: string): Promise<void> {
    await this.prisma.offer.update({ where: { id }, data: { viewCount: { increment: 1 } } });
  }

  async incrementClick(id: string): Promise<void> {
    await this.prisma.offer.update({ where: { id }, data: { clickCount: { increment: 1 } } });
  }

  async incrementShare(id: string): Promise<void> {
    await this.prisma.offer.update({ where: { id }, data: { shareCount: { increment: 1 } } });
  }

  async update(
    id: string,
    dto: UpdateOfferDto,
    actorId: string,
    actorRole: UserRole,
  ): Promise<Offer> {
    const existing = await this.findById(id);
    await this.assertBranchWritable(existing.branchId, actorId, actorRole);
    // categoryIds/cardTypeIds are relation writes — they must not be spread into
    // the top-level data; pluck them out and translate to nested Prisma writes.
    const { categoryIds, cardOffers, branchIds, platforms, ...rest } = dto;
    const data: Prisma.OfferUpdateInput = { ...rest, updatedById: actorId };
    if (dto.startsAt) data.startsAt = new Date(dto.startsAt);
    if (dto.expiresAt) data.expiresAt = new Date(dto.expiresAt);
    // When scope changes, blank out the fields that don't apply to the new scope
    // so stale data (e.g. scopeCity left from a previous CITY scope) doesn't
    // accidentally affect resolution.
    if (dto.scope !== undefined) {
      if (dto.scope !== 'CITY') data.scopeCity = null;
      if (dto.scope !== 'TAGS') data.scopeTags = [];
    }
    if (categoryIds) {
      data.categories = {
        deleteMany: {},
        create: categoryIds.map((cid) => ({ categoryId: cid })),
      };
    }
    if (cardOffers) {
      data.cardTypes = {
        deleteMany: {},
        create: cardOffers.map((c) => ({
          cardTypeId: c.cardTypeId,
          cardCategory: c.cardCategory,
          benefitType: c.benefitType,
          benefitValue: c.benefitValue,
          minSpend: c.minSpend,
          maxBenefit: c.maxBenefit,
        })),
      };
    }
    if (branchIds) {
      data.branches = {
        deleteMany: {},
        create: branchIds.map((branchId) => ({ branchId })),
      };
    }
    if (platforms) {
      data.platforms = {
        deleteMany: {},
        create: platforms.map((p) => ({ platformName: p.platformName, url: p.url })),
      };
    }
    const updated = await this.prisma.offer.update({ where: { id }, data });
    await this.cache.invalidatePrefix('nearby:');
    return updated;
  }

  async remove(id: string, actorId: string, actorRole: UserRole): Promise<void> {
    const existing = await this.findById(id);
    await this.assertBranchWritable(existing.branchId, actorId, actorRole);
    await this.prisma.offer.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actorId, status: OfferStatus.ARCHIVED },
    });
    await this.cache.invalidatePrefix('nearby:');
  }

  /// Customer-facing "offers near me" search. Honours offer.scope so a BRAND-
  /// scoped Peter England offer with anchor in Mumbai still surfaces for a
  /// customer near a Peter England store in Pune.
  ///
  /// Algorithm (two-phase, all in app — no raw SQL):
  ///   1. Pull all active branches inside the customer's bounding box (the
  ///      "in-range" set). Haversine-filter to the actual radius.
  ///   2. For each in-range branch, work out which brands/cities/tags are
  ///      represented, and pull all published offers whose anchor brand
  ///      matches OR whose primary/additional branch is in range.
  ///   3. For each offer, find the *closest* in-range branch that the offer
  ///      actually reaches (via `isReachable`). Drop offers with no match
  ///      (handles CITY/TAGS misses inside the pulled candidates).
  ///   4. Dedup by offerId (one card per offer regardless of how many of the
  ///      brand's branches qualify), sort featured-first by distance, paginate.
  async nearby(query: NearbyOffersDto): Promise<PaginatedResult<Offer & { distanceKm: number }>> {
    await this.expireBoosts();
    const key = `nearby:${query.latitude.toFixed(3)}:${query.longitude.toFixed(3)}:${query.radiusKm}:${query.categoryId ?? ''}:${query.bankId ?? ''}:${query.cardTypeId ?? ''}:${query.mallId ?? ''}:${query.page}:${query.limit}`;
    const cached = await this.cache.get<PaginatedResult<Offer & { distanceKm: number }>>(key);
    if (cached) return cached;

    const now = new Date();

    // ── Phase 1: in-range branches (PostGIS) ──────────────────
    // ST_DWithin uses the GIST index for an O(log n) bounding scan, then
    // PostGIS computes exact spherical distance only for the candidate set.
    // Replaces a JS-side boundingBox prefilter + per-row haversine.
    // NB: only TABLE names are snake_cased via @@map — COLUMNS keep their
    // camelCase identifiers, so every column is double-quoted below.
    const mallClause = query.mallId
      ? Prisma.sql`AND "mallId" = ${query.mallId}::uuid`
      : Prisma.empty;
    const radiusMeters = query.radiusKm * 1000;
    const branchRows = await this.prisma.$queryRaw<Array<{
      id: string;
      name: string;
      brandId: string;
      city: string;
      tags: string[];
      latitude: number;
      longitude: number;
      mallId: string | null;
      distanceKm: number;
    }>>(Prisma.sql`
      SELECT
        "id",
        "name",
        "brandId",
        "city",
        "tags",
        "latitude",
        "longitude",
        "mallId",
        ST_Distance(
          "geog",
          ST_SetSRID(ST_MakePoint(${query.longitude}, ${query.latitude}), 4326)::geography
        ) / 1000.0 AS "distanceKm"
      FROM "business_branches"
      WHERE "deletedAt" IS NULL
        AND "status" = 'ACTIVE'
        AND "geog" IS NOT NULL
        ${mallClause}
        AND ST_DWithin(
          "geog",
          ST_SetSRID(ST_MakePoint(${query.longitude}, ${query.latitude}), 4326)::geography,
          ${radiusMeters}
        )
      ORDER BY "distanceKm" ASC
      LIMIT 2000
    `);
    // Cast numerics — pg returns numeric/double as strings in some drivers.
    const inRange = branchRows.map((b) => ({
      ...b,
      latitude: Number(b.latitude),
      longitude: Number(b.longitude),
      distanceKm: Number(b.distanceKm),
    }));

    if (inRange.length === 0) {
      const empty = paginate<Offer & { distanceKm: number }>([], 0, query.page, query.limit);
      await this.cache.set(key, empty, 2 * 60);
      return empty;
    }

    const inRangeBranchIds = inRange.map((b) => b.id);
    const inRangeBrandIds = Array.from(new Set(inRange.map((b) => b.brandId)));

    // ── Phase 2: offers whose reachable set might intersect in-range ──
    const where: Prisma.OfferWhereInput = {
      deletedAt: null,
      status: OfferStatus.PUBLISHED,
      startsAt: { lte: now },
      expiresAt: { gte: now },
      OR: [
        // a) explicit BRANCH scope: primary branch is in range
        { branchId: { in: inRangeBranchIds } },
        // b) explicit BRANCH scope: an additional branch is in range
        { branches: { some: { branchId: { in: inRangeBranchIds } } } },
        // c) brand-wide / city / tag scope on a brand that has at least one
        //    in-range branch. We over-fetch then narrow with isReachable.
        {
          scope: { in: ['BRAND', 'CITY', 'TAGS'] },
          branch: { brandId: { in: inRangeBrandIds } },
        },
      ],
    };
    if (query.categoryId) {
      where.categories = { some: { categoryId: query.categoryId } };
    }
    if (query.cardTypeId) {
      where.cardTypes = { some: { cardTypeId: query.cardTypeId } };
    } else if (query.bankId) {
      where.cardTypes = { some: { cardType: { bankId: query.bankId } } };
    }

    const offers = await this.prisma.offer.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true, city: true, latitude: true, longitude: true, brand: { select: { id: true, name: true } } } },
        branches: { select: { branchId: true } },
      },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      take: 1000,
    });

    // ── Phase 3: pick closest reachable branch per offer ──────
    type OfferRow = (typeof offers)[number];
    type Anchor = (typeof inRange)[number];

    const isReachable = (o: OfferRow, b: Anchor): boolean => {
      if (o.scope === 'BRANCH') {
        if (b.id === o.branchId) return true;
        return o.branches.some((ob) => ob.branchId === b.id);
      }
      if (b.brandId !== o.branch.brand?.id) return false;
      if (o.scope === 'BRAND') return true;
      if (o.scope === 'CITY') {
        return Boolean(o.scopeCity) && b.city.toLowerCase() === o.scopeCity!.toLowerCase();
      }
      if (o.scope === 'TAGS') {
        const wanted = new Set((o.scopeTags ?? []).map((t) => t.toLowerCase()));
        return b.tags.some((t) => wanted.has(t.toLowerCase()));
      }
      return false;
    };

    const ranked: Array<Offer & { distanceKm: number }> = [];
    for (const o of offers) {
      let best: Anchor | null = null;
      for (const b of inRange) {
        if (!isReachable(o, b)) continue;
        if (!best || b.distanceKm < best.distanceKm) best = b;
      }
      if (!best) continue;
      // Surface the offer with its CLOSEST reachable branch as the anchor —
      // so the customer sees "1.2 km from <local store>" instead of the brand
      // HQ's distance + name. Brand info is preserved (same brand throughout).
      ranked.push({
        ...(o as unknown as Offer),
        branch: {
          ...o.branch,
          id: best.id,
          name: best.name,
          city: best.city,
          latitude: best.latitude,
          longitude: best.longitude,
        },
        distanceKm: best.distanceKm,
      } as Offer & { distanceKm: number });
    }

    ranked.sort((a, b) => {
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
      return a.distanceKm - b.distanceKm;
    });

    const total = ranked.length;
    const start = query.skip;
    const slice = ranked.slice(start, start + query.limit);
    // Decorate only the page worth of items — the BRANDS lookup is then
    // bounded by 1 brand × pageSize at worst.
    const decorated = await this.decorateWithBranchCount(slice);
    const result = paginate(decorated as Array<Offer & { distanceKm: number }>, total, query.page, query.limit);
    await this.cache.set(key, result, 2 * 60);
    return result;
  }

  /// Annotate each offer with `reachableBranchCount` — the number of branches
  /// the offer actually applies to (after resolving its scope). Powers the
  /// "Available at 14 stores" badge on offer cards so chain-wide offers
  /// communicate their reach without changing query semantics.
  ///
  /// Batches by brand: one branch fetch per distinct brand in the page.
  private async decorateWithBranchCount<T extends {
    scope: string;
    scopeCity: string | null;
    scopeTags: string[];
    branches?: Array<{ branchId: string }>;
    branch?: { brand?: { id: string } | null } | null;
  }>(offers: T[]): Promise<Array<T & { reachableBranchCount: number }>> {
    const brandIds = Array.from(
      new Set(offers.map((o) => o.branch?.brand?.id).filter((x): x is string => !!x)),
    );
    if (brandIds.length === 0) {
      return offers.map((o) => ({ ...o, reachableBranchCount: 1 }));
    }
    const branches = await this.prisma.businessBranch.findMany({
      where: { brandId: { in: brandIds }, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, brandId: true, city: true, tags: true },
    });
    const byBrand = new Map<string, typeof branches>();
    for (const b of branches) {
      const arr = byBrand.get(b.brandId);
      if (arr) arr.push(b);
      else byBrand.set(b.brandId, [b]);
    }

    return offers.map((o) => {
      const brandBranches = byBrand.get(o.branch?.brand?.id ?? '') ?? [];
      let count = 1;
      switch (o.scope) {
        case 'BRAND':
          count = brandBranches.length || 1;
          break;
        case 'CITY':
          if (o.scopeCity) {
            const want = o.scopeCity.toLowerCase();
            count = brandBranches.filter((b) => b.city.toLowerCase() === want).length || 1;
          }
          break;
        case 'TAGS': {
          if (o.scopeTags?.length) {
            const want = new Set(o.scopeTags.map((t) => t.toLowerCase()));
            count = brandBranches.filter((b) => b.tags.some((t) => want.has(t.toLowerCase()))).length || 1;
          }
          break;
        }
        default: {
          // BRANCH scope = primary + explicit additional.
          const extras = o.branches?.length ?? 0;
          count = 1 + extras;
        }
      }
      return { ...o, reachableBranchCount: count };
    });
  }

  async assertBranchWritable(branchId: string, actorId: string, actorRole: UserRole): Promise<void> {
    if (actorRole === UserRole.SUPER_ADMIN) return;
    const branch = await this.prisma.businessBranch.findUnique({
      where: { id: branchId },
      include: {
        brand: true,
        managers: { where: { userId: actorId, isActive: true, deletedAt: null } },
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.brand.ownerId === actorId) return;
    if (branch.managers.length > 0) return;
    // Regional/zone managers may manage offers on branches in their territory.
    if (this.scope.isTerritoryRole(actorRole)) {
      await this.scope.assertBranchInScope(branchId, actorId, actorRole);
      return;
    }
    throw new ForbiddenException('Not allowed to manage offers on this branch');
  }

  /** Un-feature offers whose paid boost window has elapsed (manual features have no featuredUntil). */
  private async expireBoosts(): Promise<void> {
    await this.prisma.offer.updateMany({
      where: { isFeatured: true, featuredUntil: { not: null, lt: new Date() } },
      data: { isFeatured: false },
    });
  }

  private async uniqueSlug(branchId: string, title: string): Promise<string> {
    const base = slugify(title);
    for (let i = 0; i < 50; i++) {
      const candidate = uniqueSlugSuffix(base, i);
      const exists = await this.prisma.offer.findFirst({
        where: { branchId, slug: candidate },
      });
      if (!exists) return candidate;
    }
    return `${base}-${Date.now()}`;
  }
}
