import { z } from 'zod';
import { Logger } from '@nestjs/common';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://redis:6379'),
  REDIS_TTL: z.coerce.number().int().positive().default(300),

  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // Phase 7 — Google Places autocomplete on branch form. Optional: when unset
  // the /places/* endpoints return { enabled: false } and the admin UI falls
  // back to the existing manual-entry + map-picker flow.
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  // Region bias for autocomplete (ISO 3166-1 alpha-2). India by default since
  // that's our primary market — overridable per-deployment.
  GOOGLE_PLACES_REGION: z.string().length(2).default('in'),

  SMTP_HOST: z.string().default('mailhog'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('no-reply@offerhub.local'),

  THROTTLE_TTL: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),

  CORS_ORIGINS: z.string().default('*'),

  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const logger = new Logger('Env');
    for (const issue of result.error.issues) {
      logger.error(`${issue.path.join('.')}: ${issue.message}`);
    }
    throw new Error('Environment validation failed');
  }
  return result.data;
}
