export const API_PREFIX = '/api';
export const API_VERSION = 'v1';

export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  DEFAULT_PAGE: 1,
} as const;

export const NEARBY_OFFER_DEFAULT_RADIUS_KM = 10;
export const NEARBY_OFFER_MAX_RADIUS_KM = 100;

export const JWT = {
  ACCESS_TOKEN_TTL: '15m',
  REFRESH_TOKEN_TTL: '30d',
  RESET_TOKEN_TTL: '1h',
  VERIFY_TOKEN_TTL: '24h',
  INVITE_TOKEN_TTL: '7d',
} as const;

export const RATE_LIMIT = {
  AUTH: { ttl: 60, limit: 10 },
  PUBLIC: { ttl: 60, limit: 100 },
  AUTHENTICATED: { ttl: 60, limit: 300 },
} as const;

export const CACHE_TTL = {
  SHORT: 60,
  MEDIUM: 5 * 60,
  LONG: 60 * 60,
  DAY: 24 * 60 * 60,
} as const;

export const CACHE_KEYS = {
  USER: (id: string) => `user:${id}`,
  BRAND: (id: string) => `brand:${id}`,
  BRANCH: (id: string) => `branch:${id}`,
  OFFER: (id: string) => `offer:${id}`,
  CATEGORY_LIST: 'category:list',
  NEARBY_OFFERS: (lat: number, lng: number, radius: number) =>
    `nearby:${lat.toFixed(3)}:${lng.toFixed(3)}:${radius}`,
} as const;

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  SELLER_OWNER: 'SELLER_OWNER',
  BUSINESS_MANAGER: 'BUSINESS_MANAGER',
  STAFF: 'STAFF',
  CUSTOMER: 'CUSTOMER',
} as const;
