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
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { RolesGuard } from '../rbac/roles.guard';
import { ReviewsService } from './reviews.service';

class CreateReviewDto {
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() offerId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() branchId?: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(5) rating!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() title?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() comment?: string;
  @ApiProperty({ required: false, type: [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsUrl({}, { each: true })
  images?: string[];
}

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a review for an offer or branch' })
  create(@Body() dto: CreateReviewDto, @CurrentUser() user: AuthUser) {
    return this.reviews.create(user.id, dto);
  }

  @Public()
  @Get('offer/:offerId')
  listForOffer(@Param('offerId') offerId: string, @Query() q: PaginationDto) {
    return this.reviews.listForOffer(offerId, q);
  }

  @Public()
  @Get('branch/:branchId')
  listForBranch(@Param('branchId') branchId: string, @Query() q: PaginationDto) {
    return this.reviews.listForBranch(branchId, q);
  }

  @ApiBearerAuth()
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateReviewDto>, @CurrentUser() user: AuthUser) {
    return this.reviews.update(id, user.id, dto);
  }

  @ApiBearerAuth()
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.reviews.remove(id, user.id, user.role === UserRole.SUPER_ADMIN);
  }

  @ApiBearerAuth()
  @Patch(':id/moderate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  moderate(@Param('id') id: string, @Body('isApproved') isApproved: boolean) {
    return this.reviews.moderate(id, isApproved);
  }
}
