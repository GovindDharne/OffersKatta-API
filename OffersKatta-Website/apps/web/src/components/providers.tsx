'use client';

import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/lib/query-client';
import { AuthProvider } from '@/lib/auth-context';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryProvider>
        <AuthProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
