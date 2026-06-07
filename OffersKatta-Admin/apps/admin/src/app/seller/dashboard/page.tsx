'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, Tag, Users } from 'lucide-react';
import { apiGetPaginated } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface BrandRow {
  id: string;
  name: string;
  slug: string;
  businessType: string;
  status: string;
  _count?: { branches: number };
}

export default function SellerDashboardPage() {
  const brandsQ = useQuery({
    queryKey: ['brands', 'mine'],
    queryFn: () => apiGetPaginated<BrandRow>('/brands/mine', { limit: 20 }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Seller dashboard</h1>
        <p className="text-sm text-muted-foreground">Manage your brands, branches, offers, and team.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard icon={Building2} label="Brands" value={brandsQ.data?.meta.total ?? 0} loading={brandsQ.isLoading} />
        <SummaryCard
          icon={Tag}
          label="Branches"
          value={brandsQ.data?.data.reduce((a, b) => a + (b._count?.branches ?? 0), 0) ?? 0}
          loading={brandsQ.isLoading}
        />
        <SummaryCard icon={Users} label="Active plan" value="Premium" loading={false} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Your brands</CardTitle>
            <CardDescription>Manage branding, branches, and subscriptions per brand.</CardDescription>
          </div>
          <Button asChild>
            <Link href="/seller/brands">Manage <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {brandsQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : brandsQ.data && brandsQ.data.data.length > 0 ? (
            <ul className="divide-y">
              {brandsQ.data.data.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-3">
                  <div>
                    <Link href={`/seller/brands/${b.id}`} className="font-medium hover:underline">{b.name}</Link>
                    <p className="text-xs text-muted-foreground">{b.businessType.toLowerCase()} · {b._count?.branches ?? 0} branches</p>
                  </div>
                  <Badge variant={b.status === 'ACTIVE' ? 'success' : 'secondary'}>{b.status.replace('_', ' ')}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No brands yet. Create your first one to start publishing offers.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, loading }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-7 w-20" /> : <div className="text-3xl font-bold">{value}</div>}
      </CardContent>
    </Card>
  );
}
