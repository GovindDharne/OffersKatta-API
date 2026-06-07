import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

const STORAGE_KEYS = {
  access: 'offerhub_access',
  refresh: 'offerhub_refresh',
  user: 'offerhub_user',
} as const;

const baseURL =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window === 'undefined' ? 'http://api:4000/api' : '/api');

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
  meta?: Record<string, unknown>;
}

export const tokenStore = {
  getAccess(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(STORAGE_KEYS.access);
  },
  getRefresh(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(STORAGE_KEYS.refresh);
  },
  set(access: string, refresh: string, user?: unknown): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.access, access);
    window.localStorage.setItem(STORAGE_KEYS.refresh, refresh);
    if (user) window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  },
  clear(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(STORAGE_KEYS.access);
    window.localStorage.removeItem(STORAGE_KEYS.refresh);
    window.localStorage.removeItem(STORAGE_KEYS.user);
  },
  user<T = unknown>(): T | null {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(STORAGE_KEYS.user);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  /// Update just the cached user (e.g. after verifying phone) without
  /// rotating the tokens.
  setUser(user: unknown): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  },
};

export const api: AxiosInstance = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  const token = tokenStore.getAccess();
  if (token && cfg.headers) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return null;
  try {
    const res = await axios.post<ApiEnvelope<{ accessToken: string; refreshToken: string; user: unknown }>>(
      `${baseURL}/auth/refresh`,
      { refreshToken: refresh },
      { headers: { 'Content-Type': 'application/json' } },
    );
    const data = res.data?.data;
    if (!data) return null;
    tokenStore.set(data.accessToken, data.refreshToken, data.user);
    return data.accessToken;
  } catch {
    tokenStore.clear();
    return null;
  }
}

// Turns an axios failure into a plain Error carrying the API's own message
// (the { error: { message } } envelope), so callers surface something readable
// instead of "Request failed with status code 400".
function toApiError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const raw = (error.response?.data as { error?: { message?: unknown } } | undefined)?.error?.message;
    const msg = Array.isArray(raw)
      ? raw.join(', ')
      : typeof raw === 'string' && raw
        ? raw
        : error.message || 'Request failed';
    return new Error(msg);
  }
  return error instanceof Error ? error : new Error('Request failed');
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      if (!refreshPromise) refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers.set('Authorization', `Bearer ${newToken}`);
        return api.request(original);
      }
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      }
    }
    return Promise.reject(toApiError(error));
  },
);

export async function apiGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const res = await api.get<ApiEnvelope<T>>(path, { params });
  if (!res.data.success) throw new Error(res.data.error?.message ?? 'Request failed');
  return res.data.data as T;
}

export async function apiPost<T, B = unknown>(path: string, body?: B): Promise<T> {
  const res = await api.post<ApiEnvelope<T>>(path, body);
  if (!res.data.success) throw new Error(res.data.error?.message ?? 'Request failed');
  return res.data.data as T;
}

export async function apiPatch<T, B = unknown>(path: string, body?: B): Promise<T> {
  const res = await api.patch<ApiEnvelope<T>>(path, body);
  if (!res.data.success) throw new Error(res.data.error?.message ?? 'Request failed');
  return res.data.data as T;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await api.delete<ApiEnvelope<T>>(path);
  if (!res.data.success) throw new Error(res.data.error?.message ?? 'Request failed');
  return res.data.data as T;
}

export async function apiGetPaginated<T>(path: string, params?: Record<string, unknown>): Promise<{
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
}> {
  const res = await api.get<ApiEnvelope<T[]>>(path, { params });
  if (!res.data.success) throw new Error(res.data.error?.message ?? 'Request failed');
  return {
    data: res.data.data ?? [],
    meta: (res.data.meta ?? { page: 1, limit: 20, total: 0, totalPages: 1, hasNext: false, hasPrev: false }) as {
      page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean;
    },
  };
}
