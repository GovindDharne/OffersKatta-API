import { Injectable } from '@nestjs/common';
import type { Bank, CardType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

export interface BankWithCards extends Bank {
  cards: CardType[];
}

const KEY = 'banks:list';
const TTL = 24 * 60 * 60;

@Injectable()
export class BanksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** Public list — banks with their active card types. Cached 24h. */
  list(): Promise<BankWithCards[]> {
    return this.cache.wrap(KEY, TTL, () =>
      this.prisma.bank.findMany({
        where: { isActive: true, deletedAt: null },
        include: {
          cards: {
            where: { isActive: true, deletedAt: null },
            orderBy: [{ category: 'asc' }, { name: 'asc' }],
          },
        },
        orderBy: { name: 'asc' },
      }),
    );
  }

  async listCardTypes(bankId: string): Promise<CardType[]> {
    return this.prisma.cardType.findMany({
      where: { bankId, isActive: true, deletedAt: null },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async invalidateCache(): Promise<void> {
    await this.cache.del(KEY);
  }
}
