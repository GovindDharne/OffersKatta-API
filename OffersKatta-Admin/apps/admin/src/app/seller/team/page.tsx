'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Mail, UserPlus } from 'lucide-react';
import { apiGet, apiGetPaginated, apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Brand { id: string; name: string }
interface Branch { id: string; name: string; brandId: string }
interface Invitation { id: string; email: string; role: string; status: string; createdAt: string; expiresAt: string }

const schema = z.object({
  brandId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  email: z.string().email(),
  role: z.enum(['BUSINESS_MANAGER', 'STAFF']),
});
type FormValues = z.infer<typeof schema>;

export default function TeamPage() {
  const qc = useQueryClient();
  const brandsQ = useQuery({ queryKey: ['brands', 'mine'], queryFn: () => apiGetPaginated<Brand>('/brands/mine', { limit: 50 }) });
  const [selectedBrand, setSelectedBrand] = useState<string>('');

  const branchesQ = useQuery({
    queryKey: ['branches', selectedBrand],
    queryFn: () => apiGetPaginated<Branch>('/branches', { brandId: selectedBrand, limit: 50 }),
    enabled: Boolean(selectedBrand),
  });

  const invitesQ = useQuery({
    queryKey: ['invitations', selectedBrand],
    queryFn: () => apiGet<Invitation[]>(`/team/invitations?brandId=${selectedBrand}`),
    enabled: Boolean(selectedBrand),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { brandId: '', email: '', role: 'BUSINESS_MANAGER' },
  });

  const invite = useMutation({
    mutationFn: (v: FormValues) => apiPost('/team/invitations', v),
    onSuccess: () => {
      toast.success('Invitation sent (check MailHog at :8025)');
      form.reset({ brandId: selectedBrand, email: '', role: 'BUSINESS_MANAGER' });
      qc.invalidateQueries({ queryKey: ['invitations'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Team & invitations</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pick a brand</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedBrand} onValueChange={(v) => { setSelectedBrand(v); form.setValue('brandId', v); }}>
            <SelectTrigger className="max-w-sm"><SelectValue placeholder="Select brand" /></SelectTrigger>
            <SelectContent>
              {brandsQ.data?.data.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedBrand ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4" /> Invite a member</CardTitle>
              <CardDescription>Managers are scoped to a single branch. Staff inherit branch redemption access.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit((v) => invite.mutate(v))} className="grid gap-3 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" {...form.register('email')} />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={form.watch('role')} onValueChange={(v) => form.setValue('role', v as 'BUSINESS_MANAGER' | 'STAFF')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUSINESS_MANAGER">Business manager</SelectItem>
                      <SelectItem value="STAFF">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <Select value={form.watch('branchId') ?? ''} onValueChange={(v) => form.setValue('branchId', v)}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      {branchesQ.data?.data.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={invite.isPending} className="self-end">Send invite</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sent invitations</CardTitle>
            </CardHeader>
            <CardContent>
              {invitesQ.isLoading ? (
                <Skeleton className="h-20" />
              ) : invitesQ.data && invitesQ.data.length > 0 ? (
                <ul className="divide-y">
                  {invitesQ.data.map((i) => (
                    <li key={i.id} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <p className="flex items-center gap-2 font-medium">
                          <Mail className="h-3 w-3 text-muted-foreground" /> {i.email}
                        </p>
                        <p className="text-xs text-muted-foreground">{i.role.replace('_', ' ').toLowerCase()}</p>
                      </div>
                      <Badge variant={i.status === 'PENDING' ? 'secondary' : i.status === 'ACCEPTED' ? 'success' : 'outline'}>
                        {i.status.toLowerCase()}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No invitations sent yet.</p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
