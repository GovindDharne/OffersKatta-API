import { UserRole, type PrismaClient, type Role, type User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export async function seedAdmin(prisma: PrismaClient, roles: Role[]): Promise<User> {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@offerhub.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      fullName: 'Platform Admin',
      role: UserRole.SUPER_ADMIN,
      isVerified: true,
      isActive: true,
    },
    update: { passwordHash, role: UserRole.SUPER_ADMIN, isActive: true, isVerified: true },
  });

  const superAdminRole = roles.find((r) => r.slug === 'SUPER_ADMIN');
  if (superAdminRole) {
    const existing = await prisma.userRoleAssignment.findFirst({
      where: {
        userId: admin.id,
        roleId: superAdminRole.id,
        scopeType: 'GLOBAL',
        scopeId: null,
      },
    });
    if (!existing) {
      await prisma.userRoleAssignment.create({
        data: { userId: admin.id, roleId: superAdminRole.id, scopeType: 'GLOBAL' },
      });
    }
  }

  return admin;
}
