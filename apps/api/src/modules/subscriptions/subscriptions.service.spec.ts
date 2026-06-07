import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BillingInterval, SubscriptionPlan, UserRole } from '@prisma/client';

import { SubscriptionsService } from './subscriptions.service';
import { createPrismaMock, type PrismaMock } from '../../test/prisma-mock';

describe('SubscriptionsService', () => {
  let prisma: PrismaMock;
  let service: SubscriptionsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new SubscriptionsService(prisma as never);
  });

  describe('getPlans', () => {
    it('returns all three plans with monthly + yearly pricing', () => {
      const plans = service.getPlans();
      expect(plans.map((p) => p.plan).sort()).toEqual(['FEATURED', 'FREE', 'PREMIUM']);
      const premium = plans.find((p) => p.plan === 'PREMIUM')!;
      expect(premium.monthly).toBe(999);
      expect(premium.yearly).toBe(9990);
      expect(premium.currency).toBe('INR');
    });
  });

  describe('changePlan', () => {
    it('rejects a non-owner', async () => {
      prisma.businessBrand.findUnique.mockResolvedValueOnce({ id: 'b1', ownerId: 'other' });
      await expect(
        service.changePlan('b1', SubscriptionPlan.PREMIUM, BillingInterval.MONTHLY, 'me', UserRole.SELLER_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects for an unknown brand', async () => {
      prisma.businessBrand.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.changePlan('ghost', SubscriptionPlan.PREMIUM, BillingInterval.MONTHLY, 'me', UserRole.SELLER_OWNER),
      ).rejects.toThrow(NotFoundException);
    });

    it('upserts at the right monthly price', async () => {
      prisma.businessBrand.findUnique.mockResolvedValueOnce({ id: 'b1', ownerId: 'me' });
      prisma.subscription.upsert.mockResolvedValueOnce({ id: 's1', plan: 'PREMIUM' });

      const out = await service.changePlan(
        'b1', SubscriptionPlan.PREMIUM, BillingInterval.MONTHLY, 'me', UserRole.SELLER_OWNER,
      );
      expect(out.amount).toBe(999);
      expect(prisma.subscription.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { brandId: 'b1' },
      }));
    });

    it('admin can change any brand without ownership check', async () => {
      prisma.subscription.upsert.mockResolvedValueOnce({ id: 's1' });
      await expect(
        service.changePlan('b1', SubscriptionPlan.FREE, BillingInterval.YEARLY, 'admin', UserRole.SUPER_ADMIN),
      ).resolves.toBeDefined();
      expect(prisma.businessBrand.findUnique).not.toHaveBeenCalled();
    });
  });
});
