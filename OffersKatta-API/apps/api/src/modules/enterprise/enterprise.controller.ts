import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { EnterpriseService } from './enterprise.service';
import {
  CreateEnterpriseLeadDto,
  ListEnterpriseLeadsDto,
  ProvisionEnterpriseDto,
  UpdateEnterpriseLeadDto,
} from './dto/enterprise.dto';

@ApiTags('enterprise')
@Controller('enterprise')
export class EnterpriseController {
  constructor(private readonly enterprise: EnterpriseService) {}

  /// Public lead capture — works logged-out (marketing site) or logged-in.
  /// NB: @Public() short-circuits the JWT guard before passport runs, so
  /// req.user is not populated here and submittedById stays null. The
  /// meaningful linkage is `brandId`, which a signed-in seller selects in the
  /// Contact-Sales dialog.
  @Public()
  @Post('leads')
  @ApiOperation({ summary: 'Submit an Enterprise "Contact Sales" enquiry' })
  createLead(@Body() dto: CreateEnterpriseLeadDto) {
    return this.enterprise.createLead(dto);
  }

  // ─── Super-admin sales queue ──────────────────────────────

  @ApiBearerAuth()
  @Get('leads')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List Enterprise leads (super admin)' })
  listLeads(@Query() q: ListEnterpriseLeadsDto) {
    return this.enterprise.listLeads(q.status);
  }

  @ApiBearerAuth()
  @Patch('leads/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update lead status / internal notes (super admin)' })
  updateLead(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEnterpriseLeadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.enterprise.updateLead(id, dto, user.id);
  }

  @ApiBearerAuth()
  @Post('leads/:id/provision')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Provision ENTERPRISE for the lead\'s brand + mark WON (super admin)' })
  provision(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ProvisionEnterpriseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.enterprise.provisionFromLead(id, dto, user.id);
  }
}
