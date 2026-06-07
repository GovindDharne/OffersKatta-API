import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { BranchesService } from './branches.service';
import { CreateBranchDto, ListBranchesDto, UpdateBranchDto } from './dto/branch.dto';

@ApiBearerAuth()
@ApiTags('branches')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a branch under a brand (owner or admin)' })
  create(@Body() dto: CreateBranchDto, @CurrentUser() user: AuthUser) {
    return this.branches.create(user.id, user.role as UserRole, dto);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'List branches (public; territory-scoped for managers)' })
  list(@Query() q: ListBranchesDto, @CurrentUser() user?: AuthUser) {
    return this.branches.list(q, user);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a branch by id' })
  get(@Param('id') id: string) {
    return this.branches.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a branch (owner, branch manager, or admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto, @CurrentUser() user: AuthUser) {
    return this.branches.update(id, dto, user.id, user.role as UserRole);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a branch' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.branches.remove(id, user.id, user.role as UserRole);
  }

  /// CSV bulk import — for sellers onboarding 100+ branches. Multipart upload
  /// with a single `file` field. By default duplicates (same name+city in this
  /// brand) are updated; pass ?mode=create to skip them instead.
  ///
  /// CSV header (case-insensitive): name, addressLine1, addressLine2,
  /// city, state, country, postalCode, latitude, longitude, phone, email,
  /// shopNumber. Returns { created, updated, skipped, errors[] }.
  @Post('import')
  @ApiOperation({ summary: 'Bulk-import branches from a CSV file (chain sellers)' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async importCsv(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('brandId', new ParseUUIDPipe()) brandId: string,
    @Query('mode') mode: 'upsert' | 'create' | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('CSV file is required (field "file")');
    if (!/csv|excel|spreadsheet|plain/.test(file.mimetype) && !file.originalname.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Only CSV files are accepted');
    }
    return this.branches.bulkImport(brandId, file.buffer, {
      actorId: user.id,
      actorRole: user.role as UserRole,
      mode: mode === 'create' ? 'create' : 'upsert',
    });
  }
}
