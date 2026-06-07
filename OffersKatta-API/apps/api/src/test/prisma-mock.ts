/**
 * Returns a deeply-mocked PrismaService-like object whose every model method
 * is a jest.fn(). Use jest.mocked() on the methods you need to script per test.
 *
 *   const prisma = createPrismaMock();
 *   prisma.user.findFirst.mockResolvedValueOnce({ id: '1', ... } as any);
 */
type Fn = jest.Mock;

interface MockedModel {
  findFirst: Fn;
  findUnique: Fn;
  findMany: Fn;
  count: Fn;
  create: Fn;
  update: Fn;
  upsert: Fn;
  delete: Fn;
  deleteMany: Fn;
  updateMany: Fn;
  createMany: Fn;
  aggregate: Fn;
  groupBy: Fn;
}

const MODELS = [
  'user',
  'refreshToken',
  'role',
  'permission',
  'rolePermission',
  'userRoleAssignment',
  'businessBrand',
  'businessBranch',
  'businessManager',
  'staffAssignment',
  'invitation',
  'category',
  'brandCategory',
  'offer',
  'offerCategory',
  'favorite',
  'review',
  'offerRedemption',
  'subscription',
  'payment',
  'notification',
  'auditLog',
] as const;

function mockedModel(): MockedModel {
  return {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    updateMany: jest.fn(),
    createMany: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  };
}

export type PrismaMock = Record<(typeof MODELS)[number], MockedModel> & {
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
  $executeRawUnsafe: jest.Mock;
};

export function createPrismaMock(): PrismaMock {
  const out = {} as PrismaMock;
  for (const m of MODELS) (out as Record<string, unknown>)[m] = mockedModel();
  out.$transaction = jest.fn((ops: unknown) =>
    Array.isArray(ops) ? Promise.all(ops as Promise<unknown>[]) : Promise.resolve(ops),
  );
  out.$queryRaw = jest.fn();
  out.$executeRawUnsafe = jest.fn();
  return out;
}
