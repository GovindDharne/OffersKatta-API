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
import { BrandsService } from './brands.service';
import {
  CreateBrandDto,
  ListBrandsDto,
  UpdateBrandDto,
  VerifyBrandDto,
} from './dto/brand.dto';

@ApiBearerAuth()
@ApiTags('brands')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a brand (current user becomes owner)' })
  create(@Body() dto: CreateBrandDto, @CurrentUser() user: AuthUser) {
    return this.brands.create(user.id, dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List brands (public)' })
  list(@Query() q: ListBrandsDto) {
    return this.brands.list(q);
  }

  @Get('mine')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List brands owned by the current user' })
  mine(@Query() q: ListBrandsDto, @CurrentUser() user: AuthUser) {
    return this.brands.listOwn(user.id, q);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a brand by id' })
  get(@Param('id') id: string) {
    return this.brands.findById(id);
  }

  @Public()
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get a brand by slug' })
  getBySlug(@Param('slug') slug: string) {
    return this.brands.findBySlug(slug);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a brand (owner or admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateBrandDto, @CurrentUser() user: AuthUser) {
    return this.brands.update(id, dto, user.id, user.role as UserRole);
  }

  @Patch(':id/verify')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve, suspend, or reject a brand (admin)' })
  verify(@Param('id') id: string, @Body() dto: VerifyBrandDto) {
    return this.brands.verify(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a brand (owner or admin)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.brands.remove(id, user.id, user.role as UserRole);
  }

  // ─── Follows ─────────────────────────────────────────────
  // Customers "follow" a brand to get push for any new offers regardless
  // of distance from the brand's branches. Idempotent — the DB upsert
  // handles double-clicks silently.

  @Get('me/follows')
  @ApiOperation({ summary: 'List brands the current user follows' })
  listMyFollows(@CurrentUser() user: AuthUser) {
    return this.brands.listFollowsByUser(user.id);
  }

  @Get(':id/follow/status')
  @ApiOperation({ summary: 'Is the current user following this brand?' })
  followStatus(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.brands.followStatus(id, user.id);
  }

  @Post(':id/follow')
  @ApiOperation({ summary: 'Follow a brand (customer)' })
  follow(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.brands.follow(id, user.id);
  }

  @Delete(':id/follow')
  @ApiOperation({ summary: 'Unfollow a brand' })
  unfollow(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.brands.unfollow(id, user.id);
  }
}
