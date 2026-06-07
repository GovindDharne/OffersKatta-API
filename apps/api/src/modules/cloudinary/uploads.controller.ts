import {
  BadRequestException,
  Controller,
  Logger,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { customAlphabet } from 'nanoid';
import * as path from 'path';
import * as fs from 'fs';
import type { Request } from 'express';

import { CloudinaryService, type SignedUploadParams } from './cloudinary.service';

const fileId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 16);

const UPLOAD_ROOT = process.env.UPLOAD_DIR ?? '/app/uploads';
const PUBLIC_URL_PREFIX = '/api/uploads/files';

const IMAGE_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
]);
const VIDEO_MIMES = new Set([
  'video/mp4', 'video/webm', 'video/quicktime',
]);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;       // 5 MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;      // 50 MB

@ApiBearerAuth()
@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  constructor(private readonly cloudinary: CloudinaryService) {
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  }

  // ────────────────────────────────────────────────────────────────────
  // Direct upload to API → local disk. Works without any cloud credentials.
  // ────────────────────────────────────────────────────────────────────
  @Post('file')
  @ApiOperation({ summary: 'Upload a single file (image or video) to the API' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_ROOT,
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase() || '';
          cb(null, `${Date.now()}-${fileId()}${ext}`);
        },
      }),
      limits: { fileSize: MAX_VIDEO_BYTES },
      fileFilter: (_req, file, cb) => {
        if (IMAGE_MIMES.has(file.mimetype) || VIDEO_MIMES.has(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false);
        }
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
    @Query('kind') _kind?: 'image' | 'video',
  ): Promise<{ url: string; absoluteUrl: string; filename: string; size: number; mimetype: string; kind: 'image' | 'video' }> {
    if (!file) throw new BadRequestException('No file uploaded');

    const isImage = IMAGE_MIMES.has(file.mimetype);
    const isVideo = VIDEO_MIMES.has(file.mimetype);
    if (!isImage && !isVideo) throw new BadRequestException('Unsupported file type');
    if (isImage && file.size > MAX_IMAGE_BYTES) {
      this.cleanup(file.filename);
      throw new BadRequestException(`Image too large (max ${MAX_IMAGE_BYTES / 1024 / 1024}MB)`);
    }
    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      this.cleanup(file.filename);
      throw new BadRequestException(`Video too large (max ${MAX_VIDEO_BYTES / 1024 / 1024}MB)`);
    }

    const relativeUrl = `${PUBLIC_URL_PREFIX}/${file.filename}`;
    const proto = (req.headers['x-forwarded-proto'] as string) ?? req.protocol;
    const host = req.headers.host;
    const absoluteUrl = `${proto}://${host}${relativeUrl}`;

    this.logger.log(`Uploaded ${file.mimetype} (${file.size}b) → ${relativeUrl}`);
    return {
      url: relativeUrl,
      absoluteUrl,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      kind: isImage ? 'image' : 'video',
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // Signed Cloudinary upload (kept for production where direct-to-Cloudinary is preferred).
  // The frontend will skip this if /api/uploads/file is already working.
  // ────────────────────────────────────────────────────────────────────
  @Post('sign')
  @ApiOperation({ summary: 'Get signed Cloudinary upload params (production path)' })
  sign(@Query('folder') folder?: string): SignedUploadParams {
    if (!this.cloudinary.isEnabled()) {
      throw new BadRequestException(
        'Cloudinary is not configured. Use POST /api/uploads/file for local uploads.',
      );
    }
    return this.cloudinary.signUpload(folder ?? 'offerhub');
  }

  private cleanup(filename: string): void {
    try {
      fs.unlinkSync(path.join(UPLOAD_ROOT, filename));
    } catch {
      // Ignore — best effort.
    }
  }
}
