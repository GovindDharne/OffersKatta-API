'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, MapPin, Pencil, Trash2, Search, Upload, Loader2 } from 'lucide-react';

// Leaflet pulls in `window` at import time; load the picker only in the browser.
const MapPicker = dynamic(() => import('@/components/map-picker'), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center rounded-md border text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});
import { api, apiGet, apiGetPaginated, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TerritoriesCard, type Zone } from '@/components/territories-card';
import { PlacesAutocomplete } from '@/components/places-autocomplete';
import { CitySelect } from '@/components/city-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Brand {
  id: string;
  name: string;
  description: string | null;
  businessType: string;
  status: string;
  websiteUrl: string | null;
  isVerified: boolean;
}

interface Branch {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  email: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'TEMPORARILY_CLOSED' | 'PERMANENTLY_CLOSED';
  mallId?: string | null;
  shopNumber?: string | null;
  mall?: { id: string; name: string; slug: string } | null;
  // Optional territory assignment (Phase 6 — Region/Zone hierarchy)
  zoneId?: string | null;
}

interface MallOption { id: string; name: string; city: string }

const BRANCH_STATUSES: Branch['status'][] = [
  'ACTIVE',
  'INACTIVE',
  'TEMPORARILY_CLOSED',
  'PERMANENTLY_CLOSED',
];

const branchSchema = z.object({
  name: z.string().min(2, 'At least 2 characters'),
  addressLine1: z.string().min(2, 'Required'),
  city: z.string().min(1, 'Required'),
  state: z.string().min(1, 'Required'),
  country: z.string().min(1, 'Required'),
  postalCode: z.string().min(1, 'Required'),
  latitude: z.number({ invalid_type_error: 'Enter a number' }).min(-90).max(90),
  longitude: z.number({ invalid_type_error: 'Enter a number' }).min(-180).max(180),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE', 'TEMPORARILY_CLOSED', 'PERMANENTLY_CLOSED']).optional(),
  // Mall placement (optional)
  insideMall: z.boolean().default(false),
  mallId: z.string().uuid().optional().nullable(),
  shopNumber: z.string().max(60).optional(),
  // Territory assignment (optional)
  zoneId: z.string().uuid().optional().nullable(),
});
type BranchValues = z.infer<typeof branchSchema>;

const emptyDefaults: BranchValues = {
  name: '',
  addressLine1: '',
  city: '',
  state: '',
  country: 'India',
  postalCode: '',
  latitude: undefined as unknown as number,
  longitude: undefined as unknown as number,
  phone: '',
  email: '',
  status: 'ACTIVE',
  insideMall: false,
  mallId: null,
  shopNumber: '',
  zoneId: null,
};

