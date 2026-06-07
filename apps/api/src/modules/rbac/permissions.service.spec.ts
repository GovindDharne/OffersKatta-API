import { PermissionsService } from './permissions.service';
import { createPrismaMock, type PrismaMock } from '../../test/prisma-mock';

describe('PermissionsService', () => {
  let prisma: PrismaMock;
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let service: PermissionsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
    service = new PermissionsService(prisma as never, cache as never);
  });

  function userWithAssignments(role: string, assignments: Array<{ scopeType: string; scopeId: string | null; permissions: string[] }>) {
    return {
      id: 'u1',
      role,
      isActive: true,
      deletedAt: null,
      userRoles: assignments.map((a) => ({
        scopeType: a.scopeType,
        scopeId: a.scopeId,
        role: {
          rolePermissions: a.permissions.map((slug) => ({ permission: { slug } })),
        },
      })),
    };
  }

  it('super admin bypasses every check', async () => {
    prisma.user.findFirst.mockResolvedValue(userWithAssignments('SUPER_ADMIN', [
      { scopeType: 'GLOBAL', scopeId: null, permissions: [] },
    ]));

    expect(await service.hasPermission('u1', 'offer', 'delete')).toBe(true);
    expect(await service.hasPermission('u1', 'billing', 'manage')).toBe(true);
  });

  it('global permission grants access without a scope', async () => {
    prisma.user.findFirst.mockResolvedValueOnce(userWithAssignments('SELLER_OWNER', [
      { scopeType: 'GLOBAL', scopeId: null, permissions: ['offer:read'] },
    ]));
    expect(await service.hasPermission('u1', 'offer', 'read')).toBe(true);
    expect(await service.hasPermission('u1', 'offer', 'delete')).toBe(false);
  });

  it('branch-scoped permission only matches the right branch', async () => {
    prisma.user.findFirst.mockResolvedValueOnce(userWithAssignments('BUSINESS_MANAGER', [
      { scopeType: 'BRANCH', scopeId: 'branch-A', permissions: ['offer:update'] },
    ]));
    expect(
      await service.hasPermission('u1', 'offer', 'update', { type: 'BRANCH', id: 'branch-A' }),
    ).toBe(true);
    expect(
      await service.hasPermission('u1', 'offer', 'update', { type: 'BRANCH', id: 'branch-B' }),
    ).toBe(false);
  });

  it('manage shorthand satisfies any action', async () => {
    prisma.user.findFirst.mockResolvedValue(userWithAssignments('SELLER_OWNER', [
      { scopeType: 'GLOBAL', scopeId: null, permissions: ['offer:manage'] },
    ]));
    expect(await service.hasPermission('u1', 'offer', 'delete')).toBe(true);
    expect(await service.hasPermission('u1', 'offer', 'create')).toBe(true);
  });

  it('returns false for an unknown user', async () => {
    prisma.user.findFirst.mockResolvedValueOnce(null);
    expect(await service.hasPermission('ghost', 'offer', 'read')).toBe(false);
  });
});
