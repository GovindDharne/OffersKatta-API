import type { ReactNode } from 'react';
import { Protected } from '@/components/protected';
import { DashboardShell } from '@/components/dashboard-shell';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Protected roles={['SUPER_ADMIN']}>
      <DashboardShell area="admin">{children}</DashboardShell>
    </Protected>
  );
}
