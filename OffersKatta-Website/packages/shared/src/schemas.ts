import { z } from 'zod';
import {
  BusinessType,
  OfferStatus,
  OfferType,
  SubscriptionPlan,
  UserRole,
} from './enums';

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type PaginationQuery = z.infer<typeof paginationSchema>;

export const geoPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const workingHoursDaySchema = z.object({
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
  isClosed: z.boolean().optional(),
});
export const workingHoursSchema = z.object({
  monday: workingHoursDaySchema.optional(),
  tuesday: workingHoursDaySchema.optional(),
  wednesday: workingHoursDaySchema.optional(),
  thursday: workingHoursDaySchema.optional(),
  friday: workingHoursDaySchema.optional(),
  saturday: workingHoursDaySchema.optional(),
  sunday: workingHoursDaySchema.optional(),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(100),
  phone: z.string().optional(),
  role: z.enum([UserRole.CUSTOMER, UserRole.SELLER_OWNER]).default(UserRole.CUSTOMER),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const phoneOtpRequestSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/),
});

export const phoneOtpVerifySchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/),
  otp: z.string().length(6),
});

export const createBrandSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  businessType: z.nativeEnum(BusinessType),
  websiteUrl: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  coverUrl: z.string().url().optional(),
  gstNumber: z.string().optional(),
  panNumber: z.string().optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
});
export type CreateBrandInput = z.infer<typeof createBrandSchema>;

export const createBranchSchema = z.object({
  brandId: z.string().uuid(),
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  addressLine1: z.string().min(2).max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  country: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  workingHours: workingHoursSchema.optional(),
  images: z.array(z.string().url()).max(10).default([]),
});
export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export const createOfferSchema = z
  .object({
    branchId: z.string().uuid(),
    title: z.string().min(3).max(200),
    description: z.string().max(5000).optional(),
    termsAndConditions: z.string().max(5000).optional(),
    offerType: z.nativeEnum(OfferType),
    discountValue: z.number().positive(),
    maxDiscountAmount: z.number().nonnegative().optional(),
    minPurchaseAmount: z.number().nonnegative().optional(),
    originalPrice: z.number().nonnegative().optional(),
    finalPrice: z.number().nonnegative().optional(),
    images: z.array(z.string().url()).max(10).default([]),
    startsAt: z.coerce.date(),
    expiresAt: z.coerce.date(),
    status: z.nativeEnum(OfferStatus).default(OfferStatus.DRAFT),
    isFeatured: z.boolean().default(false),
    maxRedemptions: z.number().int().positive().optional(),
    redemptionPerUser: z.number().int().positive().optional(),
    categoryIds: z.array(z.string().uuid()).optional(),
  })
  .refine((v) => v.expiresAt > v.startsAt, {
    message: 'expiresAt must be after startsAt',
    path: ['expiresAt'],
  });
export type CreateOfferInput = z.infer<typeof createOfferSchema>;

export const inviteManagerSchema = z.object({
  brandId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  email: z.string().email(),
  role: z.enum([UserRole.BUSINESS_MANAGER, UserRole.STAFF]),
});

export const nearbyOfferQuerySchema = paginationSchema.extend({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().positive().max(100).default(10),
  categoryId: z.string().uuid().optional(),
  businessType: z.nativeEnum(BusinessType).optional(),
});

export const subscribeSchema = z.object({
  brandId: z.string().uuid(),
  plan: z.nativeEnum(SubscriptionPlan),
  billingInterval: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
});
