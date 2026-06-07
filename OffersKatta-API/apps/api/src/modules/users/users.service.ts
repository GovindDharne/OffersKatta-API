import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, type PaginatedResult } from '../../common/dto/pagination.dto';
import type { ListUsersDto, UpdateProfileDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getProfile(id: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.findByIdOrThrow(id);
    const { passwordHash: _ph, ...safe } = user;
    return safe;
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { ...dto, updatedById: id },
    });
    const { passwordHash: _ph, ...safe } = user;
    return safe;
  }

  async list(query: ListUsersDto): Promise<PaginatedResult<Omit<User, 'passwordHash'>>> {
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (query.role) where.role = query.role as Prisma.EnumUserRoleFilter;
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
      ];
    }
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder },
      }),
    ]);
    return paginate(
      rows.map(({ passwordHash: _, ...r }) => r),
      total,
      query.page,
      query.limit,
    );
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { isActive } });
  }

  async softDelete(id: string, deletedById: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, updatedById: deletedById },
    });
  }
}
