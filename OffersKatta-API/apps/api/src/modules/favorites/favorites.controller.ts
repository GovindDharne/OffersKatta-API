import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { FavoritesService } from './favorites.service';

@ApiBearerAuth()
@ApiTags('favorites')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'List the current user’s favorited offers' })
  list(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
    return this.favorites.listForUser(user.id, q);
  }

  @Post(':offerId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Favorite an offer' })
  add(@Param('offerId') offerId: string, @CurrentUser() user: AuthUser) {
    return this.favorites.add(user.id, offerId);
  }

  @Delete(':offerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Un-favorite an offer' })
  remove(@Param('offerId') offerId: string, @CurrentUser() user: AuthUser) {
    return this.favorites.remove(user.id, offerId);
  }
}
