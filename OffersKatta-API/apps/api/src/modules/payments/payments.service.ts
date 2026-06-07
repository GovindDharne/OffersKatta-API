import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PaymentStatus, SubscriptionStatus, type Payment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RazorpayService } from '../razorpay/razorpay.service';

// Paid "boost" tiers — duration (days) → price (INR). Priced server-side so
// the client can never dictate the amount.
const BOOST_TIERS: Record<number, number> = { 7: 199, 15: 349, 30: 599 };

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
  ) {}

  getConfig(): { enabled: boolean; keyId: string | null } {
    const enabled = this.razorpay.isEnabled();
    return { enabled, keyId: enabled ? this.razorpay.getKeyId() : null };
  }

  getBoostOptions(): Array<{ days: number; price: number; currency: string }> {
    return Object.entries(BOOST_TIERS).map(([days, price]) => ({
      days: Number(days),
      price,
      currency: 'INR',
    }));
  }

  async createBoostOrder(
    offerId: string,
    days: number,
    userId: string,
  ): Promise<{ payment: Payment; order: { id: string; amount: number; currency: string } }> {
    if (!this.razorpay.isEnabled()) {
      throw new BadRequestException('Payments are not configured on this server');
    }
    const price = BOOST_TIERS[days];
    if (!price) throw new BadRequestException('Invalid boost duration');

    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, deletedAt: null },
      include: { branch: { include: { brand: true } } },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    const brand = offer.branch.brand;
    if (brand.ownerId !== userId) throw new ForbiddenException('Not the offer owner');

    // One boost at a time — block paying again while a boost is still running.
    if (offer.featuredUntil && offer.featuredUntil > new Date()) {
      throw new BadRequestException(
        `This offer is already boosted until ${offer.featuredUntil
          .toISOString()
          .slice(0, 10)}. You can boost it again after that.`,
      );
    }

    const order = await this.razorpay.createOrder({
      amount: price,
      receipt: `boost_${offerId.slice(0, 8)}_${Date.now()}`,
      notes: { offerId, userId, boostDays: String(days) },
    });
    const payment = await this.prisma.payment.create({
      data: {
        brandId: brand.id,
        userId,
        offerId,
        boostDays: days,
        razorpayOrderId: order.id,
        amount: price,
        currency: order.currency,
        status: PaymentStatus.PENDING,
        description: `Boost: ${offer.title} (${days} days)`,
      },
    });
    return { payment, order: { id: order.id, amount: order.amount, currency: order.currency } };
  }

  async createOrder(
    brandId: string,
    userId: string,
    amount: number,
    description?: string,
  ): Promise<{ payment: Payment; order: { id: string; amount: number; currency: string } }> {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');
    if (!this.razorpay.isEnabled()) {
      throw new BadRequestException('Payments are not configured on this server');
    }
    const brand = await this.prisma.businessBrand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException('Brand not found');
    if (brand.ownerId !== userId) throw new ForbiddenException('Not the brand owner');
    const subscription = await this.prisma.subscription.findUnique({ where: { brandId } });

    const order = await this.razorpay.createOrder({
      amount,
      receipt: `brand_${brandId.slice(0, 8)}_${Date.now()}`,
      notes: { brandId, userId },
    });

    const payment = await this.prisma.payment.create({
      data: {
        brandId,
        userId,
        subscriptionId: subscription?.id,
        razorpayOrderId: order.id,
        amount,
        currency: order.currency,
        status: PaymentStatus.PENDING,
        description,
      },
    });
    return { payment, order: { id: order.id, amount: order.amount, currency: order.currency } };
  }

  async verifyPayment(
    orderId: string,
    paymentId: string,
    signature: string,
  ): Promise<Payment> {
    const valid = this.razorpay.verifyPaymentSignature(orderId, paymentId, signature);
    if (!valid) throw new UnauthorizedException('Invalid payment signature');
    const payment = await this.prisma.payment.findFirst({ where: { razorpayOrderId: orderId } });
    if (!payment) throw new NotFoundException('Order not found');

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
        status: PaymentStatus.SUCCESS,
        paidAt: new Date(),
      },
    });
    if (updated.subscriptionId) {
      await this.prisma.subscription.update({
        where: { id: updated.subscriptionId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }
    // Offer boost — feature the offer for the purchased window, stacking on top
    // of any boost still in effect.
    if (updated.offerId && updated.boostDays) {
      const offer = await this.prisma.offer.findUnique({ where: { id: updated.offerId } });
      if (offer) {
        const now = new Date();
        const base = offer.featuredUntil && offer.featuredUntil > now ? offer.featuredUntil : now;
        const featuredUntil = new Date(base.getTime() + updated.boostDays * 24 * 60 * 60 * 1000);
        await this.prisma.offer.update({
          where: { id: updated.offerId },
          data: { isFeatured: true, featuredUntil },
        });
      }
    }
    return updated;
  }

  async handleWebhook(rawBody: string, signature: string): Promise<{ ok: true }> {
    const valid = this.razorpay.verifyWebhookSignature(rawBody, signature);
    if (!valid) throw new UnauthorizedException('Invalid webhook signature');

    let event: { event?: string; payload?: { payment?: { entity?: { order_id?: string; id?: string; status?: string } } } };
    try {
      event = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid JSON body');
    }
    const orderId = event.payload?.payment?.entity?.order_id;
    const paymentId = event.payload?.payment?.entity?.id;
    const status = event.payload?.payment?.entity?.status;

    if (!orderId || !paymentId) {
      this.logger.warn(`Webhook ${event.event} missing identifiers`);
      return { ok: true };
    }

    const payment = await this.prisma.payment.findFirst({ where: { razorpayOrderId: orderId } });
    if (!payment) {
      this.logger.warn(`Webhook for unknown order ${orderId}`);
      return { ok: true };
    }
    const newStatus =
      status === 'captured' ? PaymentStatus.SUCCESS :
      status === 'failed' ? PaymentStatus.FAILED :
      payment.status;
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        razorpayPaymentId: paymentId,
        paidAt: newStatus === PaymentStatus.SUCCESS ? new Date() : payment.paidAt,
        metadata: event as unknown as object,
      },
    });
    return { ok: true };
  }

  async listForBrand(brandId: string, userId: string) {
    const brand = await this.prisma.businessBrand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException('Brand not found');
    if (brand.ownerId !== userId) throw new ForbiddenException('Not the brand owner');
    return this.prisma.payment.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
