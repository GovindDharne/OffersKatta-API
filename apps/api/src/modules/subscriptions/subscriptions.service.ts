import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingInterval,
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
  type Subscription,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Self-serve plans (Razorpay). ENTERPRISE is intentionally excluded — it has
// no list price and is provisioned by sales, see getPlans()/changePlan().
const PLAN_PRICING: Record<'FREE' | 'PREMIUM' | 'FEATURED', { monthly: number; yearly: number }> = {
  FREE: { monthly: 0, yearly: 0 },
  PREMIUM: { monthly: 999, yearly: 9990 },
  FEATURED: { monthly: 2999, yearly: 29990 },
};

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  getPlans() {
    const selfServe = Object.entries(PLAN_PRICING).map(([plan, prices]) => ({
      plan,
      monthly: prices.monthly,
      yearly: prices.yearly,
      currency: 'INR',
      contactSales: false,
    }));
    // Enterprise is a "talk to us" tier — no price, routed through the
    // Contact-Sales lead form rather than checkout.
    return [
      ...selfServe,
      {
        plan: SubscriptionPlan.ENTERPRISE,
        monthly: null,
        yearly: null,
        currency: 'INR',
        contactSales: true,
      },
    ];
  }

  async getForBrand(brandId: string, actorId: string, actorRole: UserRole): Promise<Subscription | null> {
    await this.assertBrandReadable(brandId, actorId, actorRole);
    return this.prisma.subscription.findUnique({ where: { brandId } });
  }

  async changePlan(
    brandId: string,
    plan: SubscriptionPlan,
    billingInterval: BillingInterval,
    actorId: string,
    actorRole: UserRole,
  ): Promise<{ subscription: Subscription; amount: number }> {
    await this.assertBrandOwner(brandId, actorId, actorRole);

    // Enterprise is contracted/offline-billed — never self-serve. Route the
    // seller to the Contact-Sales flow instead of taking a card.
    if (plan === SubscriptionPlan.ENTERPRISE) {
      throw new BadRequestException(
        'Enterprise plans are set up by our sales team. Use "Contact Sales" to start an enquiry.',
      );
    }
    const pricing = PLAN_PRICING[plan as 'FREE' | 'PREMIUM' | 'FEATURED'];
    const amount = billingInterval === BillingInterval.YEARLY ? pricing.yearly : pricing.monthly;

    // While a paid subscription is still running the plan is locked — no repeat
    // payments, and no mid-period switch (including a downgrade to FREE).
    const current = await this.prisma.subscription.findUnique({ where: { brandId } });
    if (
      current &&
      current.status === SubscriptionStatus.ACTIVE &&
      current.endDate &&
      current.endDate > new Date()
    ) {
      throw new BadRequestException(
        `An active ${current.plan} subscription is already running until ${current.endDate
          .toISOString()
          .slice(0, 10)}. You can change the plan after it expires.`,
      );
    }

    const subscription = await this.prisma.subscription.upsert({
      where: { brandId },
      create: {
        brandId,
        plan,
        billingInterval,
        amount,
        status: amount === 0 ? SubscriptionStatus.ACTIVE : SubscriptionStatus.TRIALING,
      },
      update: {
        plan,
        billingInterval,
        amount,
        // Paid plans stay TRIALING until the Razorpay payment is verified.
        status: amount === 0 ? SubscriptionStatus.ACTIVE : SubscriptionStatus.TRIALING,
      },
    });
    return { subscription, amount };
  }

  async cancel(brandId: string, actorId: string, actorRole: UserRole): Promise<Subscription> {
    await this.assertBrandOwner(brandId, actorId, actorRole);
    return this.prisma.subscription.update({
      where: { brandId },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
        autoRenew: false,
      },
    });
  }

  async markActivated(brandId: string, endDate: Date): Promise<Subscription> {
    return this.prisma.subscription.update({
      where: { brandId },
      data: { status: SubscriptionStatus.ACTIVE, endDate, startDate: new Date() },
    });
  }

  private async assertBrandReadable(brandId: string, actorId: string, actorRole: UserRole): Promise<void> {
    if (actorRole === UserRole.SUPER_ADMIN) return;
    const brand = await this.prisma.businessBrand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException('Brand not found');
    if (brand.ownerId === actorId) return;
    throw new ForbiddenException('Not the brand owner');
  }

  private async assertBrandOwner(brandId: string, actorId: string, actorRole: UserRole): Promise<void> {
    if (actorRole === UserRole.SUPER_ADMIN) return;
    const brand = await this.prisma.businessBrand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException('Brand not found');
    if (brand.ownerId !== actorId) throw new ForbiddenException('Not the brand owner');
  }
}
