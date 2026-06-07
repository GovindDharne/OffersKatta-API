'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, XCircle } from 'lucide-react';
import { apiGet, apiGetPaginated, apiPatch } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Brand {
  id: string;
  name: string;
  businessType: string;
  status: string;
  isVerified: boolean;
  owner?: { id: string; email: string | null; fullName: string | null };
}

export default function AdminBrandsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'all'>('pending');

  const allQ = useQuery({
    queryKey: ['admin', 'brands', 'all'],
    queryFn: () => apiGetPaginated<Brand>('/brands', { limit: 100 }),
    enabled: tab === 'all',
  });
  const pendingQ = useQuery({
    queryKey: ['admin', 'brands', 'pending'],
    queryFn: () => apiGet<Brand[]>('/admin/brands/pending'),
    enabled: tab === 'pending',
  });

  const verify = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'SUSPENDED' | 'REJECTED' }) =>
      apiPatch(`/brands/${id}/verify`, { status }),
    onSuccess: () => {
      toast.success('Brand updated');
      qc.invalidateQueries({ queryKey: ['admin', 'brands'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Brands</h1>
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'pending' | 'all')}>
        <TabsList>
          <TabsTrigger value="pending">Pending verification</TabsTrigger>
          <TabsTrigger value="all">All brands</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3">
          {pendingQ.isLoading ? (
            <Skeleton className="h-24" />
          ) : pendingQ.data && pendingQ.data.length > 0 ? (
            pendingQ.data.map((b) => (
              <Card key={b.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    {b.name}
                    <Badge variant="secondary">{b.businessType.replace('_', ' ').toLowerCase()}</Badge>
                  </CardTitle>
                  <CardDescription>{b.owner?.fullName} · {b.owner?.email}</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button size="sm" onClick={() => verify.mutate({ id: b.id, status: 'ACTIVE' })}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => verify.mutate({ id: b.id, status: 'REJECTED' })}>
                    <XCircle className="mr-2 h-4 w-4" /> Reject
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nothing pending. 🎉</p>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-3">
          {allQ.isLoading ? (
            <Skeleton className="h-32" />
          ) : (
            allQ.data?.data.map((b) => (
              <Card key={b.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{b.businessType.replace('_', ' ').toLowerCase()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={b.status === 'ACTIVE' ? 'success' : 'secondary'}>{b.status.replace('_', ' ')}</Badge>
                    {b.status === 'ACTIVE' ? (
                      <Button size="sm" variant="outline" onClick={() => verify.mutate({ id: b.id, status: 'SUSPENDED' })}>Suspend</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => verify.mutate({ id: b.id, status: 'ACTIVE' })}>Re-activate</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
