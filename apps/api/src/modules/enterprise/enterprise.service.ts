import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BillingInterval,
  EnterpriseLeadStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  type EnterpriseLead,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateEnterpriseLeadDto,
  ProvisionEnterpriseDto,
  UpdateEnterpriseLeadDto,
} from './dto/enterprise.dto';

/// Sales-motion service for the Enterprise plan.
///
///   capture  → a lead lands (public or seller-initiated)
///   triage   → super admin updates status / notes
///   provision→ super admin flips the brand to ENTERPRISE on a won deal
///
/// Enterprise is intentionally kept OUT of the self-serve Razorpay path
/// (see SubscriptionsService.changePlan) — it's a contracted, offline-billed
/// tier, so activation only happens here, behind the SUPER_ADMIN guard.
@Injectable()
export class EnterpriseService {
  private readonly log = new Logger(EnterpriseService.name);
  constructor(private readonly prisma: PrismaService) {}

  /// Capture an inbound enquiry. `submittedById` is set when a signed-in user
  /// submits; null for anonymous/marketing-site submissions.
  async createLead(dto: CreateEnterpriseLeadDto, submittedById?: string): Promise<EnterpriseLead> {
    // If a brand was named, make sure it exists so we don't store a dangling id.
    if (dto.brandId) {
      const brand = await this.prisma.businessBrand.findUnique({ where: { id: dto.brandId } });
      if (!brand) throw new NotFoundException('Brand not found');
    }
    const lead = await this.prisma.enterpriseLead.create({
      data: {
        companyName: dto.companyName,
        contactName: dto.contactName,
        email: dto.email,
        phone: dto.phone,
        estimatedBranches: dto.estimatedBranches,
        message: dto.message,
        brandId: dto.brandId,
        submittedById: submittedById ?? null,
      },
    });
    this.log.log(`New enterprise lead ${lead.id} from ${lead.email} (${lead.companyName})`);
    return lead;
  }

  async listLeads(status?: EnterpriseLeadStatus): Promise<EnterpriseLead[]> {
    return this.prisma.enterpriseLead.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { brand: { select: { id: true, name: true } } },
    });
  }

  async updateLead(id: string, dto: UpdateEnterpriseLeadDto, handledById: string): Promise<EnterpriseLead> {
    const lead = await this.prisma.enterpriseLead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    return this.prisma.enterpriseLead.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.internalNotes !== undefined ? { internalNotes: dto.internalNotes } : {}),
        handledById,
      },
    });
  }

  /// Flip a brand to ENTERPRISE for `termMonths` (default 12). Records the
  /// contract `amount` for reporting but bills offline (no Razorpay). Marks the
  /// originating lead WON. Returns the lead + the provisioned subscription.
  async provisionFromLead(leadId: string, dto: ProvisionEnterpriseDto, handledById: string) {
    const lead = await this.prisma.enterpriseLead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const brandId = dto.brandId ?? lead.brandId;
    if (!brandId) {
      throw new BadRequestException(
        'This lead is not linked to a brand. Pass brandId to choose which brand to upgrade.',
      );
    }
    const brand = await this.prisma.businessBrand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException('Brand not found');

    const subscription = await this.provisionBrand(brandId, {
      termMonths: dto.termMonths ?? 12,
      amount: dto.amount ?? 0,
    });

    const updatedLead = await this.prisma.enterpriseLead.update({
      where: { id: leadId },
      data: {
        status: EnterpriseLeadStatus.WON,
        handledById,
        // Backfill the brand link if the deal closed against an explicit brand.
        ...(lead.brandId ? {} : { brandId }),
      },
    });

    this.log.log(`Provisioned ENTERPRISE for brand ${brandId} from lead ${leadId}`);
    return { lead: updatedLead, subscription };
  }

  /// Low-level: upsert an ACTIVE ENTERPRISE subscription for a brand. Shared by
  /// the lead-provision path and any future admin "set tier" override.
  private async provisionBrand(brandId: string, opts: { termMonths: number; amount: number }) {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + opts.termMonths);

    return this.prisma.subscription.upsert({
      where: { brandId },
      create: {
        brandId,
        plan: SubscriptionPlan.ENTERPRISE,
        status: SubscriptionStatus.ACTIVE,
        billingInterval: BillingInterval.YEARLY,
        amount: opts.amount,
        startDate: now,
        endDate,
        autoRenew: false, // contracted; renewed manually by sales
      },
      update: {
        plan: SubscriptionPlan.ENTERPRISE,
        status: SubscriptionStatus.ACTIVE,
        billingInterval: BillingInterval.YEARLY,
        amount: opts.amount,
        startDate: now,
        endDate,
        cancelledAt: null,
        autoRenew: false,
      },
    });
  }
}
