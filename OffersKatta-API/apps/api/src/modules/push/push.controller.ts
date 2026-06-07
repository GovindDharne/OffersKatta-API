import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ListPushJobsDto, NotifyOfferDto } from './dto/push.dto';
import { PushService } from './push.service';

@ApiBearerAuth()
@ApiTags('push')
@Controller('push')
export class PushController {
  constructor(
    private readonly push: PushService,
    private readonly prisma: PrismaService,
  ) {}

  /// Fire-and-forget (synchronous for now). Returns the resulting PushJob
  /// row's counts so the seller UI can immediately show "Sent to N customers".
  @Post('offer/:offerId')
  @ApiOperation({ summary: 'Notify nearby customers about an offer (owner/admin)' })
  notifyOffer(
    @Param('offerId', new ParseUUIDPipe()) offerId: string,
    @Body() body: NotifyOfferDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.push.notifyOffer({
      offerId,
      radiusKm: body.radiusKm,
      audience: body.audience,
      triggeredById: user.id,
      triggeredByRole: user.role as UserRole,
    });
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List recent push jobs (filtered to the caller\'s brands)' })
  async listJobs(@Query() q: ListPushJobsDto, @CurrentUser() user: AuthUser) {
    const isAdmin = (user.role as UserRole) === UserRole.SUPER_ADMIN;
    if (q.brandId) return this.push.listJobs([q.brandId]);
    if (isAdmin) return this.push.listJobs([]);
    // Default for sellers: their own brands' jobs.
    const myBrands = await this.prisma.businessBrand.findMany({
      where: { ownerId: user.id, deletedAt: null },
      select: { id: true },
    });
    return this.push.listJobs(myBrands.map((b) => b.id));
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get one push job\'s full status' })
  getJob(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthUser) {
    return this.push.getJob(id, user.id, user.role as UserRole);
  }
}
