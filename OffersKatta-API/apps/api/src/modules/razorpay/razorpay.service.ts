import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';

export interface CreateOrderArgs {
  amount: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
}

@Injectable()
export class RazorpayService implements OnModuleInit {
  private readonly logger = new Logger(RazorpayService.name);
  private client?: Razorpay;
  private webhookSecret?: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    this.webhookSecret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');

    if (!keyId || !keySecret) {
      this.logger.warn('Razorpay disabled — credentials not configured');
      return;
    }
    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
    this.logger.log('Razorpay client ready');
  }

  isEnabled(): boolean {
    return Boolean(this.client);
  }

  /** Public key id for the browser checkout SDK — safe to expose; the secret is not. */
  getKeyId(): string | null {
    return this.config.get<string>('RAZORPAY_KEY_ID') ?? null;
  }

  async createOrder(args: CreateOrderArgs): Promise<RazorpayOrder> {
    if (!this.client) throw new Error('Razorpay is not configured');
    const order = await this.client.orders.create({
      amount: Math.round(args.amount * 100),
      currency: args.currency ?? 'INR',
      receipt: args.receipt,
      notes: args.notes,
    });
    return {
      id: order.id,
      amount: typeof order.amount === 'string' ? Number(order.amount) : (order.amount as number),
      currency: order.currency,
      receipt: order.receipt ?? undefined,
      status: order.status,
    };
  }

  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!keySecret) return false;
    const expected = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return safeEqual(expected, signature);
  }

  verifyWebhookSignature(body: string, signature: string): boolean {
    if (!this.webhookSecret) return false;
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(body)
      .digest('hex');
    return safeEqual(expected, signature);
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
