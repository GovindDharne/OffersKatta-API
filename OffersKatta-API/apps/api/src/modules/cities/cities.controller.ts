import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { CitiesService } from './cities.service';
import { CreateCityDto, ListCitiesDto, UpdateCityDto } from './dto/city.dto';

@ApiTags('cities')
@Controller('cities')
export class CitiesController {
  constructor(private readonly cities: CitiesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List active cities (for the City dropdown)' })
  list(@Query() q: ListCitiesDto) {
    return this.cities.list(q);
  }

  @ApiBearerAuth()
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Add a city (seller or admin)' })
  create(@Body() dto: CreateCityDto, @CurrentUser() user: AuthUser) {
    return this.cities.create(dto, user.id);
  }

  @ApiBearerAuth()
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Edit a city (seller or admin)' })
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateCityDto) {
    return this.cities.update(id, dto);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Deactivate a city (seller or admin)' })
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.cities.remove(id);
  }
}
