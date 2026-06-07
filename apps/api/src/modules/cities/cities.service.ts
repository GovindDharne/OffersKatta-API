import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { City, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateCityDto, ListCitiesDto, UpdateCityDto } from './dto/city.dto';

/// Master-data CRUD for serviceable cities. Reads are open to any signed-in
/// user (forms need the list). Creates are allowed for sellers + admins (so a
/// seller isn't blocked when their city is missing); edits/deletes are
/// admin-only — enforced in the controller via RolesGuard.
@Injectable()
export class CitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListCitiesDto): Promise<City[]> {
    const where: Prisma.CityWhereInput = { isActive: true };
    if (query.state) where.state = { equals: query.state, mode: 'insensitive' };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { state: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.city.findMany({
      where,
      orderBy: [{ state: 'asc' }, { name: 'asc' }],
      take: 1000,
    });
  }

  async create(dto: CreateCityDto, actorId: string): Promise<City> {
    const name = dto.name.trim();
    const state = dto.state.trim();
    const existing = await this.prisma.city.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, state: { equals: state, mode: 'insensitive' } },
    });
    if (existing) {
      // Re-activate a soft-removed duplicate rather than erroring.
      if (!existing.isActive) {
        return this.prisma.city.update({ where: { id: existing.id }, data: { isActive: true } });
      }
      throw new BadRequestException(`${name}, ${state} already exists`);
    }
    return this.prisma.city.create({
      data: { name, state, country: dto.country?.trim() || 'India', createdById: actorId },
    });
  }

  async update(id: string, dto: UpdateCityDto): Promise<City> {
    await this.getOrThrow(id);
    return this.prisma.city.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.state !== undefined ? { state: dto.state.trim() } : {}),
        ...(dto.country !== undefined ? { country: dto.country.trim() || 'India' } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  /// Soft-delete (deactivate) — keeps the value valid on existing branches that
  /// already store the city string, but hides it from the picker.
  async remove(id: string): Promise<{ ok: true }> {
    await this.getOrThrow(id);
    await this.prisma.city.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  }

  private async getOrThrow(id: string): Promise<City> {
    const city = await this.prisma.city.findUnique({ where: { id } });
    if (!city) throw new NotFoundException('City not found');
    return city;
  }
}
