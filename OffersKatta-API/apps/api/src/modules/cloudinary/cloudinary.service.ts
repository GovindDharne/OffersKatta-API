import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export interface SignedUploadParams {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}

@Injectable()
export class CloudinaryService implements OnModuleInit {
  private readonly logger = new Logger(CloudinaryService.name);
  private cloudName?: string;
  private apiKey?: string;
  private apiSecret?: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    this.apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    this.apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');

    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      this.logger.warn('Cloudinary disabled — credentials not configured');
      return;
    }
    cloudinary.config({
      cloud_name: this.cloudName,
      api_key: this.apiKey,
      api_secret: this.apiSecret,
      secure: true,
    });
    this.logger.log(`Cloudinary configured (cloud=${this.cloudName})`);
  }

  isEnabled(): boolean {
    return Boolean(this.cloudName && this.apiKey && this.apiSecret);
  }

  /**
   * Returns a signed upload preset the client can use to upload directly to Cloudinary.
   * This keeps large binaries off our API.
   */
  signUpload(folder = 'offerhub'): SignedUploadParams {
    if (!this.isEnabled()) throw new Error('Cloudinary is not configured');
    const timestamp = Math.round(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      this.apiSecret as string,
    );
    return {
      signature,
      timestamp,
      apiKey: this.apiKey as string,
      cloudName: this.cloudName as string,
      folder,
    };
  }

  async destroy(publicId: string): Promise<void> {
    if (!this.isEnabled()) return;
    await cloudinary.uploader.destroy(publicId);
  }
}
