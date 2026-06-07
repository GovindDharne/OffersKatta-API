import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { OffersService } from './offers.service';
import {
  CreateOfferDto,
  ListOffersDto,
  NearbyOffersDto,
  UpdateOfferDto,
} from './dto/offer.dto';

@ApiBearerAuth()
@ApiTags('offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Post()
  @ApiOperation({ summary: 'Create an offer for a branch (owner or branch manager)' })
  create(@Body() dto: CreateOfferDto, @CurrentUser() user: AuthUser) {
    return this.offers.create(user.id, user.role as UserRole, dto);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'List offers (public; territory-scoped for managers)' })
  list(@Query() q: ListOffersDto, @CurrentUser() user?: AuthUser) {
    return this.offers.list(q, user);
  }

  @Public()
  @Get('nearby')
  @ApiOperation({ summary: 'List published offers near a lat/lng within radiusKm' })
  nearby(@Query() q: NearbyOffersDto) {
    return this.offers.nearby(q);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get an offer by id with all reachable stores (increments view count)' })
  async get(@Param('id') id: string) {
    const offer = await this.offers.findByIdWithReach(id);
    this.offers.incrementView(id).catch(() => undefined);
    return offer;
  }

  @Public()
  @Post(':id/click')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Track an outbound click on an offer' })
  click(@Param('id') id: string) {
    return this.offers.incrementClick(id);
  }

  @Public()
  @Post(':id/share')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Track a share of an offer' })
  share(@Param('id') id: string) {
    return this.offers.incrementShare(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an offer (owner or branch manager)' })
  update(@Param('id') id: string, @Body() dto: UpdateOfferDto, @CurrentUser() user: AuthUser) {
    return this.offers.update(id, dto, user.id, user.role as UserRole);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete (archive) an offer' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.offers.remove(id, user.id, user.role as UserRole);
  }
}
