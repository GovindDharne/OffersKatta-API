import type { Permission, PrismaClient, Role } from '@prisma/client';

interface RoleDefinition {
  slug: string;
  name: string;
  description: string;
  permissions: (p: Permission) => boolean;
}

const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    slug: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: 'Platform-level administrator with full access',
    permissions: () => true,
  },
  {
    slug: 'SELLER_OWNER',
    name: 'Seller Owner',
    description: 'Business owner who manages brands, branches, billing, and staff',
    permissions: (p) =>
      ['brand', 'branch', 'manager', 'staff', 'offer', 'invitation', 'subscription',
       'payment', 'billing', 'analytics', 'settings', 'review'].includes(p.resource),
  },
  {
    slug: 'BUSINESS_MANAGER',
    name: 'Business Manager',
    description: 'Manages one or more assigned branches',
    permissions: (p) => {
      if (p.resource === 'branch' && ['read', 'update'].includes(p.action)) return true;
      if (p.resource === 'offer') return true;
      if (p.resource === 'staff' && ['read', 'update'].includes(p.action)) return true;
      if (p.resource === 'redemption') return true;
      if (p.resource === 'analytics' && p.action === 'read') return true;
      if (p.resource === 'review' && p.action === 'read') return true;
      return false;
    },
  },
  {
    slug: 'STAFF',
    name: 'Staff',
    description: 'Branch-level staff who can redeem offers and view limited analytics',
    permissions: (p) => {
      if (p.resource === 'offer' && p.action === 'read') return true;
      if (p.resource === 'redemption') return true;
      if (p.resource === 'analytics' && p.action === 'read') return true;
      return false;
    },
  },
  {
    slug: 'CUSTOMER',
    name: 'Customer',
    description: 'End-user who discovers and redeems offers',
    permissions: (p) => {
      if (p.resource === 'offer' && p.action === 'read') return true;
      if (p.resource === 'review' && ['create', 'update'].includes(p.action)) return true;
      if (p.resource === 'notification' && p.action === 'read') return true;
      return false;
    },
  },
];

export async function seedRoles(
  prisma: PrismaClient,
  permissions: Permission[],
): Promise<Role[]> {
  const created: Role[] = [];

  for (const def of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { slug: def.slug },
      create: {
        slug: def.slug,
        name: def.name,
        description: def.description,
        isSystem: true,
      },
      update: {
        name: def.name,
        description: def.description,
        isSystem: true,
      },
    });

    const matching = permissions.filter(def.permissions);
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (matching.length > 0) {
      await prisma.rolePermission.createMany({
        data: matching.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
    created.push(role);
  }

  return created;
}
