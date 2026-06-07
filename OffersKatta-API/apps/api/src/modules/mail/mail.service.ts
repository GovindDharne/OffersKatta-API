import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface SendArgs {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter!: Transporter;
  private from!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const host = this.config.get<string>('SMTP_HOST') ?? 'mailhog';
    const port = Number(this.config.get<number>('SMTP_PORT') ?? 1025);
    const user = this.config.get<string>('SMTP_USER');
    const password = this.config.get<string>('SMTP_PASSWORD');
    this.from = this.config.get<string>('SMTP_FROM') ?? 'no-reply@offerhub.local';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && password ? { user, pass: password } : undefined,
    });
    this.logger.log(`Mailer ready (${host}:${port}, from=${this.from})`);
  }

  async send({ to, subject, text, html }: SendArgs): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
        html: html ?? text,
      });
      this.logger.log(`Sent "${subject}" to ${to} (${info.messageId})`);
    } catch (err) {
      this.logger.error(`Failed to send "${subject}" to ${to}`, (err as Error).message);
    }
  }

  async sendOtp(to: string, otp: string): Promise<void> {
    await this.send({
      to,
      subject: 'Your OffersKatta verification code',
      text: `Your one-time code is ${otp}. It expires in 10 minutes.`,
    });
  }

  async sendPasswordReset(to: string, link: string): Promise<void> {
    await this.send({
      to,
      subject: 'Reset your OffersKatta password',
      text: `Reset your password: ${link}\n\nThis link expires in 1 hour.`,
    });
  }

  async sendInvitation(to: string, brandName: string, link: string): Promise<void> {
    await this.send({
      to,
      subject: `You're invited to join ${brandName} on OffersKatta`,
      text: `Accept your invite: ${link}\n\nThis link expires in 7 days.`,
    });
  }
}
