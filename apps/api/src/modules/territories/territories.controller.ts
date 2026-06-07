import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { TerritoriesService } from './territories.service';
import {
  AssignManagerDto,
  CreateRegionDto,
  CreateZoneDto,
  ListTerritoriesDto,
  UpdateRegionDto,
  UpdateZoneDto,
} from './dto/territory.dto';

/// Endpoints are nested under `/brands/:brandId/...` so it's obvious from the
/// URL which brand owns the territory. Reads don't enforce auth beyond the
/// global guard (signed-in users can list any brand's territories — fine for
/// public-facing UIs).
@ApiBearerAuth()
@ApiTags('territories')
@Controller('brands/:brandId')
export class TerritoriesController {
  constructor(private readonly svc: TerritoriesService) {}

  // ─── Regions ──────────────────────────────────────────────

  @Get('regions')
  @ApiOperation({ summary: 'List regions for a brand' })
  listRegions(@Param('brandId', new ParseUUIDPipe()) brandId: string) {
    return this.svc.listRegions(brandId);
  }

  @Post('regions')
  @ApiOperation({ summary: 'Create a region (brand owner or admin)' })
  createRegion(
    @Param('brandId', new ParseUUIDPipe()) brandId: string,
    @Body() dto: CreateRegionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.createRegion(brandId, dto, user.id, user.role as UserRole);
  }

  @Patch('regions/:id')
  @ApiOperation({ summary: 'Update a region' })
  updateRegion(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRegionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.updateRegion(id, dto, user.id, user.role as UserRole);
  }

  @Delete('regions/:id')
  @ApiOperation({ summary: 'Soft-delete a region (zones inside also archived)' })
  deleteRegion(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.deleteRegion(id, user.id, user.role as UserRole);
  }

  // ─── Zones ────────────────────────────────────────────────

  @Get('zones')
  @ApiOperation({ summary: 'List zones for a brand (optionally filtered by region)' })
  listZones(
    @Param('brandId', new ParseUUIDPipe()) brandId: string,
    @Query() q: ListTerritoriesDto,
  ) {
    return this.svc.listZones(brandId, q.regionId);
  }

  @Post('zones')
  @ApiOperation({ summary: 'Create a zone (brand owner or admin)' })
  createZone(
    @Param('brandId', new ParseUUIDPipe()) brandId: string,
    @Body() dto: CreateZoneDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.createZone(brandId, dto, user.id, user.role as UserRole);
  }

  @Patch('zones/:id')
  @ApiOperation({ summary: 'Update a zone (name / move to another region)' })
  updateZone(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateZoneDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.updateZone(id, dto, user.id, user.role as UserRole);
  }

  @Delete('zones/:id')
  @ApiOperation({ summary: 'Soft-delete a zone (branches in it lose their zoneId)' })
  deleteZone(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.deleteZone(id, user.id, user.role as UserRole);
  }

  // ─── Territory managers (brand owner or admin) ────────────

  @Get('managers')
  @ApiOperation({ summary: 'List territory managers for a brand' })
  listManagers(
    @Param('brandId', new ParseUUIDPipe()) brandId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.listManagers(brandId, user.id, user.role as UserRole);
  }

  @Post('managers')
  @ApiOperation({ summary: 'Assign a user as a regional/zone manager' })
  assignManager(
    @Param('brandId', new ParseUUIDPipe()) brandId: string,
    @Body() dto: AssignManagerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.assignManager(brandId, dto, user.id, user.role as UserRole);
  }

  @Delete('managers/:id')
  @ApiOperation({ summary: 'Remove a territory manager assignment' })
  removeManager(
    @Param('brandId', new ParseUUIDPipe()) brandId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.removeManager(brandId, id, user.id, user.role as UserRole);
  }
}
