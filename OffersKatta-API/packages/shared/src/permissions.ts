export const Resource = {
  USER: 'user',
  BRAND: 'brand',
  BRANCH: 'branch',
  MANAGER: 'manager',
  STAFF: 'staff',
  OFFER: 'offer',
  CATEGORY: 'category',
  REDEMPTION: 'redemption',
  REVIEW: 'review',
  PAYMENT: 'payment',
  SUBSCRIPTION: 'subscription',
  ANALYTICS: 'analytics',
  BILLING: 'billing',
  SETTINGS: 'settings',
  INVITATION: 'invitation',
  NOTIFICATION: 'notification',
} as const;
export type Resource = (typeof Resource)[keyof typeof Resource];

export const Action = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  MANAGE: 'manage',
  APPROVE: 'approve',
  REDEEM: 'redeem',
} as const;
export type Action = (typeof Action)[keyof typeof Action];

export interface Permission {
  resource: Resource;
  action: Action;
}

export const permissionSlug = (resource: Resource, action: Action): string =>
  `${resource}:${action}`;

/**
 * Default permission matrix per role. The database is the source of truth at runtime;
 * this constant is used by the seeder and by the web frontend to render menus optimistically.
 */
export const DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: Object.values(Resource).flatMap((resource) =>
    Object.values(Action).map((action) => ({ resource, action })),
  ),
  SELLER_OWNER: [
    { resource: Resource.BRAND, action: Action.CREATE },
    { resource: Resource.BRAND, action: Action.READ },
    { resource: Resource.BRAND, action: Action.UPDATE },
    { resource: Resource.BRAND, action: Action.DELETE },
    { resource: Resource.BRANCH, action: Action.CREATE },
    { resource: Resource.BRANCH, action: Action.READ },
    { resource: Resource.BRANCH, action: Action.UPDATE },
    { resource: Resource.BRANCH, action: Action.DELETE },
    { resource: Resource.MANAGER, action: Action.CREATE },
    { resource: Resource.MANAGER, action: Action.READ },
    { resource: Resource.MANAGER, action: Action.UPDATE },
    { resource: Resource.MANAGER, action: Action.DELETE },
    { resource: Resource.STAFF, action: Action.MANAGE },
    { resource: Resource.OFFER, action: Action.MANAGE },
    { resource: Resource.INVITATION, action: Action.MANAGE },
    { resource: Resource.SUBSCRIPTION, action: Action.MANAGE },
    { resource: Resource.PAYMENT, action: Action.READ },
    { resource: Resource.BILLING, action: Action.MANAGE },
    { resource: Resource.ANALYTICS, action: Action.READ },
    { resource: Resource.SETTINGS, action: Action.MANAGE },
  ],
  BUSINESS_MANAGER: [
    { resource: Resource.BRANCH, action: Action.READ },
    { resource: Resource.BRANCH, action: Action.UPDATE },
    { resource: Resource.OFFER, action: Action.CREATE },
    { resource: Resource.OFFER, action: Action.READ },
    { resource: Resource.OFFER, action: Action.UPDATE },
    { resource: Resource.OFFER, action: Action.DELETE },
    { resource: Resource.STAFF, action: Action.READ },
    { resource: Resource.STAFF, action: Action.UPDATE },
    { resource: Resource.REDEMPTION, action: Action.READ },
    { resource: Resource.REDEMPTION, action: Action.REDEEM },
    { resource: Resource.ANALYTICS, action: Action.READ },
    { resource: Resource.REVIEW, action: Action.READ },
  ],
  STAFF: [
    { resource: Resource.OFFER, action: Action.READ },
    { resource: Resource.REDEMPTION, action: Action.READ },
    { resource: Resource.REDEMPTION, action: Action.REDEEM },
    { resource: Resource.ANALYTICS, action: Action.READ },
  ],
  CUSTOMER: [
    { resource: Resource.OFFER, action: Action.READ },
    { resource: Resource.REVIEW, action: Action.CREATE },
    { resource: Resource.REVIEW, action: Action.UPDATE },
    { resource: Resource.NOTIFICATION, action: Action.READ },
  ],
};
