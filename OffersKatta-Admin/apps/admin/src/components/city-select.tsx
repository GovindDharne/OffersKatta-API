'use client';

/// CitySelect — a searchable city dropdown backed by the City master list
/// (GET /cities). Its value is the city *name* string, so it's a drop-in
/// replacement for the old free-text city inputs (branch/mall/offer-scope).
///
/// Sellers (and admins) can add a missing city inline via "+ Add city" without
/// leaving the form — it POSTs /cities and immediately selects the new value.
///
/// Built as a custom popover (not Radix Select) so the in-panel search input
/// keeps focus and we can append the add-city affordance.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronsUpDown, Plus, Check } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StateSelect } from '@/components/state-select';

interface City {
  id: string;
  name: string;
  state: string;
}

export function CitySelect({
  value,
  onChange,
  placeholder = 'Select city',
  id,
}: {
  value?: string;
  onChange: (cityName: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const qc = useQueryClient();
  const citiesQ = useQuery({ queryKey: ['cities'], queryFn: () => apiGet<City[]>('/cities') });

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [newState, setNewState] = useState('');
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const cities = citiesQ.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter((c) => `${c.name} ${c.state}`.toLowerCase().includes(q));
  }, [cities, search]);

  const addCity = useMutation({
    mutationFn: () =>
      apiPost<City>('/cities', { name: search.trim(), state: newState.trim() }),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ['cities'] });
      onChange(created.name);
      toast.success(`Added ${created.name}, ${created.state}`);
      setOpen(false);
      setAdding(false);
      setSearch('');
      setNewState('');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div ref={boxRef} className="relative">
      <Button
        id={id}
        type="button"
        variant="outline"
        className="w-full justify-between font-normal"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={value ? '' : 'text-muted-foreground'}>{value || placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="p-2">
            <Input
              autoFocus
              placeholder="Search city…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <ul className="max-h-56 overflow-auto">
            {citiesQ.isLoading ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">Loading…</li>
            ) : filtered.length > 0 ? (
              filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c.name);
                      setOpen(false);
                      setSearch('');
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                  >
                    <span>
                      {c.name}
                      <span className="text-muted-foreground"> · {c.state}</span>
                    </span>
                    {value === c.name ? <Check className="h-4 w-4 text-primary" /> : null}
                  </button>
                </li>
              ))
            ) : !adding ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No matching city.</li>
            ) : null}
          </ul>

          <div className="border-t p-2">
            {adding ? (
              <div className="space-y-2">
                <Input
                  placeholder="City name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <StateSelect value={newState} onChange={setNewState} placeholder="Select state" />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={addCity.isPending || search.trim().length < 2 || newState.trim().length < 2}
                    onClick={() => addCity.mutate()}
                  >
                    {addCity.isPending ? 'Saving…' : 'Save city'}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setAdding(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="w-full justify-start"
                onClick={() => setAdding(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                {search.trim() ? `Add "${search.trim()}"` : 'Add a new city'}
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
