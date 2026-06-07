import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { PrismaModule } from './prisma/prisma.module';
import { validateEnv } from './config/env.validation';

import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

import { CacheModule } from './modules/cache/cache.module';
import { MailModule } from './modules/mail/mail.module';
import { FirebaseModule } from './modules/firebase/firebase.module';
import { CloudinaryModule } from './modules/cloudinary/cloudinary.module';
import { RazorpayModule } from './modules/razorpay/razorpay.module';
import { RbacModule } from './modules/rbac/rbac.module';

import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

import { UsersModule } from './modules/users/users.module';
import { BrandsModule } from './modules/brands/brands.module';
import { BranchesModule } from './modules/branches/branches.module';
import { TerritoriesModule } from './modules/territories/territories.module';
import { BanksModule } from './modules/banks/banks.module';
import { MallsModule } from './modules/malls/malls.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TeamModule } from './modules/team/team.module';
import { OffersModule } from './modules/offers/offers.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { RedemptionsModule } from './modules/redemptions/redemptions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PushModule } from './modules/push/push.module';
import { PlacesModule } from './modules/places/places.module';
import { EnterpriseModule } from './modules/enterprise/enterprise.module';
import { CitiesModule } from './modules/cities/cities.module';
import { StatesModule } from './modules/states/states.module';
import { AdminModule } from './modules/admin/admin.module';
import { CustomersModule } from './modules/customers/customers.module';

import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL ?? 60) * 1000,
        limit: Number(process.env.THROTTLE_LIMIT ?? 100),
      },
    ]),

    PrismaModule,
    CacheModule,
    MailModule,
    FirebaseModule,
    CloudinaryModule,
    RazorpayModule,
    RbacModule,

    AuthModule,
    CustomersModule,
    UsersModule,
    BrandsModule,
    BranchesModule,
    TerritoriesModule,
    BanksModule,
    MallsModule,
    CategoriesModule,
    TeamModule,
    OffersModule,
    FavoritesModule,
    ReviewsModule,
    RedemptionsModule,
    NotificationsModule,
    SubscriptionsModule,
    PaymentsModule,
    PushModule,
    PlacesModule,
    EnterpriseModule,
    CitiesModule,
    StatesModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
