import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, type BusinessRegion, type BusinessZone } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { slugify, uniqueSlugSuffix } from '../../common/utils/slug';
import type {
  AssignManagerDto,
  CreateRegionDto,
  CreateZoneDto,
  UpdateRegionDto,
  UpdateZoneDto,
} from './dto/territory.dto';

/// CRUD for the Region/Zone hierarchy under a brand.
/// Auth: brand owner or SUPER_ADMIN can write. Reads are public-ish (used by
/// the branch edit form so any seller-side user can list).
@Injectable()
export class TerritoriesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Regions ──────────────────────────────────────────────

  async listRegions(brandId: string): Promise<BusinessRegion[]> {
    return this.prisma.businessRegion.findMany({
      where: { brandId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async createRegion(brandId: string, dto: CreateRegionDto, actorId: string, actorRole: UserRole) {
    await this.assertWritable(brandId, actorId, actorRole);
    const slug = await this.uniqueRegionSlug(brandId, dto.name);
    return this.prisma.businessRegion.create({
      data: { brandId, name: dto.name, slug },
    });
  }

  async updateRegion(id: string, dto: UpdateRegionDto, actorId: string, actorRole: UserRole) {
    const region = await this.prisma.businessRegion.findFirst({ where: { id, deletedAt: null } });
    if (!region) throw new NotFoundException('Region not found');
    await this.assertWritable(region.brandId, actorId, actorRole);
    return this.prisma.businessRegion.update({ where: { id }, data: { name: dto.name } });
  }

  async deleteRegion(id: string, actorId: string, actorRole: UserRole) {
    const region = await this.prisma.businessRegion.findFirst({ where: { id, deletedAt: null } });
    if (!region) throw new NotFoundException('Region not found');
    await this.assertWritable(region.brandId, actorId, actorRole);
    // Soft-delete; cascading the contained zones too so they don't dangle.
    await this.prisma.$transaction([
      this.prisma.businessRegion.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      this.prisma.businessZone.updateMany({
        where: { regionId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
    ]);
  }

  // ─── Zones ────────────────────────────────────────────────

  async listZones(brandId: string, regionId?: string): Promise<BusinessZone[]> {
    return this.prisma.businessZone.findMany({
      where: { brandId, deletedAt: null, ...(regionId ? { regionId } : {}) },
      include: { region: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createZone(brandId: string, dto: CreateZoneDto, actorId: string, actorRole: UserRole) {
    await this.assertWritable(brandId, actorId, actorRole);
    const region = await this.prisma.businessRegion.findFirst({
      where: { id: dto.regionId, brandId, deletedAt: null },
    });
    if (!region) throw new NotFoundException('Region not found for this brand');
    const slug = await this.uniqueZoneSlug(brandId, dto.name);
    return this.prisma.businessZone.create({
      data: { brandId, regionId: dto.regionId, name: dto.name, slug },
    });
  }

  async updateZone(id: string, dto: UpdateZoneDto, actorId: string, actorRole: UserRole) {
    const zone = await this.prisma.businessZone.findFirst({ where: { id, deletedAt: null } });
    if (!zone) throw new NotFoundException('Zone not found');
    await this.assertWritable(zone.brandId, actorId, actorRole);
    // If moving to a different region, validate it's the same brand.
    if (dto.regionId && dto.regionId !== zone.regionId) {
      const region = await this.prisma.businessRegion.findFirst({
        where: { id: dto.regionId, brandId: zone.brandId, deletedAt: null },
      });
      if (!region) throw new NotFoundException('Target region not in this brand');
    }
    return this.prisma.businessZone.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.regionId ? { regionId: dto.regionId } : {}),
      },
    });
  }

  async deleteZone(id: string, actorId: string, actorRole: UserRole) {
    const zone = await this.prisma.businessZone.findFirst({ where: { id, deletedAt: null } });
    if (!zone) throw new NotFoundException('Zone not found');
    await this.assertWritable(zone.brandId, actorId, actorRole);
    // Soft-delete the zone + un-pin any branches living in it.
    await this.prisma.$transaction([
      this.prisma.businessZone.update({ where: { id }, data: { deletedAt: new Date() } }),
      this.prisma.businessBranch.updateMany({ where: { zoneId: id }, data: { zoneId: null } }),
    ]);
  }

  // ─── Territory managers ───────────────────────────────────

  async listManagers(brandId: string, actorId: string, actorRole: UserRole) {
    await this.assertWritable(brandId, actorId, actorRole);
    return this.prisma.territoryManager.findMany({
      where: { brandId, isActive: true },
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
        region: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true, region: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /// Assign a user as a regional or zone manager. Exactly one of regionId /
  /// zoneId must be set, and it must belong to this brand. Also promotes the
  /// user's global role so their JWT carries REGIONAL_MANAGER / ZONE_MANAGER
  /// (they must re-login for the new role to take effect in their token).
  async assignManager(brandId: string, dto: AssignManagerDto, actorId: string, actorRole: UserRole) {
    await this.assertWritable(brandId, actorId, actorRole);

    const hasRegion = Boolean(dto.regionId);
    const hasZone = Boolean(dto.zoneId);
    if (hasRegion === hasZone) {
      throw new BadRequestException('Provide exactly one of regionId or zoneId');
    }

    // Resolve the target user by id or email.
    const user = dto.userId
      ? await this.prisma.user.findUnique({ where: { id: dto.userId } })
      : dto.email
        ? await this.prisma.user.findFirst({ where: { email: dto.email } })
        : null;
    if (!user) {
      throw new NotFoundException(
        dto.email ? `No user found with email ${dto.email}` : 'User not found',
      );
    }
    const userId = user.id;

    if (hasRegion) {
      const region = await this.prisma.businessRegion.findFirst({
        where: { id: dto.regionId, brandId, deletedAt: null },
      });
      if (!region) throw new NotFoundException('Region not found for this brand');
    } else {
      const zone = await this.prisma.businessZone.findFirst({
        where: { id: dto.zoneId, brandId, deletedAt: null },
      });
      if (!zone) throw new NotFoundException('Zone not found for this brand');
    }

    // Prisma's compound-unique input type can't express nullable members, so
    // we find-or-create manually instead of upsert().
    const existing = await this.prisma.territoryManager.findFirst({
      where: { userId, regionId: dto.regionId ?? null, zoneId: dto.zoneId ?? null },
    });
    const created = existing
      ? await this.prisma.territoryManager.update({
          where: { id: existing.id },
          data: { isActive: true, brandId },
        })
      : await this.prisma.territoryManager.create({
          data: {
            userId,
            brandId,
            regionId: dto.regionId,
            zoneId: dto.zoneId,
            createdById: actorId,
          },
        });

    // Promote the user's role unless they already hold a higher one.
    const targetRole = hasRegion ? UserRole.REGIONAL_MANAGER : UserRole.ZONE_MANAGER;
    const promotable: UserRole[] = [UserRole.CUSTOMER, UserRole.STAFF, UserRole.BUSINESS_MANAGER];
    if (promotable.includes(user.role)) {
      await this.prisma.user.update({ where: { id: userId }, data: { role: targetRole } });
    }
    return created;
  }

  async removeManager(brandId: string, managerId: string, actorId: string, actorRole: UserRole) {
    const row = await this.prisma.territoryManager.findUnique({ where: { id: managerId } });
    if (!row || row.brandId !== brandId) throw new NotFoundException('Assignment not found');
    await this.assertWritable(brandId, actorId, actorRole);
    await this.prisma.territoryManager.delete({ where: { id: managerId } });

    // If the user no longer manages any territory, drop them back to CUSTOMER
    // (only when they currently hold a territory role — never touch owners/admins).
    const remaining = await this.prisma.territoryManager.count({
      where: { userId: row.userId, isActive: true },
    });
    if (remaining === 0) {
      const user = await this.prisma.user.findUnique({ where: { id: row.userId } });
      if (user && (user.role === UserRole.REGIONAL_MANAGER || user.role === UserRole.ZONE_MANAGER)) {
        await this.prisma.user.update({ where: { id: row.userId }, data: { role: UserRole.CUSTOMER } });
      }
    }
    return { ok: true };
  }

  // ─── Internal helpers ─────────────────────────────────────

  private async assertWritable(brandId: string, actorId: string, actorRole: UserRole): Promise<void> {
    if (actorRole === UserRole.SUPER_ADMIN) return;
    const brand = await this.prisma.businessBrand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException('Brand not found');
    if (brand.ownerId !== actorId) throw new ForbiddenException('Not the brand owner');
  }

  private async uniqueRegionSlug(brandId: string, name: string): Promise<string> {
    const base = slugify(name);
    for (let i = 0; i < 50; i++) {
      const candidate = uniqueSlugSuffix(base, i);
      const exists = await this.prisma.businessRegion.findFirst({
        where: { brandId, slug: candidate },
      });
      if (!exists) return candidate;
    }
    return `${base}-${Date.now()}`;
  }

  private async uniqueZoneSlug(brandId: string, name: string): Promise<string> {
    const base = slugify(name);
    for (let i = 0; i < 50; i++) {
      const candidate = uniqueSlugSuffix(base, i);
      const exists = await this.prisma.businessZone.findFirst({
        where: { brandId, slug: candidate },
      });
      if (!exists) return candidate;
    }
    return `${base}-${Date.now()}`;
  }
}
