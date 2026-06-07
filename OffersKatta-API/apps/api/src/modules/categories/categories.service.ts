import { Injectable, NotFoundException } from '@nestjs/common';
import type { Category } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { slugify } from '../../common/utils/slug';

interface CreateCategoryArgs {
  name: string;
  description?: string;
  iconUrl?: string;
  parentId?: string;
  sortOrder?: number;
}

@Injectable()
export class CategoriesService {
  private readonly LIST_KEY = 'category:list';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async list(): Promise<Category[]> {
    return this.cache.wrap(this.LIST_KEY, 24 * 60 * 60, () =>
      this.prisma.category.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
    );
  }

  async findById(id: string): Promise<Category> {
    const cat = await this.prisma.category.findUnique({ where: { id } });
    if (!cat || cat.deletedAt) throw new NotFoundException('Category not found');
    return cat;
  }

  async create(dto: CreateCategoryArgs): Promise<Category> {
    const slug = slugify(dto.name);
    const cat = await this.prisma.category.create({
      data: { ...dto, slug },
    });
    await this.cache.del(this.LIST_KEY);
    return cat;
  }

  async update(id: string, dto: Partial<CreateCategoryArgs> & { isActive?: boolean }): Promise<Category> {
    const cat = await this.prisma.category.update({ where: { id }, data: dto });
    await this.cache.del(this.LIST_KEY);
    return cat;
  }

  async remove(id: string): Promise<void> {
    await this.prisma.category.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    await this.cache.del(this.LIST_KEY);
  }
}
