import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase is not allowed in production');
    }
    const tables = [
      'audit_logs',
      'notifications',
      'payments',
      'subscriptions',
      'offer_redemptions',
      'favorites',
      'reviews',
      'offer_categories',
      'offers',
      'brand_categories',
      'categories',
      'staff_assignments',
      'business_managers',
      'business_branches',
      'invitations',
      'business_brands',
      'user_role_assignments',
      'role_permissions',
      'permissions',
      'roles',
      'refresh_tokens',
      'users',
    ];
    for (const t of tables) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE "${t}" RESTART IDENTITY CASCADE;`);
    }
  }
}