export default function BrandDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  // Branch list search (Phase 2 — makes the page usable for 500+ branch chains).
  const [branchSearch, setBranchSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(branchSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [branchSearch]);

  const brandQ = useQuery({ queryKey: ['brand', id], queryFn: () => apiGet<Brand>(`/brands/${id}`) });
  const branchesQ = useQuery({
    queryKey: ['branches', id, debouncedSearch],
    queryFn: () => apiGetPaginated<Branch>('/branches', {
      brandId: id,
      limit: debouncedSearch ? 100 : 50,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }),
  });
  const mallsQ = useQuery({
    queryKey: ['malls'],
    queryFn: () => apiGetPaginated<MallOption>('/malls', { limit: 100 }),
  });
  // Zones for the in-dialog picker + branch card label. Keyed by brand so the
  // TerritoriesCard's invalidations (queryKey: ['zones', brandId]) refresh us.
  const zonesQ = useQuery({
    queryKey: ['zones', id],
    queryFn: () => apiGet<Zone[]>(`/brands/${id}/zones`),
  });
  const zoneById = new Map((zonesQ.data ?? []).map((z) => [z.id, z]));

  const form = useForm<BranchValues>({
    resolver: zodResolver(branchSchema),
    mode: 'onSubmit',
    defaultValues: emptyDefaults,
  });
  const errors = form.formState.errors;

  // Reset the form whenever we open the dialog in a new mode (create vs edit).
  useEffect(() => {
    if (!dialogOpen) return;
    if (editing) {
      form.reset({
        name: editing.name,
        addressLine1: editing.addressLine1,
        city: editing.city,
        state: editing.state,
        country: editing.country,
        postalCode: editing.postalCode,
        latitude: editing.latitude,
        longitude: editing.longitude,
        phone: editing.phone ?? '',
        email: editing.email ?? '',
        status: editing.status,
        insideMall: Boolean(editing.mallId),
        mallId: editing.mallId ?? null,
        shopNumber: editing.shopNumber ?? '',
        zoneId: editing.zoneId ?? null,
      });
    } else {
      form.reset(emptyDefaults);
    }
  }, [dialogOpen, editing, form]);

  const create = useMutation({
    mutationFn: (values: BranchValues) => {
      // Strip server-disallowed fields (status, insideMall toggle) and
      // null-out mall fields when the toggle is off so a flipped-off mall
      // assignment actually clears.
      const { status: _status, insideMall, mallId, shopNumber, zoneId, ...rest } = values;
      return apiPost('/branches', {
        ...rest,
        brandId: id,
        email: rest.email || undefined,
        phone: rest.phone || undefined,
        mallId: insideMall && mallId ? mallId : undefined,
        shopNumber: insideMall && shopNumber ? shopNumber : undefined,
        // Omit when null so we don't fail @IsUUID validation on create.
        zoneId: zoneId ?? undefined,
      });
    },
    onSuccess: () => {
      toast.success('Branch created');
      closeDialog();
      qc.invalidateQueries({ queryKey: ['branches', id] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: (values: BranchValues) => {
      const { insideMall, mallId, shopNumber, zoneId, ...rest } = values;
      return apiPatch(`/branches/${editing!.id}`, {
        ...rest,
        email: rest.email || undefined,
        phone: rest.phone || undefined,
        // Send null explicitly when the toggle is off so Prisma clears the link.
        mallId: insideMall && mallId ? mallId : null,
        // zoneId: explicit null clears the assignment; a UUID sets/changes it.
        // (Backend re-validates the zone belongs to this brand.)
        zoneId: zoneId ?? null,
      });
    },
    onSuccess: () => {
      toast.success('Branch updated');
      closeDialog();
      qc.invalidateQueries({ queryKey: ['branches', id] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (branchId: string) => apiDelete(`/branches/${branchId}`),
    onSuccess: () => {
      toast.success('Branch deleted');
      qc.invalidateQueries({ queryKey: ['branches', id] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(branch: Branch) {
    setEditing(branch);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
    form.reset(emptyDefaults);
  }

  function onSubmit(values: BranchValues) {
    if (editing) update.mutate(values);
    else create.mutate(values);
  }

  const submitting = create.isPending || update.isPending;
  const isEditing = editing !== null;

  return (
    <div className="space-y-6">
      {brandQ.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : brandQ.data ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{brandQ.data.name}</CardTitle>
              <Badge variant={brandQ.data.status === 'ACTIVE' ? 'success' : 'secondary'}>
                {brandQ.data.status.replace('_', ' ')}
              </Badge>
            </div>
            <CardDescription className="capitalize">
              {brandQ.data.businessType.replace('_', ' ').toLowerCase()}
              {brandQ.data.isVerified ? ' · verified' : ''}
            </CardDescription>
          </CardHeader>
          {brandQ.data.description ? (
            <CardContent className="text-sm text-muted-foreground">{brandQ.data.description}</CardContent>
          ) : null}
        </Card>
      ) : null}

      {/* Territory management (Regions / Zones). Sits above the branches list
          so a seller setting up a new brand naturally goes top-to-bottom:
          1) make brand, 2) carve regions/zones, 3) drop branches into zones. */}
      <TerritoriesCard brandId={id} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">
          Branches
          {branchesQ.data ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({branchesQ.data.meta.total})
            </span>
          ) : null}
        </h2>
        <div className="flex items-center gap-2">
          <BranchImportButton brandId={id} onImported={() => {
            qc.invalidateQueries({ queryKey: ['branches', id] });
          }} />
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add branch
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={branchSearch}
          onChange={(e) => setBranchSearch(e.target.value)}
          placeholder="Search by name, address, city, PIN, shop number…"
          className="pl-9"
        />
      </div>

      {branchesQ.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : branchesQ.data && branchesQ.data.data.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {branchesQ.data.data.map((b) => (
            <Card key={b.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{b.name}</CardTitle>
                  <Badge variant={b.status === 'ACTIVE' ? 'success' : 'secondary'}>
                    {b.status.replace(/_/g, ' ').toLowerCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {b.mall ? (
                  <p className="font-medium text-primary">
                    🏬 Inside {b.mall.name}
                    {b.shopNumber ? <span className="text-muted-foreground"> · Shop {b.shopNumber}</span> : null}
                  </p>
                ) : null}
                {b.zoneId && zoneById.has(b.zoneId) ? (
                  <p className="text-xs text-muted-foreground">
                    Territory:{' '}
                    <span className="font-medium text-foreground">
                      {zoneById.get(b.zoneId)?.region?.name ?? '—'} ·{' '}
                      {zoneById.get(b.zoneId)?.name}
                    </span>
                  </p>
                ) : null}
                <p className="flex items-start gap-1 text-muted-foreground">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{b.addressLine1}, {b.city}, {b.state} {b.postalCode}</span>
                </p>
                {b.phone ? <p className="text-muted-foreground">{b.phone}</p> : null}
                {b.email ? <p className="text-muted-foreground">{b.email}</p> : null}
              </CardContent>
              <CardFooter className="flex justify-end gap-2 pt-0">
                <Button size="sm" variant="outline" onClick={() => openEdit(b)}>
                  <Pencil className="mr-2 h-3 w-3" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (confirm(`Delete "${b.name}"? This cannot be undone.`)) {
                      remove.mutate(b.id);
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-3 w-3" /> Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No branches yet. Add one above.</p>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit branch' : 'New branch'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update branch details. Changes apply immediately.'
                : 'Locations show up in nearby & search results.'}
            </DialogDescription>
          </DialogHeader>

          {/*
            flex-col form with a fixed-height inner scroll body keeps the Cancel/Create buttons
            permanently visible regardless of viewport. sticky-positioned footers inside a
            flex-col-reverse parent (DialogFooter's default) are unreliable, so this is more robust.
          */}
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex max-h-[calc(90vh-8rem)] flex-col"
          >
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            <div className="space-y-1">
              <Label htmlFor="b-name">Name</Label>
              <Input id="b-name" autoComplete="off" {...form.register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            {/* Google Places autocomplete — renders nothing if the backend
                reports the integration is unconfigured, so manual entry stays
                the canonical flow until a key is provisioned. */}
            <PlacesAutocomplete
              onPick={(p) => {
                form.setValue('addressLine1', p.addressLine1, { shouldDirty: true, shouldValidate: true });
                form.setValue('city', p.city, { shouldDirty: true, shouldValidate: true });
                form.setValue('state', p.state, { shouldDirty: true, shouldValidate: true });
                form.setValue('country', p.country, { shouldDirty: true, shouldValidate: true });
                form.setValue('postalCode', p.postalCode, { shouldDirty: true, shouldValidate: true });
                form.setValue('latitude', p.latitude, { shouldDirty: true, shouldValidate: true });
                form.setValue('longitude', p.longitude, { shouldDirty: true, shouldValidate: true });
                // If the seller hadn't typed a name yet, use the formatted
                // address's first segment as a sensible default.
                if (!form.getValues('name')) {
                  const guess = p.formattedAddress.split(',')[0]?.trim();
                  if (guess) form.setValue('name', guess, { shouldDirty: true });
                }
              }}
            />

            <div className="space-y-1">
              <Label htmlFor="b-addr">Address line 1</Label>
              <Input id="b-addr" autoComplete="street-address" {...form.register('addressLine1')} />
              {errors.addressLine1 && <p className="text-xs text-destructive">{errors.addressLine1.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="b-city">City</Label>
                <CitySelect
                  id="b-city"
                  value={form.watch('city')}
                  onChange={(v) => form.setValue('city', v, { shouldDirty: true, shouldValidate: true })}
                />
                {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="b-state">State</Label>
                <Input id="b-state" autoComplete="address-level1" {...form.register('state')} />
                {errors.state && <p className="text-xs text-destructive">{errors.state.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="b-country">Country</Label>
                <Input id="b-country" autoComplete="country-name" {...form.register('country')} />
                {errors.country && <p className="text-xs text-destructive">{errors.country.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="b-postal">Postal code</Label>
                <Input id="b-postal" autoComplete="postal-code" {...form.register('postalCode')} />
                {errors.postalCode && <p className="text-xs text-destructive">{errors.postalCode.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="b-phone">Phone (optional)</Label>
                <Input id="b-phone" autoComplete="tel" {...form.register('phone')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="b-email">Email (optional)</Label>
                <Input id="b-email" type="email" autoComplete="email" {...form.register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              {/* ── Mall placement ────────────────────────────────────── */}
              <div className="col-span-2 space-y-2 border-t pt-3">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded"
                    checked={form.watch('insideMall') ?? false}
                    onChange={(e) =>
                      form.setValue('insideMall', e.target.checked, { shouldDirty: true })
                    }
                  />
                  <span>
                    <span className="text-sm font-medium">This branch is inside a mall</span>
                    <span className="block text-xs text-muted-foreground">
                      Shoppers can browse all offers within a mall on one screen.
                    </span>
                  </span>
                </label>

                {form.watch('insideMall') ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Mall</Label>
                      <Select
                        value={form.watch('mallId') ?? ''}
                        onValueChange={(v) => form.setValue('mallId', v, { shouldDirty: true })}
                      >
                        <SelectTrigger><SelectValue placeholder="Pick a mall" /></SelectTrigger>
                        <SelectContent>
                          {mallsQ.data?.data.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.name} — {m.city}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Don't see your mall? Ask an administrator to add it.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="b-shop" className="text-xs">Shop number</Label>
                      <Input
                        id="b-shop"
                        placeholder="F-23 / Ground Floor, Block C"
                        {...form.register('shopNumber')}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {/* ── Territory (zone) placement ────────────────────────── */}
              <div className="col-span-2 space-y-2 border-t pt-3">
                <Label className="text-sm font-medium">Territory (optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Assigning a zone lets you target offers at this whole territory
                  at once. Manage regions/zones in the card above.
                </p>
                {(zonesQ.data?.length ?? 0) === 0 ? (
                  <p className="text-xs italic text-muted-foreground">
                    No zones yet — create at least one above to enable this picker.
                  </p>
                ) : (
                  <Select
                    value={form.watch('zoneId') ?? '__none__'}
                    onValueChange={(v) =>
                      form.setValue('zoneId', v === '__none__' ? null : v, { shouldDirty: true })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Pick a zone" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Unassigned —</SelectItem>
                      {(zonesQ.data ?? []).map((z) => (
                        <SelectItem key={z.id} value={z.id}>
                          {z.region?.name ? `${z.region.name} · ` : ''}{z.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Map picker spans both columns. RHF still owns latitude/longitude
                  via setValue('shouldValidate') so submit gets real numbers. */}
              <div className="col-span-2 space-y-1">
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
              {isEditing ? (
                <div className="space-y-1 col-span-2">
                  <Label>Status</Label>
                  <Select
                    value={form.watch('status') ?? 'ACTIVE'}
                    onValueChange={(v) => form.setValue('status', v as Branch['status'])}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BRANCH_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.replace(/_/g, ' ').toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
            </div>

            <DialogFooter className="mt-3 shrink-0 border-t pt-3">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (isEditing ? 'Saving…' : 'Creating…') : isEditing ? 'Save changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/// CSV bulk-import for branches. Uploads a CSV to /api/branches/import?brandId=…
/// and surfaces the per-row error report so the seller can fix and re-import.
/// Defaults to upsert mode (existing branches with same name+city get patched).
function BranchImportButton({ brandId, onImported }: { brandId: string; onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<null | {
    created: number; updated: number; skipped: number;
    errors: Array<{ row: number; message: string }>;
  }>(null);

  async function onFile(file: File) {
    setBusy(true);
    setReport(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post<{ success: boolean; data: typeof report; error?: { message: string } }>(
        `/branches/import?brandId=${brandId}`,
        form,
        { headers: { 'Content-Type': null as unknown as string } },
      );
      if (!res.data.success) throw new Error(res.data.error?.message ?? 'Import failed');
      setReport(res.data.data);
      const { created = 0, updated = 0, skipped = 0, errors = [] } = res.data.data ?? {};
      toast.success(`Imported: ${created} created · ${updated} updated · ${skipped} skipped · ${errors.length} errors`);
      onImported();
    } catch (e) {
      toast.error(`Import failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        title="Bulk-import branches from a CSV file"
      >
        {busy
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…</>
          : <><Upload className="mr-2 h-4 w-4" /> Import CSV</>}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
      />
      <Dialog open={report !== null} onOpenChange={(o) => !o && setReport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import result</DialogTitle>
            <DialogDescription>
              The branch list has already been refreshed with the changes that succeeded.
            </DialogDescription>
          </DialogHeader>
          {report ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <Stat label="Created" value={report.created} tone="success" />
                <Stat label="Updated" value={report.updated} tone="info" />
                <Stat label="Skipped" value={report.skipped} tone="muted" />
              </div>
              {report.errors.length > 0 ? (
                <div className="max-h-60 overflow-auto rounded border bg-muted/40 p-3 text-xs">
                  <p className="mb-2 font-medium text-destructive">{report.errors.length} row error(s):</p>
                  <ul className="space-y-1">
                    {report.errors.slice(0, 50).map((e, i) => (
                      <li key={i}>
                        <span className="font-mono">Row {e.row}:</span> {e.message}
                      </li>
                    ))}
                    {report.errors.length > 50 ? (
                      <li className="italic text-muted-foreground">…and {report.errors.length - 50} more</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Expected CSV header (case-insensitive): <code>name, addressLine1, addressLine2, city, state, country, postalCode, latitude, longitude, phone, email, shopNumber</code>.
                Duplicates (same name + city in this brand) are <strong>updated</strong>, not duplicated.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReport(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'success' | 'info' | 'muted' }) {
  const cls = tone === 'success'
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
    : tone === 'info'
      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
      : 'bg-muted text-muted-foreground';
  return (
    <div className={`rounded-lg px-3 py-2 ${cls}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs uppercase tracking-wide">{label}</p>
    </div>
  );
}
