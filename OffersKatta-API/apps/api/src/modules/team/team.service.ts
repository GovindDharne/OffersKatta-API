import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvitationStatus, type Prisma, UserRole, type Invitation } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { PermissionsService } from '../rbac/permissions.service';
import type {
  AcceptInvitationDto,
  InviteTeamMemberDto,
  UpdateMemberPermissionsDto,
} from './dto/team.dto';

const INVITE_TTL_DAYS = 7;

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly permissions: PermissionsService,
  ) {}

  async invite(actorId: string, actorRole: UserRole, dto: InviteTeamMemberDto): Promise<Invitation> {
    await this.assertBrandOwner(dto.brandId, actorId, actorRole);
    if (dto.role === UserRole.BUSINESS_MANAGER && !dto.branchId) {
      throw new BadRequestException('branchId is required for manager invites');
    }
    if (dto.branchId) {
      const branch = await this.prisma.businessBranch.findFirst({
        where: { id: dto.branchId, brandId: dto.brandId, deletedAt: null },
      });
      if (!branch) throw new NotFoundException('Branch not found under this brand');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const invitation = await this.prisma.invitation.create({
      data: {
        brandId: dto.brandId,
        branchId: dto.branchId,
        email: dto.email,
        role: dto.role,
        tokenHash,
        status: InvitationStatus.PENDING,
        invitedById: actorId,
        expiresAt,
      },
      include: { brand: true },
    });

    const link = `https://offerhub.example/invite?token=${token}`;
    await this.mail.sendInvitation(dto.email, invitation.brand?.name ?? 'OffersKatta', link);
    return invitation;
  }

  async listForBrand(brandId: string): Promise<Invitation[]> {
    return this.prisma.invitation.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(id: string, actorId: string, actorRole: UserRole): Promise<void> {
    const invitation = await this.prisma.invitation.findUnique({ where: { id } });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.brandId) {
      await this.assertBrandOwner(invitation.brandId, actorId, actorRole);
    }
    await this.prisma.invitation.update({
      where: { id },
      data: { status: InvitationStatus.REVOKED },
    });
  }

  async accept(dto: AcceptInvitationDto): Promise<{ ok: true; userId: string }> {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');
    const invitation = await this.prisma.invitation.findUnique({ where: { tokenHash } });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(`Invitation is ${invitation.status.toLowerCase()}`);
    }
    if (invitation.expiresAt < new Date()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new BadRequestException('Invitation has expired');
    }

    let user = await this.prisma.user.findUnique({ where: { email: invitation.email } });
    if (!user) {
      if (!dto.password) throw new BadRequestException('Password required for new account');
      user = await this.prisma.user.create({
        data: {
          email: invitation.email,
          passwordHash: await bcrypt.hash(dto.password, 10),
          fullName: dto.fullName ?? invitation.email,
          role: invitation.role,
          isVerified: true,
          isActive: true,
        },
      });
    }

    if (invitation.branchId) {
      if (invitation.role === UserRole.BUSINESS_MANAGER) {
        await this.prisma.businessManager.upsert({
          where: { userId_branchId: { userId: user.id, branchId: invitation.branchId } },
          create: {
            userId: user.id,
            branchId: invitation.branchId,
            invitedById: invitation.invitedById,
            isActive: true,
          },
          update: { isActive: true },
        });
      } else if (invitation.role === UserRole.STAFF) {
        await this.prisma.staffAssignment.upsert({
          where: { userId_branchId: { userId: user.id, branchId: invitation.branchId } },
          create: { userId: user.id, branchId: invitation.branchId, isActive: true },
          update: { isActive: true },
        });
      }
    }

    const roleRecord = await this.prisma.role.findUnique({ where: { slug: invitation.role } });
    if (roleRecord) {
      const exists = await this.prisma.userRoleAssignment.findFirst({
        where: {
          userId: user.id,
          roleId: roleRecord.id,
          scopeType: invitation.branchId ? 'BRANCH' : 'BRAND',
          scopeId: invitation.branchId ?? invitation.brandId ?? null,
        },
      });
      if (!exists) {
        await this.prisma.userRoleAssignment.create({
          data: {
            userId: user.id,
            roleId: roleRecord.id,
            scopeType: invitation.branchId ? 'BRANCH' : 'BRAND',
            scopeId: invitation.branchId ?? invitation.brandId,
          },
        });
      }
    }

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
    });
    await this.permissions.invalidate(user.id);
    return { ok: true, userId: user.id };
  }

  async listManagers(branchId: string) {
    return this.prisma.businessManager.findMany({
      where: { branchId, deletedAt: null },
      include: { user: { select: { id: true, email: true, fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listStaff(branchId: string) {
    return this.prisma.staffAssignment.findMany({
      where: { branchId, deletedAt: null },
      include: { user: { select: { id: true, email: true, fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateManager(
    branchId: string,
    userId: string,
    dto: UpdateMemberPermissionsDto,
    actorId: string,
    actorRole: UserRole,
  ) {
    await this.assertBranchOwner(branchId, actorId, actorRole);
    const updated = await this.prisma.businessManager.update({
      where: { userId_branchId: { userId, branchId } },
      data: {
        permissions: dto.permissions as Prisma.InputJsonValue | undefined,
        isActive: dto.isActive,
      },
    });
    await this.permissions.invalidate(userId);
    return updated;
  }

  async removeManager(branchId: string, userId: string, actorId: string, actorRole: UserRole) {
    await this.assertBranchOwner(branchId, actorId, actorRole);
    await this.prisma.businessManager.update({
      where: { userId_branchId: { userId, branchId } },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.permissions.invalidate(userId);
  }

  async updateStaff(
    branchId: string,
    userId: string,
    dto: UpdateMemberPermissionsDto,
    actorId: string,
    actorRole: UserRole,
  ) {
    await this.assertBranchManagerOrOwner(branchId, actorId, actorRole);
    const updated = await this.prisma.staffAssignment.update({
      where: { userId_branchId: { userId, branchId } },
      data: {
        permissions: dto.permissions as Prisma.InputJsonValue | undefined,
        isActive: dto.isActive,
      },
    });
    await this.permissions.invalidate(userId);
    return updated;
  }

  async removeStaff(branchId: string, userId: string, actorId: string, actorRole: UserRole) {
    await this.assertBranchManagerOrOwner(branchId, actorId, actorRole);
    await this.prisma.staffAssignment.update({
      where: { userId_branchId: { userId, branchId } },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.permissions.invalidate(userId);
  }

  private async assertBrandOwner(brandId: string, actorId: string, actorRole: UserRole): Promise<void> {
    if (actorRole === UserRole.SUPER_ADMIN) return;
    const brand = await this.prisma.businessBrand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException('Brand not found');
    if (brand.ownerId !== actorId) throw new ForbiddenException('Not the brand owner');
  }

  private async assertBranchOwner(branchId: string, actorId: string, actorRole: UserRole): Promise<void> {
    if (actorRole === UserRole.SUPER_ADMIN) return;
    const branch = await this.prisma.businessBranch.findUnique({
      where: { id: branchId },
      include: { brand: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.brand.ownerId !== actorId) throw new ForbiddenException('Not the brand owner');
  }

  private async assertBranchManagerOrOwner(branchId: string, actorId: string, actorRole: UserRole): Promise<void> {
    if (actorRole === UserRole.SUPER_ADMIN) return;
    const branch = await this.prisma.businessBranch.findUnique({
      where: { id: branchId },
      include: {
        brand: true,
        managers: { where: { userId: actorId, isActive: true, deletedAt: null } },
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.brand.ownerId === actorId) return;
    if (branch.managers.length > 0) return;
    throw new ForbiddenException('Not a manager of this branch');
  }
}
