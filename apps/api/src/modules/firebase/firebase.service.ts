import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface FirebaseUserClaims {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
  phoneNumber?: string;
  provider?: string;
}

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app?: admin.app.App;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase admin disabled — credentials not configured');
      return;
    }

    if (admin.apps.length > 0) {
      this.app = admin.app();
      return;
    }
    this.app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    this.logger.log(`Firebase admin initialized for ${projectId}`);
  }

  isEnabled(): boolean {
    return Boolean(this.app);
  }

  async verifyIdToken(idToken: string): Promise<FirebaseUserClaims> {
    if (!this.app) throw new Error('Firebase admin is not configured');
    const decoded = await this.app.auth().verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified,
      name: (decoded.name as string) ?? undefined,
      picture: decoded.picture,
      phoneNumber: (decoded as { phone_number?: string }).phone_number,
      provider: decoded.firebase?.sign_in_provider,
    };
  }

  /// Send one push. Returns a discriminated result so the caller can tell
  /// "the token is dead — strip it from the user profile" apart from
  /// "transient network error — leave it, try again next time".
  ///
  /// Firebase Admin error codes we treat as dead tokens (per FCM docs):
  ///   - messaging/registration-token-not-registered → user uninstalled / wiped app data
  ///   - messaging/invalid-registration-token        → garbled token
  ///   - messaging/invalid-argument                  → also a malformed token payload
  /// Everything else (auth, quota, internal) is transient — leave the token in place.
  async sendPush(
    fcmToken: string,
    notification: { title: string; body: string; data?: Record<string, string> },
  ): Promise<SendPushResult> {
    if (!this.app) return { ok: false, deadToken: false, error: 'firebase-not-configured' };
    try {
      const messageId = await this.app.messaging().send({
        token: fcmToken,
        notification: { title: notification.title, body: notification.body },
        data: notification.data,
      });
      return { ok: true, messageId };
    } catch (err) {
      const e = err as { code?: string; message?: string };
      const code = e?.code ?? '';
      const dead = code === 'messaging/registration-token-not-registered'
        || code === 'messaging/invalid-registration-token'
        || code === 'messaging/invalid-argument';
      this.logger.warn(`FCM send failed (${code || 'unknown'}): ${e?.message ?? err}`);
      return { ok: false, deadToken: dead, error: code || (e?.message ?? 'unknown') };
    }
  }
}

export type SendPushResult =
  | { ok: true; messageId: string }
  | { ok: false; deadToken: boolean; error: string };
