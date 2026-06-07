import { Injectable } from '@nestjs/common';
import type { State } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/// Read-only master list of Indian states + union territories. The set is
/// effectively fixed, so we only expose a list endpoint (seeded once). UTs
/// sort after states, then alphabetical, so the dropdown reads naturally.
@Injectable()
export class StatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<State[]> {
    return this.prisma.state.findMany({
      where: { isActive: true },
      orderBy: [{ isUnionTerritory: 'asc' }, { name: 'asc' }],
    });
  }
}
