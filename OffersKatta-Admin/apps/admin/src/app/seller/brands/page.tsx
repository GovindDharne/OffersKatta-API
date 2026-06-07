'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { apiGetPaginated, apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const BUSINESS_TYPES = [
  'SHOP', 'RESTAURANT', 'HOTEL', 'SALON', 'GYM', 'SERVICE_PROVIDER', 'LOCAL_BUSINESS', 'OTHER',
] as const;

const createSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  businessType: z.enum(BUSINESS_TYPES),
  websiteUrl: z.string().url().optional().or(z.literal('')),
});
type CreateValues = z.infer<typeof createSchema>;

interface BrandRow {
  id: string;
  name: string;
  slug: string;
  businessType: string;
  status: string;
  _count?: { branches: number };
}

export default function SellerBrandsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ['brands', 'mine'],
    queryFn: () => apiGetPaginated<BrandRow>('/brands/mine', { limit: 50 }),
  });

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', description: '', businessType: 'SHOP', websiteUrl: '' },
  });

  const create = useMutation({
    mutationFn: (values: CreateValues) =>
      apiPost('/brands', { ...values, websiteUrl: values.websiteUrl || undefined }),
    onSuccess: () => {
      toast.success('Brand created');
      setOpen(false);
      form.reset();
      qc.invalidateQueries({ queryKey: ['brands'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your brands</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New brand</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create brand</DialogTitle>
              <DialogDescription>
                You can add multiple branches under this brand later.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...form.register('name')} />
                {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Business type</Label>
                <Select
                  value={form.watch('businessType')}
                  onValueChange={(v) => form.setValue('businessType', v as CreateValues['businessType'])}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t.replace('_', ' ').toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={3} {...form.register('description')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="websiteUrl">Website (optional)</Label>
                <Input id="websiteUrl" type="url" {...form.register('websiteUrl')} placeholder="https://" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={create.isPending}>Create</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {q.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : q.data && q.data.data.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data.data.map((b) => (
            <Card key={b.id} className="transition-shadow hover:shadow-md">
              <Link href={`/seller/brands/${b.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{b.name}</CardTitle>
                    <Badge variant={b.status === 'ACTIVE' ? 'success' : 'secondary'}>{b.status.replace('_', ' ')}</Badge>
                  </div>
                  <CardDescription className="capitalize">{b.businessType.replace('_', ' ').toLowerCase()}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{b._count?.branches ?? 0} branches</p>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No brands yet</CardTitle>
            <CardDescription>Create your first brand to start publishing offers.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
