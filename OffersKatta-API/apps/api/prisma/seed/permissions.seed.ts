import type { Permission, PrismaClient } from '@prisma/client';

const PERMISSION_MATRIX: ReadonlyArray<{
  resource: string;
  actions: string[];
  description?: string;
}> = [
  { resource: 'user', actions: ['create', 'read', 'update', 'delete'] },
  { resource: 'brand', actions: ['create', 'read', 'update', 'delete', 'approve'] },
  { resource: 'branch', actions: ['create', 'read', 'update', 'delete'] },
  { resource: 'manager', actions: ['create', 'read', 'update', 'delete'] },
  { resource: 'staff', actions: ['create', 'read', 'update', 'delete'] },
  { resource: 'offer', actions: ['create', 'read', 'update', 'delete'] },
  { resource: 'category', actions: ['create', 'read', 'update', 'delete'] },
  { resource: 'redemption', actions: ['read', 'redeem'] },
  { resource: 'review', actions: ['create', 'read', 'update', 'delete', 'approve'] },
  { resource: 'payment', actions: ['read', 'update'] },
  { resource: 'subscription', actions: ['create', 'read', 'update', 'delete'] },
  { resource: 'analytics', actions: ['read'] },
  { resource: 'billing', actions: ['create', 'read', 'update', 'delete'] },
  { resource: 'settings', actions: ['read', 'update'] },
  { resource: 'invitation', actions: ['create', 'read', 'delete'] },
  { resource: 'notification', actions: ['create', 'read', 'delete'] },
];

export async function seedPermissions(prisma: PrismaClient): Promise<Permission[]> {
  const created: Permission[] = [];

  for (const { resource, actions } of PERMISSION_MATRIX) {
    for (const action of actions) {
      const slug = `${resource}:${action}`;
      const name = `${capitalize(action)} ${capitalize(resource)}`;

      const permission = await prisma.permission.upsert({
        where: { slug },
        create: { slug, name, resource, action },
        update: { name, resource, action },
      });
      created.push(permission);
    }
  }

  return created;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
