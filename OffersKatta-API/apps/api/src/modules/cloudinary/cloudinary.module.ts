import { Global, Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { CloudinaryService } from './cloudinary.service';
import { UploadsController } from './uploads.controller';

const UPLOAD_ROOT = process.env.UPLOAD_DIR ?? '/app/uploads';

@Global()
@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: UPLOAD_ROOT,
      serveRoot: '/api/uploads/files',
      serveStaticOptions: {
        index: false,
        immutable: true,
        maxAge: '7d',
      },
    }),
  ],
  providers: [CloudinaryService],
  controllers: [UploadsController],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
