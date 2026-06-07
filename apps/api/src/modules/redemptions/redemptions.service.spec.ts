import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { RedemptionsService } from './redemptions.service';
import { createPrismaMock, type PrismaMock } from '../../test/prisma-mock';

describe('RedemptionsService', () => {
  let prisma: PrismaMock;
  let service: RedemptionsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new RedemptionsService(prisma as never);
  });

  describe('issue', () => {
    it('rejects an unknown offer', async () => {
      prisma.offer.findFirst.mockResolvedValueOnce(null);
      await expect(service.issue('cust-1', 'ghost-offer')).rejects.toThrow(NotFoundException);
    });

    it('rejects an unpublished offer', async () => {
      prisma.offer.findFirst.mockResolvedValueOnce({
        id: 'o1', status: 'DRAFT', branchId: 'b1', discountValue: 10,
        startsAt: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() + 1000),
        totalRedemptions: 0,
      });
      await expect(service.issue('cust-1', 'o1')).rejects.toThrow(BadRequestException);
    });

    it('rejects an expired offer', async () => {
      prisma.offer.findFirst.mockResolvedValueOnce({
        id: 'o1', status: 'PUBLISHED', branchId: 'b1', discountValue: 10,
        startsAt: new Date(Date.now() - 2 * 86400_000),
        expiresAt: new Date(Date.now() - 86400_000),
        totalRedemptions: 0,
      });
      await expect(service.issue('cust-1', 'o1')).rejects.toThrow(BadRequestException);
    });

    it('rejects when the per-user cap is hit', async () => {
      prisma.offer.findFirst.mockResolvedValueOnce({
        id: 'o1', status: 'PUBLISHED', branchId: 'b1', discountValue: 10,
        startsAt: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() + 86400_000),
        totalRedemptions: 0, maxRedemptions: null, redemptionPerUser: 1,
      });
      prisma.offerRedemption.count.mockResolvedValueOnce(1);
      await expect(service.issue('cust-1', 'o1')).rejects.toThrow(BadRequestException);
    });

    it('creates a redemption + qrDataUrl on the happy path', async () => {
      prisma.offer.findFirst.mockResolvedValueOnce({
        id: 'o1', status: 'PUBLISHED', branchId: 'b1', discountValue: 10,
        startsAt: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() + 86400_000),
        totalRedemptions: 0,
      });
      prisma.offerRedemption.create.mockResolvedValueOnce({
        id: 'r1', qrCode: 'ABCD1234EFGH5678', status: 'PENDING',
      });

      const out = await service.issue('cust-1', 'o1');
      expect(out.redemption.id).toBe('r1');
      expect(out.qrDataUrl.startsWith('data:image')).toBe(true);
    });
  });

  describe('cancel', () => {
    it('rejects cancellation by a non-owner customer', async () => {
      prisma.offerRedemption.findUnique.mockResolvedValueOnce({
        id: 'r1', customerId: 'cust-A', status: 'PENDING',
      });
      await expect(service.cancel('qr-1', 'cust-B')).rejects.toThrow(/Not your/);
    });

    it('rejects cancellation of a non-pending redemption', async () => {
      prisma.offerRedemption.findUnique.mockResolvedValueOnce({
        id: 'r1', customerId: 'cust-A', status: 'REDEEMED',
      });
      await expect(service.cancel('qr-1', 'cust-A')).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirm (staff-side)', () => {
    it('rejects an unknown qr code', async () => {
      prisma.offerRedemption.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.confirm('ghost-qr', 'staff-1', UserRole.STAFF),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
