'use client';

/// PlacesAutocomplete — typeahead address picker backed by Google Places.
///
/// Sits above the manual address fields in the branch dialog. When the user
/// picks a suggestion, we fetch full structured details and bubble them up
/// via `onPick`, letting the parent autofill addressLine1/city/state/country/
/// postalCode/latitude/longitude in one go.
///
/// Degrades cleanly: if the backend reports `{ enabled: false }` (no API key
/// configured), the whole component renders nothing — the existing manual
/// flow keeps working.
///
/// Billing note: we generate one `sessionToken` per "search → pick" cycle so
/// Google bills all the autocomplete keystrokes + the final details lookup
/// as a single session.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2, MapPin } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Prediction {
  placeId: string;
  primaryText: string;
  secondaryText: string;
}

export interface PlacePick {
  addressLine1: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

export function PlacesAutocomplete({ onPick }: { onPick: (p: PlacePick) => void }) {
  // Cheap feature flag — caches "is the integration enabled" for the session.
  const configQ = useQuery({
    queryKey: ['places-config'],
    queryFn: () => apiGet<{ enabled: boolean; region: string }>('/places/config'),
    staleTime: 5 * 60 * 1000,
  });

  // Session token — refreshed after each pick so we open a fresh billing cycle.
  // crypto.randomUUID is widely available in modern browsers (all evergreen
  // since 2022); the fallback below keeps SSR pre-paint and ancient browsers
  // from crashing.
  const newSessionToken = useCallback(() => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }, []);
  const [sessionToken, setSessionToken] = useState<string>('');
  useEffect(() => { setSessionToken(newSessionToken()); }, [newSessionToken]);

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Debounce keystrokes to ~250ms so we don't burn quota every character.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Fire autocomplete whenever the debounced value changes (and is long enough).
  useEffect(() => {
    if (!configQ.data?.enabled) return;
    if (debounced.length < 2) {
      setPredictions([]);
      return;
    }
    let cancelled = false;
    setBusy(true);
    apiGet<{ enabled: boolean; predictions: Prediction[] }>(
      `/places/autocomplete?q=${encodeURIComponent(debounced)}` +
      (sessionToken ? `&sessionToken=${encodeURIComponent(sessionToken)}` : ''),
    )
      .then((res) => {
        if (cancelled) return;
        setPredictions(res.predictions ?? []);
        setOpen(true);
      })
      .catch(() => {
        if (cancelled) return;
        setPredictions([]);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => { cancelled = true; };
  }, [debounced, sessionToken, configQ.data?.enabled]);

  // Click-away closes the dropdown.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handlePick = useCallback(async (placeId: string, label: string) => {
    setOpen(false);
    setBusy(true);
    try {
      const details = await apiGet<{
        addressLine1: string;
        city: string;
        state: string;
        country: string;
        postalCode: string;
        latitude: number;
        longitude: number;
        formattedAddress: string;
      }>(
        `/places/details/${encodeURIComponent(placeId)}` +
        (sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : ''),
      );
      onPick({
        addressLine1: details.addressLine1,
        city: details.city,
        state: details.state,
        country: details.country || 'India',
        postalCode: details.postalCode,
        latitude: details.latitude,
        longitude: details.longitude,
        formattedAddress: details.formattedAddress,
      });
      // Reflect what the user picked, then start a fresh billing session.
      setQuery(label);
      setSessionToken(newSessionToken());
    } finally {
      setBusy(false);
    }
  }, [sessionToken, onPick, newSessionToken]);

  const helperHint = useMemo(() => {
    if (!configQ.data) return null;
    if (!configQ.data.enabled) return null;
    return `Region: ${configQ.data.region.toUpperCase()}. Pick a suggestion to autofill the address fields below.`;
  }, [configQ.data]);

  // No integration configured → render nothing. Manual entry still works.
  if (configQ.isLoading) return null;
  if (!configQ.data?.enabled) return null;

  return (
    <div ref={boxRef} className="relative space-y-1">
      <Label htmlFor="places-search">Search by name or address</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="places-search"
          ref={inputRef}
          autoComplete="off"
          placeholder="e.g. Phoenix Marketcity Kurla"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => predictions.length > 0 && setOpen(true)}
          className="pl-9 pr-9"
        />
        {busy ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>
      {helperHint ? <p className="text-xs text-muted-foreground">{helperHint}</p> : null}

      {open && predictions.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover shadow-lg">
          {predictions.map((p) => (
            <li key={p.placeId}>
              <button
                type="button"
                onClick={() => void handlePick(p.placeId, `${p.primaryText} ${p.secondaryText}`.trim())}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{p.primaryText}</span>
                  {p.secondaryText ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.secondaryText}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
          {/* Google's ToS requires visible attribution wherever predictions render. */}
          <li className="border-t px-3 py-1.5 text-right text-[10px] uppercase tracking-wide text-muted-foreground">
            Powered by Google
          </li>
        </ul>
      ) : null}
    </div>
  );
}
