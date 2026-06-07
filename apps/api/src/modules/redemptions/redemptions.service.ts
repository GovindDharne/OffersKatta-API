import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OfferStatus,
  RedemptionStatus,
  UserRole,
  type OfferRedemption,
} from '@prisma/client';
import { customAlphabet } from 'nanoid';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import {
  paginate,
  type PaginatedResult,
  type PaginationDto,
} from '../../common/dto/pagination.dto';

const qrTokenGen = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 16);
const REDEMPTION_TTL_HOURS = 24;

@Injectable()
export class RedemptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(customerId: string, offerId: string): Promise<{
    redemption: OfferRedemption;
    qrDataUrl: string;
  }> {
    const offer = await this.prisma.offer.findFirst({ where: { id: offerId, deletedAt: null } });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.status !== OfferStatus.PUBLISHED) {
      throw new BadRequestException('Offer is not available');
    }
    const now = new Date();
    if (offer.startsAt > now || offer.expiresAt < now) {
      throw new BadRequestException('Offer is outside its active window');
    }
    if (offer.maxRedemptions && offer.totalRedemptions >= offer.maxRedemptions) {
      throw new BadRequestException('Offer redemption cap reached');
    }
    if (offer.redemptionPerUser) {
      const used = await this.prisma.offerRedemption.count({
        where: { offerId, customerId, status: RedemptionStatus.REDEEMED },
      });
      if (used >= offer.redemptionPerUser) {
        throw new BadRequestException('Per-user redemption limit reached');
      }
    }
    const qrCode = qrTokenGen();
    const expiresAt = new Date(Date.now() + REDEMPTION_TTL_HOURS * 60 * 60 * 1000);
    const redemption = await this.prisma.offerRedemption.create({
      data: {
        offerId,
        customerId,
        branchId: offer.branchId,
        qrCode,
        status: RedemptionStatus.PENDING,
        expiresAt,
      },
    });
    const qrDataUrl = await QRCode.toDataURL(qrCode);
    return { redemption, qrDataUrl };
  }

  async confirm(
    qrCode: string,
    staffId: string,
    staffRole: UserRole,
    notes?: string,
    finalAmount?: number,
  ): Promise<OfferRedemption> {
    const redemption = await this.prisma.offerRedemption.findUnique({
      where: { qrCode },
      include: { offer: true },
    });
    if (!redemption) throw new NotFoundException('Redemption not found');
    if (redemption.status !== RedemptionStatus.PENDING) {
      throw new BadRequestException(`Redemption is ${redemption.status.toLowerCase()}`);
    }
    if (redemption.expiresAt < new Date()) {
      await this.prisma.offerRedemption.update({
        where: { id: redemption.id },
        data: { status: RedemptionStatus.EXPIRED },
      });
      throw new BadRequestException('Redemption has expired');
    }
    await this.ensureStaffAtBranch(redemption.branchId, staffId, staffRole);

    const discountApplied = computeDiscount(redemption.offer.discountValue, redemption.offer.offerType, finalAmount);

    const [updated] = await this.prisma.$transaction([
      this.prisma.offerRedemption.update({
        where: { id: redemption.id },
        data: {
          status: RedemptionStatus.REDEEMED,
          redeemedAt: new Date(),
          redeemedByStaffId: staffId,
          notes,
          finalAmount,
          discountApplied,
        },
      }),
      this.prisma.offer.update({
        where: { id: redemption.offerId },
        data: { totalRedemptions: { increment: 1 } },
      }),
    ]);
    return updated;
  }

  async cancel(qrCode: string, userId: string): Promise<OfferRedemption> {
    const redemption = await this.prisma.offerRedemption.findUnique({ where: { qrCode } });
    if (!redemption) throw new NotFoundException('Redemption not found');
    if (redemption.customerId !== userId) throw new ForbiddenException('Not your redemption');
    if (redemption.status !== RedemptionStatus.PENDING) {
      throw new BadRequestException('Only pending redemptions can be cancelled');
    }
    return this.prisma.offerRedemption.update({
      where: { id: redemption.id },
      data: { status: RedemptionStatus.CANCELLED },
    });
  }

  async myRedemptions(userId: string, q: PaginationDto): Promise<PaginatedResult<OfferRedemption>> {
    const [total, data] = await Promise.all([
      this.prisma.offerRedemption.count({ where: { customerId: userId } }),
      this.prisma.offerRedemption.findMany({
        where: { customerId: userId },
        include: { offer: { include: { branch: { select: { id: true, name: true, city: true } } } } },
        skip: q.skip,
        take: q.limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return paginate(data, total, q.page, q.limit);
  }

  async branchRedemptions(
    branchId: string,
    q: PaginationDto,
  ): Promise<PaginatedResult<OfferRedemption>> {
    const [total, data] = await Promise.all([
      this.prisma.offerRedemption.count({ where: { branchId } }),
      this.prisma.offerRedemption.findMany({
        where: { branchId },
        include: {
          offer: { select: { id: true, title: true } },
          customer: { select: { id: true, fullName: true, email: true } },
        },
        skip: q.skip,
        take: q.limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return paginate(data, total, q.page, q.limit);
  }

  private async ensureStaffAtBranch(branchId: string, userId: string, role: UserRole): Promise<void> {
    if (role === UserRole.SUPER_ADMIN) return;
    const branch = await this.prisma.businessBranch.findUnique({
      where: { id: branchId },
      include: {
        brand: true,
        managers: { where: { userId, isActive: true, deletedAt: null } },
        staff: { where: { userId, isActive: true, deletedAt: null } },
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.brand.ownerId === userId) return;
    if (branch.managers.length > 0 || branch.staff.length > 0) return;
    throw new ForbiddenException('You cannot redeem offers at this branch');
  }
}

function computeDiscount(
  discountValue: number,
  offerType: string,
  finalAmount?: number,
): number | undefined {
  if (!finalAmount) return undefined;
  if (offerType === 'PERCENTAGE') return Number(((finalAmount * discountValue) / 100).toFixed(2));
  if (offerType === 'FLAT') return Math.min(discountValue, finalAmount);
  return undefined;
}
