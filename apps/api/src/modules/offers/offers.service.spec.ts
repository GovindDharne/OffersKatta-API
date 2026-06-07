import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { OffersService } from './offers.service';
import { createPrismaMock, type PrismaMock } from '../../test/prisma-mock';

function makeService(prisma: PrismaMock): OffersService {
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
    del: jest.fn(),
    invalidatePrefix: jest.fn(),
  } as unknown as never;
  return new OffersService(prisma as never, cache);
}

describe('OffersService', () => {
  let prisma: PrismaMock;
  let service: OffersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = makeService(prisma);
  });

  describe('create', () => {
    it('allows the brand owner to create an offer', async () => {
      prisma.businessBranch.findUnique.mockResolvedValueOnce({
        id: 'branch-1',
        brand: { id: 'brand-1', ownerId: 'owner-1' },
        managers: [],
      });
      prisma.offer.findFirst.mockResolvedValueOnce(null);
      prisma.offer.create.mockResolvedValueOnce({
        id: 'offer-1', branchId: 'branch-1', title: 'Test', slug: 'test',
      });

      const out = await service.create('owner-1', UserRole.SELLER_OWNER, {
        branchId: 'branch-1',
        title: 'Test',
        offerType: 'PERCENTAGE',
        discountValue: 20,
        startsAt: '2026-01-01',
        expiresAt: '2026-02-01',
      } as never);

      expect(out.id).toBe('offer-1');
      expect(prisma.offer.create).toHaveBeenCalled();
    });

    it('rejects a non-owner non-manager seller', async () => {
      prisma.businessBranch.findUnique.mockResolvedValueOnce({
        id: 'branch-1',
        brand: { id: 'brand-1', ownerId: 'someone-else' },
        managers: [],
      });
      await expect(
        service.create('owner-1', UserRole.SELLER_OWNER, {
          branchId: 'branch-1', title: 'Test', offerType: 'PERCENTAGE',
          discountValue: 20, startsAt: '2026-01-01', expiresAt: '2026-02-01',
        } as never),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows a branch manager to create an offer for their branch', async () => {
      prisma.businessBranch.findUnique.mockResolvedValueOnce({
        id: 'branch-1',
        brand: { id: 'brand-1', ownerId: 'someone-else' },
        managers: [{ userId: 'manager-1' }],
      });
      prisma.offer.findFirst.mockResolvedValueOnce(null);
      prisma.offer.create.mockResolvedValueOnce({ id: 'offer-1' });

      await expect(
        service.create('manager-1', UserRole.BUSINESS_MANAGER, {
          branchId: 'branch-1', title: 'Mgr Test', offerType: 'FLAT',
          discountValue: 100, startsAt: '2026-01-01', expiresAt: '2026-02-01',
        } as never),
      ).resolves.toBeDefined();
    });

    it('lets super admin create on any branch', async () => {
      // assertBranchWritable should short-circuit before hitting the DB
      prisma.offer.findFirst.mockResolvedValueOnce(null);
      prisma.offer.create.mockResolvedValueOnce({ id: 'offer-1' });
      await expect(
        service.create('admin-1', UserRole.SUPER_ADMIN, {
          branchId: 'branch-1', title: 'X', offerType: 'FLAT',
          discountValue: 100, startsAt: '2026-01-01', expiresAt: '2026-02-01',
        } as never),
      ).resolves.toBeDefined();
      expect(prisma.businessBranch.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('throws NotFound for a missing or deleted offer', async () => {
      prisma.offer.findFirst.mockResolvedValueOnce(null);
      await expect(service.findById('ghost')).rejects.toThrow(NotFoundException);
    });

    it('returns an offer when present', async () => {
      prisma.offer.findFirst.mockResolvedValueOnce({ id: 'o1', title: 'A' });
      const o = await service.findById('o1');
      expect(o.id).toBe('o1');
    });
  });

  describe('nearby', () => {
    it('filters candidates by haversine distance', async () => {
      // Mumbai @ 19.0760, 72.8777
      // Branch in Mumbai → inside 10km
      // Branch in Pune  → ~120km away, outside 10km
      prisma.offer.findMany.mockResolvedValueOnce([
        {
          id: 'in', isFeatured: false,
          branch: { id: 'b1', name: 'Mumbai', city: 'Mumbai', latitude: 19.0760, longitude: 72.8777, brand: { id: 'br', name: 'Brand' } },
        },
        {
          id: 'out', isFeatured: false,
          branch: { id: 'b2', name: 'Pune', city: 'Pune', latitude: 18.5204, longitude: 73.8567, brand: { id: 'br', name: 'Brand' } },
        },
      ]);

      const page = await service.nearby({
        latitude: 19.0760, longitude: 72.8777, radiusKm: 10,
        page: 1, limit: 20, skip: 0, sortOrder: 'desc',
      } as never);

      expect(page.data.map((o) => (o as { id: string }).id)).toEqual(['in']);
    });
  });
});
