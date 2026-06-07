import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { AdminService } from './admin.service';

@ApiBearerAuth()
@ApiTags('admin')
@UseGuards(RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Platform-wide metrics for the admin dashboard' })
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('brands/pending')
  @ApiOperation({ summary: 'Brands awaiting verification' })
  pendingBrands() {
    return this.admin.pendingBrands();
  }

  @Get('reviews/pending')
  @ApiOperation({ summary: 'Reviews awaiting moderation' })
  pendingReviews() {
    return this.admin.pendingReviews();
  }
}
