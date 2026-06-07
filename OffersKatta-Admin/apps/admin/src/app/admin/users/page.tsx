'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { apiGetPaginated, apiPatch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface User {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const ROLES = ['', 'SUPER_ADMIN', 'SELLER_OWNER', 'BUSINESS_MANAGER', 'STAFF', 'CUSTOMER'];

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);

  const q = useQuery({
    queryKey: ['admin', 'users', search, role, page],
    queryFn: () => apiGetPaginated<User>('/users', {
      search: search || undefined,
      role: role || undefined,
      page,
      limit: 25,
    }),
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiPatch(`/users/${id}/active`, { isActive }),
    onSuccess: () => { toast.success('User updated'); qc.invalidateQueries({ queryKey: ['admin', 'users'] }); },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Users</h1>

      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search email, name, phone..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={role || 'ALL'} onValueChange={(v) => { setRole(v === 'ALL' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-56"><SelectValue placeholder="All roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All roles</SelectItem>
            {ROLES.filter(Boolean).map((r) => <SelectItem key={r} value={r}>{r.replace('_', ' ').toLowerCase()}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {q.isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {q.data?.data.map((u) => (
                <li key={u.id} className="flex items-center justify-between p-4 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.fullName ?? u.email ?? u.phone}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.email ?? u.phone ?? '—'}</p>
                  </div>
                  <Badge variant="outline" className="mx-3">{u.role.replace('_', ' ').toLowerCase()}</Badge>
                  <Button
                    size="sm"
                    variant={u.isActive ? 'outline' : 'default'}
                    onClick={() => toggle.mutate({ id: u.id, isActive: !u.isActive })}
                  >
                    {u.isActive ? 'Disable' : 'Enable'}
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {q.data && q.data.meta.totalPages > 1 ? (
        <div className="flex justify-center gap-2 pt-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="px-3 py-1 text-sm text-muted-foreground">Page {page} of {q.data.meta.totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= q.data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      ) : null}
    </div>
  );
}
