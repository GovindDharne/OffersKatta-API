'use client';

/// Cities master-data manager. Mounted in both panels:
///   /admin/cities  — full management (add/edit/deactivate) for SUPER_ADMIN
///   /seller/cities — sellers can view + add cities (edit/deactivate hidden)
///
/// Backend (apps/api/src/modules/cities/*): list is public, create is
/// seller+admin, edit/deactivate are admin-only (also enforced server-side).

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { StateSelect } from '@/components/state-select';

interface City {
  id: string;
  name: string;
  state: string;
  country: string;
}

export function CitiesManager() {
  const qc = useQueryClient();
  const { user } = useAuth();
  // Sellers and admins can both add, edit and deactivate cities (shared master
  // list). Other roles (managers/staff) get a read-only view.
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'SELLER_OWNER';

  const citiesQ = useQuery({ queryKey: ['cities'], queryFn: () => apiGet<City[]>('/cities') });
  const cities = citiesQ.data ?? [];

  // Add form
  const [name, setName] = useState('');
  const [state, setState] = useState('');

  // Edit dialog
  const [editing, setEditing] = useState<City | null>(null);
  const [editName, setEditName] = useState('');
  const [editState, setEditState] = useState('');

  // City-name search for the list. The "Add a city" State dropdown doubles as
  // the state filter (see filteredCities) — selecting a state shows only its
  // cities, per the requested UX.
  const [q, setQ] = useState('');

  const add = useMutation({
    mutationFn: () => apiPost<City>('/cities', { name: name.trim(), state: state.trim() }),
    onSuccess: () => {
      toast.success('City added');
      setName(''); // keep the selected state so the list stays filtered to it
      void qc.invalidateQueries({ queryKey: ['cities'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const save = useMutation({
    mutationFn: () => apiPatch(`/cities/${editing!.id}`, { name: editName.trim(), state: editState.trim() }),
    onSuccess: () => {
      toast.success('City updated');
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['cities'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/cities/${id}`),
    onSuccess: () => {
      toast.success('City deactivated');
      void qc.invalidateQueries({ queryKey: ['cities'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // The State dropdown in "Add a city" filters the list to that state; the
  // search box narrows by city name on top of that.
  const term = q.trim().toLowerCase();
  const filteredCities = cities.filter(
    (c) => (!state || c.state === state) && (!term || c.name.toLowerCase().includes(term)),
  );
  const byState = new Map<string, City[]>();
  for (const c of [...filteredCities].sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name))) {
    const arr = byState.get(c.state) ?? [];
    arr.push(c);
    byState.set(c.state, arr);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cities</h1>
        <p className="text-sm text-muted-foreground">
          The master list powering the City dropdown across branch, mall and offer forms.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add a city</CardTitle>
          <p className="text-xs text-muted-foreground">
            Pick a state to filter the list below to that state; the city you add is saved under it.
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim().length < 2 || state.trim().length < 2) {
                toast.error('Enter both city and state');
                return;
              }
              add.mutate();
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="space-y-1">
              <Label htmlFor="c-name">City</Label>
              <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nashik" className="w-56" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-state">State</Label>
              <div className="w-56">
                <StateSelect id="c-state" value={state} onChange={setState} />
              </div>
            </div>
            <Button type="submit" disabled={add.isPending}>
              <Plus className="mr-2 h-4 w-4" /> {add.isPending ? 'Adding…' : 'Add city'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              All cities{' '}
              {cities.length > 0 ? (
                <span className="text-sm font-normal text-muted-foreground">
                  {state ? `in ${state} ` : ''}({filteredCities.length}
                  {filteredCities.length !== cities.length ? ` of ${cities.length}` : ''})
                </span>
              ) : null}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search city…"
                className="h-9 w-44"
              />
              {(state || q) ? (
                <Button variant="ghost" size="sm" onClick={() => { setState(''); setQ(''); }}>
                  Clear filter
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {citiesQ.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : cities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cities yet. Add one above.</p>
          ) : filteredCities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cities match your filter.</p>
          ) : (
            <div className="space-y-4">
              {[...byState.keys()].map((st) => (
                <div key={st}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{st}</p>
                  <ul className="divide-y rounded border">
                    {byState.get(st)!.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="flex items-center gap-2 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" /> {c.name}
                        </span>
                        {canManage ? (
                          <span className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setEditing(c); setEditName(c.name); setEditState(c.state); }}
                            >
                              <Pencil className="mr-1 h-3 w-3" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={remove.isPending}
                              onClick={() => {
                                if (confirm(`Deactivate ${c.name}, ${c.state}? It will no longer appear in the City dropdown.`)) {
                                  remove.mutate(c.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </span>
                        ) : (
                          <Badge variant="secondary">{c.country}</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog (admin). overflow-y-visible + extra bottom space so the
          State dropdown isn't clipped by the dialog's default overflow-y-auto. */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl overflow-y-visible">
          <DialogHeader>
            <DialogTitle>Edit city</DialogTitle>
            <DialogDescription>Renaming updates the dropdown; existing saved records keep their stored value.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="e-name">City</Label>
                <Input id="e-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="e-state">State</Label>
                <StateSelect id="e-state" value={editState} onChange={setEditState} />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save changes'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
