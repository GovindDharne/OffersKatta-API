import { Injectable } from '@nestjs/common';
import type { ScopeType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

export interface ResolvedPermissions {
  role: UserRole;
  globalPermissions: Set<string>;
  brandPermissions: Map<string, Set<string>>;
  branchPermissions: Map<string, Set<string>>;
}

const cacheKey = (userId: string): string => `user:${userId}:permissions`;
const TTL = 5 * 60;

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async resolve(userId: string): Promise<ResolvedPermissions | null> {
    const cached = await this.cache.get<{
      role: UserRole;
      global: string[];
      brand: Record<string, string[]>;
      branch: Record<string, string[]>;
    }>(cacheKey(userId));

    if (cached) {
      return {
        role: cached.role,
        globalPermissions: new Set(cached.global),
        brandPermissions: new Map(Object.entries(cached.brand).map(([k, v]) => [k, new Set(v)])),
        branchPermissions: new Map(Object.entries(cached.branch).map(([k, v]) => [k, new Set(v)])),
      };
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, isActive: true },
      include: {
        userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
      },
    });
    if (!user) return null;

    const global = new Set<string>();
    const brand = new Map<string, Set<string>>();
    const branch = new Map<string, Set<string>>();

    for (const assignment of user.userRoles) {
      const perms = assignment.role.rolePermissions.map((rp) => rp.permission.slug);
      const target = this.pickBucket(assignment.scopeType, assignment.scopeId, global, brand, branch);
      perms.forEach((p) => target.add(p));
    }

    await this.cache.set(
      cacheKey(userId),
      {
        role: user.role,
        global: [...global],
        brand: Object.fromEntries([...brand.entries()].map(([k, v]) => [k, [...v]])),
        branch: Object.fromEntries([...branch.entries()].map(([k, v]) => [k, [...v]])),
      },
      TTL,
    );

    return { role: user.role, globalPermissions: global, brandPermissions: brand, branchPermissions: branch };
  }

  async hasPermission(
    userId: string,
    resource: string,
    action: string,
    scope?: { type: 'BRAND' | 'BRANCH'; id: string },
  ): Promise<boolean> {
    const resolved = await this.resolve(userId);
    if (!resolved) return false;
    if (resolved.role === 'SUPER_ADMIN') return true;

    const slug = `${resource}:${action}`;
    const manage = `${resource}:manage`;
    if (resolved.globalPermissions.has(slug) || resolved.globalPermissions.has(manage)) return true;

    if (scope) {
      const bucket =
        scope.type === 'BRAND' ? resolved.brandPermissions : resolved.branchPermissions;
      const scoped = bucket.get(scope.id);
      if (scoped && (scoped.has(slug) || scoped.has(manage))) return true;
    }
    return false;
  }

  async invalidate(userId: string): Promise<void> {
    await this.cache.del(cacheKey(userId));
  }

  private pickBucket(
    scopeType: ScopeType,
    scopeId: string | null,
    global: Set<string>,
    brand: Map<string, Set<string>>,
    branch: Map<string, Set<string>>,
  ): Set<string> {
    if (scopeType === 'GLOBAL' || !scopeId) return global;
    const bucket = scopeType === 'BRAND' ? brand : branch;
    let set = bucket.get(scopeId);
    if (!set) {
      set = new Set<string>();
      bucket.set(scopeId, set);
    }
    return set;
  }
}
