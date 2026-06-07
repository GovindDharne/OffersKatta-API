'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

// Root of the management panel — route the user to the right place.
export default function PanelHome() {
  const router = useRouter();
  const { user, ready, logout } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace('/login');
    } else if (user.role === 'SUPER_ADMIN') {
      router.replace('/admin/dashboard');
    } else if (
      user.role === 'SELLER_OWNER' ||
      user.role === 'BUSINESS_MANAGER' ||
      user.role === 'STAFF'
    ) {
      router.replace('/seller/dashboard');
    }
  }, [ready, user, router]);

  if (ready && user && user.role === 'CUSTOMER') {
    return (
      <div className="container mx-auto flex flex-col items-center gap-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Management panel</h1>
        <p className="max-w-md text-muted-foreground">
          This panel is for businesses. Your account is a customer account — browse offers on the
          main OffersKatta site instead.
        </p>
        <Button variant="outline" onClick={() => logout()}>Log out</Button>
      </div>
    );
  }

  return <div className="container mx-auto py-24 text-center text-muted-foreground">Loading…</div>;
}
