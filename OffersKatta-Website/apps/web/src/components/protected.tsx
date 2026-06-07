'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, type UserRole } from '@/lib/auth-context';
import { Skeleton } from '@/components/ui/skeleton';

interface ProtectedProps {
  children: ReactNode;
  roles?: UserRole[];
}

export function Protected({ children, roles }: ProtectedProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (roles && !roles.includes(user.role)) {
      router.replace('/');
    }
  }, [ready, user, roles, router, pathname]);

  if (!ready || !user || (roles && !roles.includes(user.role))) {
    return (
      <div className="container mx-auto space-y-3 py-16">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  return <>{children}</>;
}
