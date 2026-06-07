import { Module } from '@nestjs/common';
import { TerritoriesModule } from '../territories/territories.module';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';

@Module({
  imports: [TerritoriesModule],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
