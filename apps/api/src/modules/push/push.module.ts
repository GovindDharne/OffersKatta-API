import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { BrandsModule } from '../brands/brands.module';
import { TerritoriesModule } from '../territories/territories.module';
import { PushController } from './push.controller';
import { PushQueueService } from './push.queue';
import { PushService } from './push.service';

@Module({
  imports: [CacheModule, BrandsModule, TerritoriesModule],
  controllers: [PushController],
  providers: [PushService, PushQueueService],
  exports: [PushService],
})
export class PushModule {}
