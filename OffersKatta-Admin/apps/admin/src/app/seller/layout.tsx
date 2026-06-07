import type { ReactNode } from 'react';
import { Protected } from '@/components/protected';
import { DashboardShell } from '@/components/dashboard-shell';

export default function SellerLayout({ children }: { children: ReactNode }) {
  return (
    <Protected roles={['SELLER_OWNER', 'BUSINESS_MANAGER', 'STAFF', 'SUPER_ADMIN']}>
      <DashboardShell area="seller">{children}</DashboardShell>
    </Protected>
  );
}
