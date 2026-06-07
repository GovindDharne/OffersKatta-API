'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, ReceiptText, Tag, Users } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';

interface Dashboard {
  users: { total: number; sellers: number; customers: number };
  brands: { total: number; pendingVerification: number };
  branches: number;
  offers: { total: number; published: number };
  redemptionsLast30Days: number;
  revenueLast30Days: number;
  subscriptions: Record<string, number>;
}

export default function AdminDashboardPage() {
  const q = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => apiGet<Dashboard>('/admin/dashboard') });

  if (q.isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }
  if (!q.data) return <p className="text-muted-foreground">Could not load metrics.</p>;
  const d = q.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total users" value={d.users.total} icon={Users} sub={`${d.users.sellers} sellers · ${d.users.customers} customers`} />
        <Stat label="Brands" value={d.brands.total} icon={Building2} sub={`${d.brands.pendingVerification} awaiting verification`} />
        <Stat label="Offers" value={d.offers.total} icon={Tag} sub={`${d.offers.published} published`} />
        <Stat
          label="Revenue (30d)"
          value={formatCurrency(d.revenueLast30Days, 'INR')}
          icon={ReceiptText}
          sub={`${d.redemptionsLast30Days} redemptions`}
        />
      </div>

      <Card>
        <CardHeader><CardTitle>Subscriptions</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(d.subscriptions).map(([plan, count]) => (
              <div key={plan} className="rounded-lg border p-4">
                <p className="text-xs uppercase text-muted-foreground">{plan}</p>
                <p className="text-2xl font-bold">{count}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, icon: Icon, sub }: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }>; sub?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}
