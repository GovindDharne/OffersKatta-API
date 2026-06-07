import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { CategoriesService } from './categories.service';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUrl, IsUUID, MinLength } from 'class-validator';

class CreateCategoryDto {
  @ApiProperty() @IsString() @MinLength(2) name!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUrl() iconUrl?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() parentId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() sortOrder?: number;
}

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List active categories (cached for 24h)' })
  list() {
    return this.categories.list();
  }

  @Public()
  @Get(':id')
  get(@Param('id') id: string) {
    return this.categories.findById(id);
  }

  @ApiBearerAuth()
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a category (admin)' })
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @ApiBearerAuth()
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: Partial<CreateCategoryDto> & { isActive?: boolean }) {
    return this.categories.update(id, dto);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }
}
