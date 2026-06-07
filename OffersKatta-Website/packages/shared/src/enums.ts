export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  SELLER_OWNER: 'SELLER_OWNER',
  BUSINESS_MANAGER: 'BUSINESS_MANAGER',
  STAFF: 'STAFF',
  CUSTOMER: 'CUSTOMER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const BusinessType = {
  SHOP: 'SHOP',
  RESTAURANT: 'RESTAURANT',
  HOTEL: 'HOTEL',
  SALON: 'SALON',
  GYM: 'GYM',
  SERVICE_PROVIDER: 'SERVICE_PROVIDER',
  LOCAL_BUSINESS: 'LOCAL_BUSINESS',
  OTHER: 'OTHER',
} as const;
export type BusinessType = (typeof BusinessType)[keyof typeof BusinessType];

export const BrandStatus = {
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  REJECTED: 'REJECTED',
} as const;
export type BrandStatus = (typeof BrandStatus)[keyof typeof BrandStatus];

export const BranchStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  TEMPORARILY_CLOSED: 'TEMPORARILY_CLOSED',
  PERMANENTLY_CLOSED: 'PERMANENTLY_CLOSED',
} as const;
export type BranchStatus = (typeof BranchStatus)[keyof typeof BranchStatus];

export const OfferStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  PAUSED: 'PAUSED',
  EXPIRED: 'EXPIRED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type OfferStatus = (typeof OfferStatus)[keyof typeof OfferStatus];

export const OfferType = {
  PERCENTAGE: 'PERCENTAGE',
  FLAT: 'FLAT',
  BUY_ONE_GET_ONE: 'BUY_ONE_GET_ONE',
  FREE_ITEM: 'FREE_ITEM',
  BUNDLE: 'BUNDLE',
} as const;
export type OfferType = (typeof OfferType)[keyof typeof OfferType];

export const SubscriptionPlan = {
  FREE: 'FREE',
  PREMIUM: 'PREMIUM',
  FEATURED: 'FEATURED',
} as const;
export type SubscriptionPlan = (typeof SubscriptionPlan)[keyof typeof SubscriptionPlan];

export const SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  PAST_DUE: 'PAST_DUE',
  TRIALING: 'TRIALING',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const PaymentStatus = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const NotificationType = {
  OFFER: 'OFFER',
  BOOKING: 'BOOKING',
  REDEMPTION: 'REDEMPTION',
  PAYMENT: 'PAYMENT',
  SYSTEM: 'SYSTEM',
  REVIEW: 'REVIEW',
  INVITATION: 'INVITATION',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const NotificationChannel = {
  PUSH: 'PUSH',
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  IN_APP: 'IN_APP',
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const RedemptionStatus = {
  PENDING: 'PENDING',
  REDEEMED: 'REDEEMED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;
export type RedemptionStatus = (typeof RedemptionStatus)[keyof typeof RedemptionStatus];

export const InvitationStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
} as const;
export type InvitationStatus = (typeof InvitationStatus)[keyof typeof InvitationStatus];
