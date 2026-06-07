import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { TeamService } from './team.service';
import {
  AcceptInvitationDto,
  InviteTeamMemberDto,
  UpdateMemberPermissionsDto,
} from './dto/team.dto';

@ApiBearerAuth()
@ApiTags('team')
@Controller('team')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Post('invitations')
  @ApiOperation({ summary: 'Invite a manager or staff member to a brand/branch' })
  invite(@Body() dto: InviteTeamMemberDto, @CurrentUser() user: AuthUser) {
    return this.team.invite(user.id, user.role as UserRole, dto);
  }

  @Get('invitations')
  @ApiOperation({ summary: 'List invitations sent for a brand' })
  listInvites(@Query('brandId') brandId: string) {
    return this.team.listForBrand(brandId);
  }

  @Delete('invitations/:id')
  @ApiOperation({ summary: 'Revoke a pending invitation' })
  revoke(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.team.revoke(id, user.id, user.role as UserRole);
  }

  @Public()
  @Post('invitations/accept')
  @ApiOperation({ summary: 'Accept an invitation token (creates user if missing)' })
  accept(@Body() dto: AcceptInvitationDto) {
    return this.team.accept(dto);
  }

  @Get('branches/:branchId/managers')
  @ApiOperation({ summary: 'List managers of a branch' })
  listManagers(@Param('branchId') branchId: string) {
    return this.team.listManagers(branchId);
  }

  @Patch('branches/:branchId/managers/:userId')
  @ApiOperation({ summary: 'Update a manager (permissions/active state)' })
  updateManager(
    @Param('branchId') branchId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberPermissionsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.team.updateManager(branchId, userId, dto, user.id, user.role as UserRole);
  }

  @Delete('branches/:branchId/managers/:userId')
  @ApiOperation({ summary: 'Remove a manager from a branch' })
  removeManager(
    @Param('branchId') branchId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.team.removeManager(branchId, userId, user.id, user.role as UserRole);
  }

  @Get('branches/:branchId/staff')
  @ApiOperation({ summary: 'List staff of a branch' })
  listStaff(@Param('branchId') branchId: string) {
    return this.team.listStaff(branchId);
  }

  @Patch('branches/:branchId/staff/:userId')
  updateStaff(
    @Param('branchId') branchId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberPermissionsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.team.updateStaff(branchId, userId, dto, user.id, user.role as UserRole);
  }

  @Delete('branches/:branchId/staff/:userId')
  removeStaff(
    @Param('branchId') branchId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.team.removeStaff(branchId, userId, user.id, user.role as UserRole);
  }
}
