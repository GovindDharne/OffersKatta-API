import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlacesService } from './places.service';
import { AutocompleteQueryDto, PlaceDetailsQueryDto } from './dto/places.dto';

/// Wraps Google Places so the admin UI can autofill branch addresses.
/// All endpoints sit behind the global JwtAuthGuard — only signed-in users
/// can spend our quota.
@ApiBearerAuth()
@ApiTags('places')
@Controller('places')
export class PlacesController {
  constructor(private readonly svc: PlacesService) {}

  @Get('config')
  @ApiOperation({ summary: 'Whether the Places integration is configured' })
  config() {
    return this.svc.config();
  }

  @Get('autocomplete')
  @ApiOperation({ summary: 'Typeahead suggestions for a free-text query' })
  autocomplete(@Query() q: AutocompleteQueryDto) {
    return this.svc.autocomplete(q.q, q.sessionToken);
  }

  @Get('details/:placeId')
  @ApiOperation({ summary: 'Full structured address + coords for one place' })
  details(@Param('placeId') placeId: string, @Query() q: PlaceDetailsQueryDto) {
    return this.svc.details(placeId, q.sessionToken);
  }
}
