import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { MallsService } from './malls.service';
import { CreateMallDto, ListMallsDto, NearbyMallsDto, UpdateMallDto } from './dto/mall.dto';

@ApiTags('malls')
@Controller('malls')
export class MallsController {
  constructor(private readonly malls: MallsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List active malls (public)' })
  list(@Query() q: ListMallsDto) {
    return this.malls.list(q);
  }

  @Public()
  @Get('nearby')
  @ApiOperation({ summary: 'List active malls within radiusKm of (latitude, longitude)' })
  nearby(@Query() q: NearbyMallsDto) {
    return this.malls.nearby(q);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a mall by id (with active branches)' })
  get(@Param('id') id: string) {
    return this.malls.findById(id);
  }

  @ApiBearerAuth()
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a mall (admin only). Sellers read the shared list but cannot add new entries.' })
  create(@Body() dto: CreateMallDto, @CurrentUser() user: AuthUser) {
    return this.malls.create(user.id, dto);
  }

  @ApiBearerAuth()
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a mall (admin only — sellers see a shared master list)' })
  update(@Param('id') id: string, @Body() dto: UpdateMallDto, @CurrentUser() user: AuthUser) {
    return this.malls.update(id, dto, user.id);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soft-delete a mall (admin only)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.malls.remove(id, user.id);
  }
}
