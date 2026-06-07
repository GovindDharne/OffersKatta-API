'use client';

/// TerritoriesCard — lets a brand owner manage Regions and the Zones nested
/// under them. Embedded on /seller/brands/[id] just above the branches list.
///
/// Backend contract (apps/api/src/modules/territories/*):
///   GET    /brands/:brandId/regions
///   POST   /brands/:brandId/regions          { name }
///   PATCH  /brands/:brandId/regions/:id      { name }
///   DELETE /brands/:brandId/regions/:id      (cascades soft-delete to zones)
///   GET    /brands/:brandId/zones?regionId=
///   POST   /brands/:brandId/zones            { name, regionId }
///   PATCH  /brands/:brandId/zones/:id        { name?, regionId? }
///   DELETE /brands/:brandId/zones/:id        (un-pins any branches in it)
///
/// Why tabs instead of one big tree: most chains have ~5 regions and dozens of
/// zones. A flat list per tab is faster to scan, and keeps the dialog small.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';

import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface Region {
  id: string;
  name: string;
  slug: string;
}
export interface Zone {
  id: string;
  name: string;
  slug: string;
  regionId: string;
  region?: { id: string; name: string } | null;
}
export interface Manager {
  id: string;
  userId: string;
  regionId: string | null;
  zoneId: string | null;
  user?: { id: string; fullName: string | null; email: string | null; role: string } | null;
  region?: { id: string; name: string } | null;
  zone?: { id: string; name: string; region?: { id: string; name: string } | null } | null;
}

