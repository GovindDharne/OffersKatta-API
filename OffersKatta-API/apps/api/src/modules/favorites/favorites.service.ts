import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, type PaginatedResult, type PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async add(userId: string, offerId: string) {
    return this.prisma.favorite.upsert({
      where: { userId_offerId: { userId, offerId } },
      create: { userId, offerId },
      update: {},
    });
  }

  async remove(userId: string, offerId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId, offerId } });
  }

  async listForUser(userId: string, q: PaginationDto): Promise<PaginatedResult<unknown>> {
    const [total, data] = await Promise.all([
      this.prisma.favorite.count({ where: { userId } }),
      this.prisma.favorite.findMany({
        where: { userId },
        include: {
          offer: {
            include: {
              branch: { select: { id: true, name: true, city: true, brand: { select: { id: true, name: true } } } },
            },
          },
        },
        skip: q.skip,
        take: q.limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return paginate(data, total, q.page, q.limit);
  }
}
