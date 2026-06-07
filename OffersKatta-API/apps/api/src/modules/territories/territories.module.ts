import { Module } from '@nestjs/common';
import { TerritoriesController } from './territories.controller';
import { TerritoriesService } from './territories.service';
import { TerritoryScopeService } from './territory-scope.service';

@Module({
  controllers: [TerritoriesController],
  providers: [TerritoriesService, TerritoryScopeService],
  // TerritoryScopeService is consumed by Branches / Offers / Push to enforce
  // regional/zone manager scope.
  exports: [TerritoriesService, TerritoryScopeService],
})
export class TerritoriesModule {}
