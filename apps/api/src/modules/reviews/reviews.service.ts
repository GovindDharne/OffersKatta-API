import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, Review } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, type PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';

export interface CreateReviewInput {
  offerId?: string;
  branchId?: string;
  rating: number;
  title?: string;
  comment?: string;
  images?: string[];
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateReviewInput): Promise<Review> {
    if (!dto.offerId && !dto.branchId) {
      throw new BadRequestException('Either offerId or branchId is required');
    }
    if (dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }
    return this.prisma.review.create({
      data: {
        userId,
        offerId: dto.offerId,
        branchId: dto.branchId,
        rating: dto.rating,
        title: dto.title,
        comment: dto.comment,
        images: dto.images ?? [],
      },
    });
  }

  async listForOffer(offerId: string, q: PaginationDto): Promise<PaginatedResult<Review>> {
    return this.listWhere({ offerId, deletedAt: null, isApproved: true }, q);
  }

  async listForBranch(branchId: string, q: PaginationDto): Promise<PaginatedResult<Review>> {
    return this.listWhere({ branchId, deletedAt: null, isApproved: true }, q);
  }

  async update(id: string, userId: string, dto: Partial<CreateReviewInput>): Promise<Review> {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId) throw new ForbiddenException('Not your review');
    return this.prisma.review.update({
      where: { id },
      data: { rating: dto.rating, title: dto.title, comment: dto.comment, images: dto.images },
    });
  }

  async remove(id: string, userId: string, isAdmin: boolean): Promise<void> {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    if (!isAdmin && review.userId !== userId) throw new ForbiddenException('Not your review');
    await this.prisma.review.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async moderate(id: string, isApproved: boolean): Promise<Review> {
    return this.prisma.review.update({ where: { id }, data: { isApproved } });
  }

  private async listWhere(
    where: Prisma.ReviewWhereInput,
    q: PaginationDto,
  ): Promise<PaginatedResult<Review>> {
    const [total, data] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        skip: q.skip,
        take: q.limit,
        orderBy: { [q.sortBy ?? 'createdAt']: q.sortOrder },
        include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
      }),
    ]);
    return paginate(data, total, q.page, q.limit);
  }
}
