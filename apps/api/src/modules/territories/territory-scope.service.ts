import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/// Resolves and enforces what a REGIONAL_MANAGER / ZONE_MANAGER is allowed to
/// see and write, based on their TerritoryManager assignments.
///
///   REGIONAL_MANAGER → every branch whose zone belongs to an assigned region
///   ZONE_MANAGER     → every branch in an assigned zone
///
/// Non-territory roles (SUPER_ADMIN, SELLER_OWNER, customers, anonymous) are
/// "unrestricted" here — their access is governed by the existing owner/admin
/// checks, not by territory.
@Injectable()
export class TerritoryScopeService {
  constructor(private readonly prisma: PrismaService) {}

  isTerritoryRole(role?: UserRole): boolean {
    return role === UserRole.REGIONAL_MANAGER || role === UserRole.ZONE_MANAGER;
  }

  /// The user's active region/zone assignments.
  async assignmentsFor(userId: string): Promise<{ regionIds: string[]; zoneIds: string[] }> {
    const rows = await this.prisma.territoryManager.findMany({
      where: { userId, isActive: true },
      select: { regionId: true, zoneId: true },
    });
    return {
      regionIds: rows.map((r) => r.regionId).filter((x): x is string => Boolean(x)),
      zoneIds: rows.map((r) => r.zoneId).filter((x): x is string => Boolean(x)),
    };
  }

  /// A BusinessBranch where-fragment limiting to the actor's territory.
  ///   undefined → no restriction (non-territory role)
  ///   { id: { in: [] } } → territory role with zero assignments → sees nothing
  async branchScopeWhere(
    actorId: string | undefined,
    actorRole: UserRole | undefined,
  ): Promise<Prisma.BusinessBranchWhereInput | undefined> {
    if (!actorId || !this.isTerritoryRole(actorRole)) return undefined;
    const { regionIds, zoneIds } = await this.assignmentsFor(actorId);
    const or: Prisma.BusinessBranchWhereInput[] = [];
    if (zoneIds.length) or.push({ zoneId: { in: zoneIds } });
    if (regionIds.length) or.push({ zone: { is: { regionId: { in: regionIds } } } });
    if (or.length === 0) return { id: { in: [] } };
    return { OR: or };
  }

  /// Throws ForbiddenException if the actor is a territory manager and the
  /// branch falls outside their territory. No-op for non-territory roles
  /// (their access is decided by the caller's owner/admin checks).
  async assertBranchInScope(
    branchId: string,
    actorId: string,
    actorRole: UserRole,
  ): Promise<void> {
    if (!this.isTerritoryRole(actorRole)) return;
    const { regionIds, zoneIds } = await this.assignmentsFor(actorId);
    if (regionIds.length === 0 && zoneIds.length === 0) {
      throw new ForbiddenException('You have no territory assigned');
    }
    const match = await this.prisma.businessBranch.findFirst({
      where: {
        id: branchId,
        OR: [
          ...(zoneIds.length ? [{ zoneId: { in: zoneIds } }] : []),
          ...(regionIds.length ? [{ zone: { is: { regionId: { in: regionIds } } } }] : []),
        ],
      },
      select: { id: true },
    });
    if (!match) {
      throw new ForbiddenException('This branch is outside your assigned territory');
    }
  }
}
