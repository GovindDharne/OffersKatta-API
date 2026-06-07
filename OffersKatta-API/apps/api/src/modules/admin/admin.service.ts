import { Injectable } from '@nestjs/common';
import {
  BrandStatus,
  OfferStatus,
  RedemptionStatus,
  SubscriptionPlan,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
      totalUsers,
      totalSellers,
      totalCustomers,
      totalBrands,
      pendingBrands,
      totalBranches,
      totalOffers,
      publishedOffers,
      redemptionsLast30,
      revenueLast30,
      planCounts,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, role: 'SELLER_OWNER' } }),
      this.prisma.user.count({ where: { deletedAt: null, role: 'CUSTOMER' } }),
      this.prisma.businessBrand.count({ where: { deletedAt: null } }),
      this.prisma.businessBrand.count({
        where: { deletedAt: null, status: BrandStatus.PENDING_VERIFICATION },
      }),
      this.prisma.businessBranch.count({ where: { deletedAt: null } }),
      this.prisma.offer.count({ where: { deletedAt: null } }),
      this.prisma.offer.count({ where: { deletedAt: null, status: OfferStatus.PUBLISHED } }),
      this.prisma.offerRedemption.count({
        where: { status: RedemptionStatus.REDEEMED, redeemedAt: { gte: since30 } },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'SUCCESS', paidAt: { gte: since30 } },
        _sum: { amount: true },
      }),
      this.prisma.subscription.groupBy({
        by: ['plan'],
        _count: { plan: true },
      }),
    ]);

    return {
      users: { total: totalUsers, sellers: totalSellers, customers: totalCustomers },
      brands: { total: totalBrands, pendingVerification: pendingBrands },
      branches: totalBranches,
      offers: { total: totalOffers, published: publishedOffers },
      redemptionsLast30Days: redemptionsLast30,
      revenueLast30Days: revenueLast30._sum.amount ?? 0,
      subscriptions: Object.fromEntries(
        Object.values(SubscriptionPlan).map((plan) => [
          plan,
          planCounts.find((c) => c.plan === plan)?._count.plan ?? 0,
        ]),
      ),
    };
  }

  async pendingBrands() {
    return this.prisma.businessBrand.findMany({
      where: { deletedAt: null, status: BrandStatus.PENDING_VERIFICATION },
      include: { owner: { select: { id: true, email: true, fullName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async pendingReviews() {
    return this.prisma.review.findMany({
      where: { deletedAt: null, isApproved: false },
      include: { user: { select: { id: true, email: true, fullName: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }
}