export function TerritoriesCard({ brandId }: { brandId: string }) {
  const qc = useQueryClient();
  const regionsQ = useQuery({
    queryKey: ['regions', brandId],
    queryFn: () => apiGet<Region[]>(`/brands/${brandId}/regions`),
  });
  const zonesQ = useQuery({
    queryKey: ['zones', brandId],
    queryFn: () => apiGet<Zone[]>(`/brands/${brandId}/zones`),
  });

  const managersQ = useQuery({
    queryKey: ['territory-managers', brandId],
    queryFn: () => apiGet<Manager[]>(`/brands/${brandId}/managers`),
  });

  const regions = regionsQ.data ?? [];
  const zones = zonesQ.data ?? [];
  const managers = managersQ.data ?? [];

  // Assign-manager dialog state
  const [mgrOpen, setMgrOpen] = useState(false);
  const [mgrEmail, setMgrEmail] = useState('');
  // target encodes "region:<id>" or "zone:<id>"
  const [mgrTarget, setMgrTarget] = useState('');

  // Region dialog state
  const [regionDialog, setRegionDialog] = useState<{ open: boolean; editing: Region | null }>({
    open: false,
    editing: null,
  });
  const [regionName, setRegionName] = useState('');

  // Zone dialog state
  const [zoneDialog, setZoneDialog] = useState<{ open: boolean; editing: Zone | null }>({
    open: false,
    editing: null,
  });
  const [zoneName, setZoneName] = useState('');
  const [zoneRegionId, setZoneRegionId] = useState('');

  function openRegionCreate() {
    setRegionDialog({ open: true, editing: null });
    setRegionName('');
  }
  function openRegionEdit(r: Region) {
    setRegionDialog({ open: true, editing: r });
    setRegionName(r.name);
  }
  function openZoneCreate() {
    setZoneDialog({ open: true, editing: null });
    setZoneName('');
    setZoneRegionId(regions[0]?.id ?? '');
  }
  function openZoneEdit(z: Zone) {
    setZoneDialog({ open: true, editing: z });
    setZoneName(z.name);
    setZoneRegionId(z.regionId);
  }

  const regionUpsert = useMutation({
    mutationFn: async () => {
      const name = regionName.trim();
      if (name.length < 2) throw new Error('Region name must be at least 2 characters');
      if (regionDialog.editing) {
        return apiPatch(`/brands/${brandId}/regions/${regionDialog.editing.id}`, { name });
      }
      return apiPost(`/brands/${brandId}/regions`, { name });
    },
    onSuccess: () => {
      toast.success(regionDialog.editing ? 'Region updated' : 'Region created');
      setRegionDialog({ open: false, editing: null });
      void qc.invalidateQueries({ queryKey: ['regions', brandId] });
      void qc.invalidateQueries({ queryKey: ['zones', brandId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const regionDelete = useMutation({
    mutationFn: (id: string) => apiDelete(`/brands/${brandId}/regions/${id}`),
    onSuccess: () => {
      toast.success('Region deleted (zones inside also archived)');
      void qc.invalidateQueries({ queryKey: ['regions', brandId] });
      void qc.invalidateQueries({ queryKey: ['zones', brandId] });
      // Branch list may render zone names — invalidate it so stale labels disappear.
      void qc.invalidateQueries({ queryKey: ['branches', brandId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const zoneUpsert = useMutation({
    mutationFn: async () => {
      const name = zoneName.trim();
      if (name.length < 2) throw new Error('Zone name must be at least 2 characters');
      if (!zoneRegionId) throw new Error('Pick a region');
      if (zoneDialog.editing) {
        return apiPatch(`/brands/${brandId}/zones/${zoneDialog.editing.id}`, {
          name,
          regionId: zoneRegionId,
        });
      }
      return apiPost(`/brands/${brandId}/zones`, { name, regionId: zoneRegionId });
    },
    onSuccess: () => {
      toast.success(zoneDialog.editing ? 'Zone updated' : 'Zone created');
      setZoneDialog({ open: false, editing: null });
      void qc.invalidateQueries({ queryKey: ['zones', brandId] });
      void qc.invalidateQueries({ queryKey: ['branches', brandId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const zoneDelete = useMutation({
    mutationFn: (id: string) => apiDelete(`/brands/${brandId}/zones/${id}`),
    onSuccess: () => {
      toast.success('Zone deleted (branches in it un-pinned)');
      void qc.invalidateQueries({ queryKey: ['zones', brandId] });
      void qc.invalidateQueries({ queryKey: ['branches', brandId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const managerAssign = useMutation({
    mutationFn: async () => {
      const email = mgrEmail.trim();
      if (!email) throw new Error('Enter the manager’s email');
      if (!mgrTarget) throw new Error('Pick a region or zone');
      const [kind, id] = mgrTarget.split(':');
      return apiPost(`/brands/${brandId}/managers`, {
        email,
        ...(kind === 'region' ? { regionId: id } : { zoneId: id }),
      });
    },
    onSuccess: () => {
      toast.success('Manager assigned (they must re-login for the new role)');
      setMgrOpen(false);
      setMgrEmail('');
      setMgrTarget('');
      void qc.invalidateQueries({ queryKey: ['territory-managers', brandId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const managerRemove = useMutation({
    mutationFn: (id: string) => apiDelete(`/brands/${brandId}/managers/${id}`),
    onSuccess: () => {
      toast.success('Manager removed');
      void qc.invalidateQueries({ queryKey: ['territory-managers', brandId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Zones grouped by region — keeps the Zones tab readable when there are many.
  const zonesByRegion = new Map<string, Zone[]>();
  for (const z of zones) {
    const arr = zonesByRegion.get(z.regionId) ?? [];
    arr.push(z);
    zonesByRegion.set(z.regionId, arr);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Regions & Zones</CardTitle>
        <CardDescription>
          Group branches into territories so you can target offers at a region or zone
          (e.g. "Bombay North → Andheri-Bandra") instead of every branch one by one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="regions">
          <TabsList>
            <TabsTrigger value="regions">
              Regions <Badge variant="secondary" className="ml-2">{regions.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="zones">
              Zones <Badge variant="secondary" className="ml-2">{zones.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="managers">
              Managers <Badge variant="secondary" className="ml-2">{managers.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* ── REGIONS TAB ──────────────────────────────────────── */}
          <TabsContent value="regions" className="space-y-3">
            <div className="flex items-center justify-end">
              <Button size="sm" onClick={openRegionCreate}>
                <Plus className="mr-2 h-3 w-3" /> Add region
              </Button>
            </div>
            {regionsQ.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : regions.length > 0 ? (
              <ul className="divide-y rounded border">
                {regions.map((r) => {
                  const count = zonesByRegion.get(r.id)?.length ?? 0;
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {count} zone{count === 1 ? '' : 's'} · slug:{' '}
                          <code className="font-mono">{r.slug}</code>
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="sm" variant="outline" onClick={() => openRegionEdit(r)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={regionDelete.isPending}
                          onClick={() => {
                            if (
                              confirm(
                                `Delete region "${r.name}"? ${count} zone(s) inside will also be archived.`,
                              )
                            ) {
                              regionDelete.mutate(r.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No regions yet. Add one (e.g. "Bombay North") to start grouping branches.
              </p>
            )}
          </TabsContent>

          {/* ── ZONES TAB ───────────────────────────────────────── */}
          <TabsContent value="zones" className="space-y-3">
            <div className="flex items-center justify-end">
              <Button
                size="sm"
                onClick={openZoneCreate}
                disabled={regions.length === 0}
                title={regions.length === 0 ? 'Create a region first' : undefined}
              >
                <Plus className="mr-2 h-3 w-3" /> Add zone
              </Button>
            </div>
            {regions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Zones live under regions — create at least one region first.
              </p>
            ) : zonesQ.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : zones.length > 0 ? (
              <div className="space-y-3">
                {regions.map((r) => {
                  const list = zonesByRegion.get(r.id) ?? [];
                  if (list.length === 0) return null;
                  return (
                    <div key={r.id}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {r.name}
                      </p>
                      <ul className="divide-y rounded border">
                        {list.map((z) => (
                          <li
                            key={z.id}
                            className="flex items-center justify-between gap-2 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{z.name}</p>
                              <p className="text-xs text-muted-foreground">
                                slug: <code className="font-mono">{z.slug}</code>
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <Button size="sm" variant="outline" onClick={() => openZoneEdit(z)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={zoneDelete.isPending}
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Delete zone "${z.name}"? Branches inside lose this assignment.`,
                                    )
                                  ) {
                                    zoneDelete.mutate(z.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No zones yet. Add one to subdivide a region.
              </p>
            )}
          </TabsContent>

          {/* ── MANAGERS TAB ─────────────────────────────────────── */}
          <TabsContent value="managers" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Regional/zone managers can view &amp; manage only the branches and offers in
                their assigned territory. They re-login to pick up the new role.
              </p>
              <Button
                size="sm"
                onClick={() => { setMgrEmail(''); setMgrTarget(''); setMgrOpen(true); }}
                disabled={regions.length === 0 && zones.length === 0}
                title={regions.length === 0 && zones.length === 0 ? 'Create a region or zone first' : undefined}
              >
                <Plus className="mr-2 h-3 w-3" /> Assign manager
              </Button>
            </div>
            {managersQ.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : managers.length > 0 ? (
              <ul className="divide-y rounded border">
                {managers.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {m.user?.fullName ?? m.user?.email ?? m.userId}
                        <Badge variant="secondary" className="ml-2">
                          {m.regionId ? 'Regional' : 'Zone'}
                        </Badge>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.user?.email ? `${m.user.email} · ` : ''}
                        {m.region
                          ? `Region: ${m.region.name}`
                          : m.zone
                            ? `Zone: ${m.zone.region?.name ? `${m.zone.region.name} · ` : ''}${m.zone.name}`
                            : '—'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={managerRemove.isPending}
                      onClick={() => {
                        if (confirm(`Remove ${m.user?.email ?? 'this manager'} from this territory?`)) {
                          managerRemove.mutate(m.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No territory managers yet. Assign one to delegate a region or zone.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* ── REGION DIALOG ────────────────────────────────────── */}
      <Dialog
        open={regionDialog.open}
        onOpenChange={(open) => setRegionDialog((s) => ({ ...s, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {regionDialog.editing ? 'Edit region' : 'New region'}
            </DialogTitle>
            <DialogDescription>
              Regions are the top of the territory tree. Names should be unique within this brand.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              regionUpsert.mutate();
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <Label htmlFor="r-name">Name</Label>
              <Input
                id="r-name"
                autoFocus
                value={regionName}
                onChange={(e) => setRegionName(e.target.value)}
                placeholder="e.g. Bombay North"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRegionDialog({ open: false, editing: null })}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={regionUpsert.isPending}>
                {regionUpsert.isPending
                  ? 'Saving…'
                  : regionDialog.editing
                    ? 'Save changes'
                    : 'Create region'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── ZONE DIALOG ──────────────────────────────────────── */}
      <Dialog
        open={zoneDialog.open}
        onOpenChange={(open) => setZoneDialog((s) => ({ ...s, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{zoneDialog.editing ? 'Edit zone' : 'New zone'}</DialogTitle>
            <DialogDescription>
              Zones sit under regions and group nearby branches together.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              zoneUpsert.mutate();
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <Label htmlFor="z-region">Region</Label>
              <Select value={zoneRegionId} onValueChange={setZoneRegionId}>
                <SelectTrigger id="z-region">
                  <SelectValue placeholder="Pick a region" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="z-name">Name</Label>
              <Input
                id="z-name"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                placeholder="e.g. Andheri-Bandra"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setZoneDialog({ open: false, editing: null })}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={zoneUpsert.isPending}>
                {zoneUpsert.isPending
                  ? 'Saving…'
                  : zoneDialog.editing
                    ? 'Save changes'
                    : 'Create zone'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── ASSIGN MANAGER DIALOG ────────────────────────────── */}
      <Dialog open={mgrOpen} onOpenChange={setMgrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign territory manager</DialogTitle>
            <DialogDescription>
              The user must already have an account. They&apos;ll manage every branch &amp;
              offer in the chosen region or zone — and must sign out and back in for the
              new role to take effect.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); managerAssign.mutate(); }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <Label htmlFor="m-email">User email</Label>
              <Input
                id="m-email"
                type="email"
                autoFocus
                value={mgrEmail}
                onChange={(e) => setMgrEmail(e.target.value)}
                placeholder="manager@example.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="m-target">Territory</Label>
              <Select value={mgrTarget} onValueChange={setMgrTarget}>
                <SelectTrigger id="m-target"><SelectValue placeholder="Pick a region or zone" /></SelectTrigger>
                <SelectContent>
                  {regions.length > 0 ? (
                    <>
                      {regions.map((r) => (
                        <SelectItem key={`region:${r.id}`} value={`region:${r.id}`}>
                          Region · {r.name}
                        </SelectItem>
                      ))}
                    </>
                  ) : null}
                  {zones.map((z) => (
                    <SelectItem key={`zone:${z.id}`} value={`zone:${z.id}`}>
                      Zone · {z.region?.name ? `${z.region.name} → ` : ''}{z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Region → manages all its zones. Zone → manages just that zone.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMgrOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={managerAssign.isPending}>
                {managerAssign.isPending ? 'Assigning…' : 'Assign'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
