'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';

import { apiDelete, apiGetPaginated, apiPatch, apiPost } from '@/lib/api';

// Leaflet touches `window` at import time, so we load the picker only on the
// client. Mirrors the dynamic import the seller branch form uses.
const MapPicker = dynamic(() => import('@/components/map-picker'), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 items-center justify-center rounded-md border text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { CitySelect } from '@/components/city-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Mall {
  id: string;
  name: string;
  description?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  phone?: string | null;
  websiteUrl?: string | null;
  _count?: { branches: number };
}

const schema = z.object({
  name: z.string().min(2, 'At least 2 characters'),
  description: z.string().optional(),
  addressLine1: z.string().min(2, 'Required'),
  city: z.string().min(1, 'Required'),
  state: z.string().min(1, 'Required'),
  country: z.string().min(1, 'Required'),
  postalCode: z.string().min(1, 'Required'),
  latitude: z.number({ invalid_type_error: 'Enter a number' }).min(-90).max(90),
  longitude: z.number({ invalid_type_error: 'Enter a number' }).min(-180).max(180),
  phone: z.string().optional(),
  websiteUrl: z.string().url().optional().or(z.literal('')),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  name: '',
  description: '',
  addressLine1: '',
  city: '',
  state: '',
  country: 'India',
  postalCode: '',
  latitude: undefined as unknown as number,
  longitude: undefined as unknown as number,
  phone: '',
  websiteUrl: '',
};

export default function AdminMallsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Mall | null>(null);
  const isEditing = editing !== null;

  const mallsQ = useQuery({
    queryKey: ['malls'],
    queryFn: () => apiGetPaginated<Mall>('/malls', { limit: 100 }),
  });

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const errors = form.formState.errors;

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        name: editing.name,
        description: editing.description ?? '',
        addressLine1: editing.addressLine1,
        city: editing.city,
        state: editing.state,
        country: editing.country,
        postalCode: editing.postalCode,
        latitude: editing.latitude,
        longitude: editing.longitude,
        phone: editing.phone ?? '',
        websiteUrl: editing.websiteUrl ?? '',
      });
    } else {
      form.reset(EMPTY);
    }
  }, [open, editing, form]);

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
  };

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (mall: Mall) => {
    setEditing(mall);
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      apiPost('/malls', {
        ...v,
        phone: v.phone || undefined,
        websiteUrl: v.websiteUrl || undefined,
        description: v.description || undefined,
      }),
    onSuccess: () => {
      toast.success('Mall added — sellers can now place branches inside it');
      closeDialog();
      qc.invalidateQueries({ queryKey: ['malls'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: (v: FormValues) =>
      apiPatch(`/malls/${editing!.id}`, {
        ...v,
        phone: v.phone || null,
        websiteUrl: v.websiteUrl || null,
        description: v.description || null,
      }),
    onSuccess: () => {
      toast.success('Mall updated');
      closeDialog();
      qc.invalidateQueries({ queryKey: ['malls'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/malls/${id}`),
    onSuccess: () => {
      toast.success('Mall removed');
      qc.invalidateQueries({ queryKey: ['malls'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const handleDelete = (mall: Mall) => {
    const branches = mall._count?.branches ?? 0;
    const warn = branches > 0
      ? `${mall.name} has ${branches} branch${branches === 1 ? '' : 'es'} linked. They will keep their data but the mall reference will be hidden. Continue?`
      : `Delete ${mall.name}?`;
    if (window.confirm(warn)) remove.mutate(mall.id);
  };

  const submitting = create.isPending || update.isPending;
  const onSubmit = form.handleSubmit((v) => (isEditing ? update.mutate(v) : create.mutate(v)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Malls</h1>
          <p className="text-sm text-muted-foreground">
            Master list of malls. Sellers pick from this list when placing a branch inside a mall.
          </p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add mall</Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? `Edit ${editing!.name}` : 'New mall'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update the mall details. Linked branches will see the new values immediately.'
                : 'Add an entry once; every seller can then list branches inside.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex max-h-[calc(90vh-8rem)] flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              <Field label="Name" register={form.register('name')} err={errors.name?.message} />
              <div className="space-y-1">
                <Label>Description (optional)</Label>
                <Textarea rows={2} {...form.register('description')} />
              </div>
              <Field label="Address line 1" register={form.register('addressLine1')} err={errors.addressLine1?.message} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>City</Label>
                  <CitySelect
                    value={form.watch('city')}
                    onChange={(v) => form.setValue('city', v, { shouldDirty: true, shouldValidate: true })}
                  />
                  {errors.city?.message ? <p className="text-xs text-destructive">{errors.city.message}</p> : null}
                </div>
                <Field label="State" register={form.register('state')} err={errors.state?.message} />
                <Field label="Country" register={form.register('country')} err={errors.country?.message} />
                <Field label="Postal code" register={form.register('postalCode')} err={errors.postalCode?.message} />
                <Field
                  label="Latitude"
                  type="number" step="any" inputMode="decimal"
                  register={form.register('latitude', { valueAsNumber: true })}
                  err={errors.latitude?.message}
                  placeholder="19.0859"
                />
                <Field
                  label="Longitude"
                  type="number" step="any" inputMode="decimal"
                  register={form.register('longitude', { valueAsNumber: true })}
                  err={errors.longitude?.message}
                  placeholder="72.8893"
                />
                <Field label="Phone (optional)" register={form.register('phone')} />
                <Field label="Website (optional)" type="url" register={form.register('websiteUrl')} placeholder="https://" />
              </div>

              {/* Map picker — drop a pin or use the device location to fill the
                  numeric fields above. Mirrors the branch form so admins get
                  the same UX everywhere coordinates are captured. */}
              <div className="space-y-1">
                <Label>Location on map</Label>
                <MapPicker
                  heightClassName="h-56"
                  value={
                    Number.isFinite(form.watch('latitude')) && Number.isFinite(form.watch('longitude'))
                      ? { latitude: form.watch('latitude'), longitude: form.watch('longitude') }
                      : null
                  }
                  onChange={({ latitude, longitude }) => {
                    form.setValue('latitude', latitude, { shouldValidate: true, shouldDirty: true });
                    form.setValue('longitude', longitude, { shouldValidate: true, shouldDirty: true });
                  }}
                />
                {(errors.latitude || errors.longitude) ? (
                  <p className="text-xs text-destructive">
                    {errors.latitude?.message ?? errors.longitude?.message ?? 'Pick a location on the map.'}
                  </p>
                ) : null}
              </div>
            </div>
            <DialogFooter className="mt-3 shrink-0 border-t pt-3">
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (isEditing ? 'Saving…' : 'Creating…') : isEditing ? 'Save changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {mallsQ.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : mallsQ.data && mallsQ.data.data.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {mallsQ.data.data.map((m) => (
            <Card key={m.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{m.name}</CardTitle>
                <CardDescription className="flex items-start gap-1">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                  {m.addressLine1}, {m.city}, {m.state} {m.postalCode}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 text-xs text-muted-foreground">
                {m._count?.branches ?? 0} branch{(m._count?.branches ?? 0) === 1 ? '' : 'es'} listed
              </CardContent>
              <CardFooter className="flex justify-end gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(m)}>
                  <Pencil className="mr-1 h-3 w-3" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(m)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="mr-1 h-3 w-3" /> Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No malls yet</CardTitle>
            <CardDescription>Add your first mall above so branches can be placed inside.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  err,
  register,
  type = 'text',
  ...rest
}: {
  label: string;
  err?: string;
  register: UseFormRegisterReturn;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name' | 'ref' | 'onChange' | 'onBlur'>) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} {...rest} {...register} />
      {err ? <p className="text-xs text-destructive">{err}</p> : null}
    </div>
  );
}
