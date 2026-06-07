import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/// SMS gateway. Provider-agnostic: set SMS_PROVIDER + SMS_API_KEY (+ SMS_API_URL /
/// SMS_SENDER_ID as the provider needs) to enable. Until then it logs and no-ops,
/// mirroring FirebaseService / RazorpayService so the app boots without creds.
///
/// To wire a real provider, implement the branch in `send()` for your
/// SMS_PROVIDER (e.g. 'twilio' | 'msg91' | 'fast2sms' | 'http').
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider?: string;
  private readonly apiKey?: string;
  private readonly senderId?: string;
  private readonly apiUrl?: string;

  constructor(private readonly config: ConfigService) {
    this.provider = this.config.get<string>('SMS_PROVIDER');
    this.apiKey = this.config.get<string>('SMS_API_KEY');
    this.senderId = this.config.get<string>('SMS_SENDER_ID');
    this.apiUrl = this.config.get<string>('SMS_API_URL');

    if (this.isEnabled()) {
      this.logger.log(`SMS ready (provider=${this.provider})`);
    } else {
      this.logger.warn('SMS disabled — provider/credentials not configured');
    }
  }

  isEnabled(): boolean {
    return Boolean(this.provider && this.apiKey);
  }

  async send(to: string, message: string): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.warn(`SMS disabled; would send to ${to}: ${message}`);
      return;
    }

    try {
      switch (this.provider) {
        // case 'twilio': { ...Twilio Messages API... ; break; }
        // case 'msg91':  { ...MSG91 flow/send... ; break; }
        // case 'fast2sms': { ...Fast2SMS... ; break; }
        // case 'http': { generic GET/POST to this.apiUrl ; break; }
        default:
          // Provider not yet implemented — log so nothing is silently dropped.
          this.logger.warn(
            `SMS provider "${this.provider}" not implemented yet; would send to ${to}: ${message}`,
          );
          return;
      }
      // this.logger.log(`Sent SMS to ${to} via ${this.provider}`);
    } catch (err) {
      this.logger.error(`Failed to send SMS to ${to}`, (err as Error).message);
    }
  }

  async sendOtp(to: string, otp: string): Promise<void> {
    await this.send(
      to,
      `Your OffersKatta verification code is ${otp}. It expires in 10 minutes.`,
    );
  }
}
