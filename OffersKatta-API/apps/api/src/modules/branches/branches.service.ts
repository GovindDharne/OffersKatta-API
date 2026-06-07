import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type BusinessBranch, type Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { paginate, type PaginatedResult } from '../../common/dto/pagination.dto';
import { slugify, uniqueSlugSuffix } from '../../common/utils/slug';
import { TerritoryScopeService } from '../territories/territory-scope.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type {
  CreateBranchDto,
  ListBranchesDto,
  UpdateBranchDto,
} from './dto/branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly scope: TerritoryScopeService,
  ) {}

  async create(actorId: string, actorRole: UserRole, dto: CreateBranchDto): Promise<BusinessBranch> {
    await this.assertBrandWritable(dto.brandId, actorId, actorRole);
    if (dto.zoneId) await this.assertZoneInBrand(dto.zoneId, dto.brandId);
    const slug = await this.uniqueSlug(dto.brandId, dto.name);
    const branch = await this.prisma.businessBranch.create({
      data: {
        brandId: dto.brandId,
        name: dto.name,
        slug,
        description: dto.description,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        country: dto.country,
        postalCode: dto.postalCode,
        latitude: dto.latitude,
        longitude: dto.longitude,
        phone: dto.phone,
        email: dto.email,
        workingHours: dto.workingHours as Prisma.InputJsonValue | undefined,
        images: dto.images ?? [],
        mallId: dto.mallId,
        shopNumber: dto.shopNumber,
        zoneId: dto.zoneId,
        createdById: actorId,
        updatedById: actorId,
      },
    });
    return branch;
  }

  async findById(id: string): Promise<BusinessBranch> {
    const cached = await this.cache.get<BusinessBranch>(`branch:${id}`);
    if (cached) return cached;
    const branch = await this.prisma.businessBranch.findFirst({
      where: { id, deletedAt: null },
      include: {
        brand: { select: { id: true, name: true, slug: true, businessType: true } },
        mall: { select: { id: true, name: true, slug: true, city: true, addressLine1: true } },
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    await this.cache.set(`branch:${id}`, branch, 60 * 60);
    return branch;
  }

  async list(query: ListBranchesDto, actor?: AuthUser): Promise<PaginatedResult<BusinessBranch>> {
    const where: Prisma.BusinessBranchWhereInput = { deletedAt: null };
    // Territory managers only see branches in their assigned region/zone.
    const scopeWhere = await this.scope.branchScopeWhere(actor?.id, actor?.role as UserRole | undefined);
    if (scopeWhere) where.AND = [scopeWhere];
    if (query.brandId) where.brandId = query.brandId;
    if (query.mallId) where.mallId = query.mallId;
    if (query.city) where.city = { equals: query.city, mode: 'insensitive' };
    if (query.status) where.status = query.status;
    // Territory filters — zoneId is direct, regionId joins through zone.
    if (query.zoneId) where.zoneId = query.zoneId;
    if (query.regionId) where.zone = { regionId: query.regionId, deletedAt: null };
    if (query.search) {
      // Multi-field contains — case insensitive. Used by the admin branch list
      // page so a brand with 600 stores stays usable: type "andheri" to narrow.
      const q = query.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { addressLine1: { contains: q, mode: 'insensitive' } },
        { addressLine2: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { state: { contains: q, mode: 'insensitive' } },
        { postalCode: { contains: q } },
        { shopNumber: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.businessBranch.count({ where }),
      this.prisma.businessBranch.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder },
        include: {
          brand: { select: { id: true, name: true, slug: true } },
          mall: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async update(
    id: string,
    dto: UpdateBranchDto,
    actorId: string,
    actorRole: UserRole,
  ): Promise<BusinessBranch> {
    await this.assertBranchWritable(id, actorId, actorRole);
    // Validate any zone change against the branch's actual brand — never trust
    // a brandId from the body for this check.
    if (dto.zoneId !== undefined && dto.zoneId !== null) {
      const current = await this.prisma.businessBranch.findUnique({
        where: { id }, select: { brandId: true },
      });
      if (current) await this.assertZoneInBrand(dto.zoneId, current.brandId);
    }
    const { brandId: _brandId, workingHours, ...rest } = dto;
    const branch = await this.prisma.businessBranch.update({
      where: { id },
      data: {
        ...rest,
        workingHours: workingHours as Prisma.InputJsonValue | undefined,
        updatedById: actorId,
      },
    });
    await this.cache.del(`branch:${id}`);
    return branch;
  }

  async remove(id: string, actorId: string, actorRole: UserRole): Promise<void> {
    await this.assertBranchWritable(id, actorId, actorRole);
    await this.prisma.businessBranch.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    await this.cache.del(`branch:${id}`);
  }

  async assertBranchWritable(branchId: string, actorId: string, actorRole: UserRole): Promise<void> {
    if (actorRole === UserRole.SUPER_ADMIN) return;
    const branch = await this.prisma.businessBranch.findUnique({
      where: { id: branchId },
      include: { brand: true, managers: { where: { userId: actorId, isActive: true } } },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.brand.ownerId === actorId) return;
    if (branch.managers.length > 0) return;
    // Regional/zone managers may edit branches inside their territory.
    if (this.scope.isTerritoryRole(actorRole)) {
      await this.scope.assertBranchInScope(branchId, actorId, actorRole);
      return;
    }
    throw new ForbiddenException('Not allowed to write this branch');
  }

  private async assertBrandWritable(brandId: string, actorId: string, actorRole: UserRole): Promise<void> {
    if (actorRole === UserRole.SUPER_ADMIN) return;
    const brand = await this.prisma.businessBrand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException('Brand not found');
    if (brand.ownerId !== actorId) throw new ForbiddenException('Not the brand owner');
  }

  /// Throws unless `zoneId` exists, isn't soft-deleted, and belongs to `brandId`.
  /// Prevents cross-brand zone assignment through a hand-rolled API payload.
  private async assertZoneInBrand(zoneId: string, brandId: string): Promise<void> {
    const zone = await this.prisma.businessZone.findFirst({
      where: { id: zoneId, brandId, deletedAt: null },
      select: { id: true },
    });
    if (!zone) throw new NotFoundException('Zone not found for this brand');
  }

  /// Bulk-import branches from a CSV buffer for a single brand. Built for
  /// chain sellers (Peter England etc.) that need to onboard 500+ branches
  /// without using the New Branch form 500 times.
  ///
  /// Expected CSV header (case-insensitive, order flexible):
  ///   name, addressLine1, addressLine2?, city, state, country, postalCode,
  ///   latitude, longitude, phone?, email?, shopNumber?
  ///
  /// De-duplication: if a branch with the same (brandId, lowercased name, city)
  /// already exists it is treated as an UPDATE — the row patches address/coords
  /// instead of inserting a duplicate. Set `mode: 'create'` to skip existing.
  async bulkImport(
    brandId: string,
    csvBuffer: Buffer,
    opts: { actorId: string; actorRole: UserRole; mode?: 'upsert' | 'create' },
  ): Promise<{
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; message: string }>;
  }> {
    await this.assertBrandWritable(brandId, opts.actorId, opts.actorRole);
    const mode = opts.mode ?? 'upsert';

    const rows = parseCsv(csvBuffer.toString('utf8'));
    if (rows.length === 0) {
      return { created: 0, updated: 0, skipped: 0, errors: [{ row: 0, message: 'CSV is empty' }] };
    }
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const idx = (key: string): number => header.indexOf(key.toLowerCase());

    const required = ['name', 'addressline1', 'city', 'state', 'country', 'postalcode', 'latitude', 'longitude'];
    const missing = required.filter((k) => idx(k) < 0);
    if (missing.length) {
      return {
        created: 0, updated: 0, skipped: 0,
        errors: [{ row: 0, message: `Missing required columns: ${missing.join(', ')}` }],
      };
    }

    // Preload existing branches once so we don't N+1.
    const existing = await this.prisma.businessBranch.findMany({
      where: { brandId, deletedAt: null },
      select: { id: true, name: true, city: true },
    });
    const existingByKey = new Map(
      existing.map((b) => [`${b.name.toLowerCase()}|${b.city.toLowerCase()}`, b.id]),
    );

    let created = 0, updated = 0, skipped = 0;
    const errors: Array<{ row: number; message: string }> = [];

    // i=1 — first row is the header.
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (r.length === 1 && r[0].trim() === '') continue; // blank line
      try {
        const get = (k: string): string => (r[idx(k)] ?? '').trim();
        const name = get('name');
        const city = get('city');
        if (!name || !city) throw new Error('name and city are required');
        const lat = Number(get('latitude'));
        const lng = Number(get('longitude'));
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error('latitude out of range');
        if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error('longitude out of range');

        const data = {
          brandId,
          name,
          addressLine1: get('addressline1') || '—',
          addressLine2: get('addressline2') || null,
          city,
          state: get('state') || '—',
          country: get('country') || 'India',
          postalCode: get('postalcode') || '000000',
          latitude: lat,
          longitude: lng,
          phone: get('phone') || null,
          email: get('email') || null,
          shopNumber: get('shopnumber') || null,
          createdById: opts.actorId,
          updatedById: opts.actorId,
        };

        const key = `${name.toLowerCase()}|${city.toLowerCase()}`;
        const existingId = existingByKey.get(key);
        if (existingId) {
          if (mode === 'create') { skipped++; continue; }
          await this.prisma.businessBranch.update({
            where: { id: existingId },
            data: {
              addressLine1: data.addressLine1,
              addressLine2: data.addressLine2,
              state: data.state,
              country: data.country,
              postalCode: data.postalCode,
              latitude: data.latitude,
              longitude: data.longitude,
              phone: data.phone,
              email: data.email,
              shopNumber: data.shopNumber,
              updatedById: opts.actorId,
            },
          });
          updated++;
        } else {
          const slug = await this.uniqueSlug(brandId, name);
          await this.prisma.businessBranch.create({ data: { ...data, slug } });
          created++;
        }
      } catch (e) {
        errors.push({ row: i + 1, message: (e as Error).message });
      }
    }

    return { created, updated, skipped, errors };
  }

  private async uniqueSlug(brandId: string, name: string): Promise<string> {
    const base = slugify(name);
    for (let i = 0; i < 50; i++) {
      const candidate = uniqueSlugSuffix(base, i);
      const exists = await this.prisma.businessBranch.findFirst({
        where: { brandId, slug: candidate },
      });
      if (!exists) return candidate;
    }
    return `${base}-${Date.now()}`;
  }
}

/// Tiny correct-enough CSV parser. Handles double-quoted fields (incl. quotes
/// inside quotes via "" escaping) and CRLF line endings. We avoid adding a
/// dependency for this — the format is well-defined and the input is small.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  // Normalise line endings.
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; }  // escaped quote
        else { inQuotes = false; }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else { cell += ch; }
    }
  }
  // flush trailing cell/row (file may not end with \n)
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}
