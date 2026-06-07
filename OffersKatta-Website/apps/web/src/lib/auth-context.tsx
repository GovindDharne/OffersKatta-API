'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost, tokenStore } from './api';

export type UserRole = 'SUPER_ADMIN' | 'SELLER_OWNER' | 'BUSINESS_MANAGER' | 'STAFF' | 'CUSTOMER';

export interface AuthUser {
  id: string;
  email: string | null;
  fullName: string | null;
  role: UserRole;
  /// True once the customer has entered the OTP we texted them. Sellers/admins
  /// don't have a phoneVerified concept — the field is undefined for them.
  phoneVerified?: boolean;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: { email: string; password: string; fullName: string; role?: 'CUSTOMER' | 'SELLER_OWNER' }) => Promise<AuthUser>;
  /// Customer-specific signup with mandatory phone. Returns { user, otpSent }
  /// so the caller can prompt for the OTP code right after.
  registerCustomer: (input: {
    email: string; password: string; fullName: string; phone: string;
    latitude?: number; longitude?: number;
  }) => Promise<{ user: AuthUser; otpSent: boolean }>;
  registerSeller: (input: {
    email: string; password: string; fullName: string; phone?: string;
  }) => Promise<AuthUser>;
  /// Submit the OTP that was sent during registerCustomer.
  verifyPhone: (otp: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = tokenStore.user<AuthUser>();
    if (stored) setUser(stored);
    setReady(true);
  }, []);

  const persist = useCallback((bundle: AuthTokens) => {
    tokenStore.set(bundle.accessToken, bundle.refreshToken, bundle.user);
    setUser(bundle.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiPost<AuthTokens>('/auth/login', { email, password });
      persist(data);
      return data.user;
    },
    [persist],
  );

  const register = useCallback(
    async (input: { email: string; password: string; fullName: string; role?: 'CUSTOMER' | 'SELLER_OWNER' }) => {
      const data = await apiPost<AuthTokens>('/auth/register', input);
      persist(data);
      return data.user;
    },
    [persist],
  );

  const registerCustomer = useCallback(
    async (input: { email: string; password: string; fullName: string; phone: string; latitude?: number; longitude?: number }) => {
      const data = await apiPost<AuthTokens & { otpSent: boolean }>('/auth/register/customer', input);
      persist(data);
      return { user: data.user, otpSent: data.otpSent };
    },
    [persist],
  );

  const registerSeller = useCallback(
    async (input: { email: string; password: string; fullName: string; phone?: string }) => {
      const data = await apiPost<AuthTokens>('/auth/register/seller', input);
      persist(data);
      return data.user;
    },
    [persist],
  );

  const verifyPhone = useCallback(
    async (otp: string) => {
      await apiPost<{ phoneVerified: true }>('/auth/customer/verify-phone', { otp });
      // Update local user cache so UI stops nagging.
      if (user) {
        const next = { ...user, phoneVerified: true };
        tokenStore.setUser(next);
        setUser(next);
      }
    },
    [user],
  );

  const logout = useCallback(async () => {
    try {
      await apiPost('/auth/logout', { refreshToken: tokenStore.getRefresh() });
    } catch {
      // Ignore — we're clearing state regardless.
    }
    tokenStore.clear();
    setUser(null);
    router.push('/login');
  }, [router]);

  const refresh = useCallback(() => {
    const stored = tokenStore.user<AuthUser>();
    setUser(stored);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user, ready, isAuthenticated: Boolean(user),
      login, register, registerCustomer, registerSeller, verifyPhone, logout, refresh,
    }),
    [user, ready, login, register, registerCustomer, registerSeller, verifyPhone, logout, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
