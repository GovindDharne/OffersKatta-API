'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Navigation } from 'lucide-react';
import { apiGetPaginated, apiGet } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OfferCard, type OfferCardProps } from '@/components/offer-card';

const FALLBACK = { latitude: 19.0760, longitude: 72.8777, label: 'Mumbai (default)' };

interface BankDto { id: string; name: string; slug: string }
interface MallDto { id: string; name: string; city: string }

export default function NearbyPage() {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number; label: string } | null>(null);
  const [denied, setDenied] = useState(false);
  const [radius, setRadius] = useState(10);
  const [bankId, setBankId] = useState('');
  const [mallId, setMallId] = useState('');

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setCoords(FALLBACK); setDenied(true); return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, label: 'your location' }),
      () => { setCoords(FALLBACK); setDenied(true); },
      { enableHighAccuracy: true, timeout: 5000 },
    );
  }, []);

  const banksQ = useQuery({
    queryKey: ['banks'],
    queryFn: () => apiGet<BankDto[]>('/banks'),
  });

  // Only show malls that fall inside the currently-chosen radius. The dropdown
  // shrinks/expands as the user toggles 5/10/25/50 km. Resets the selection
  // if the previously-picked mall drops out of range.
  const mallsQ = useQuery({
    queryKey: ['malls', 'nearby', coords?.latitude, coords?.longitude, radius],
    queryFn: async () => {
      const res = await apiGetPaginated<MallDto & { distanceKm: number }>(
        '/malls/nearby',
        {
          latitude: coords!.latitude,
          longitude: coords!.longitude,
          radiusKm: radius,
          limit: 100,
        },
      );
      return res.data;
    },
    enabled: Boolean(coords),
  });

  // Drop the mall selection if the chosen mall is no longer in range.
  useEffect(() => {
    if (!mallId || !mallsQ.data) return;
    if (!mallsQ.data.some((m) => m.id === mallId)) setMallId('');
  }, [mallId, mallsQ.data]);

  const offersQ = useQuery({
    queryKey: ['offers', 'nearby', coords?.latitude, coords?.longitude, radius, bankId, mallId],
    queryFn: () =>
      apiGetPaginated<OfferCardProps & { distanceKm: number }>('/offers/nearby', {
        latitude: coords!.latitude,
        longitude: coords!.longitude,
        radiusKm: radius,
        bankId: bankId || undefined,
        mallId: mallId || undefined,
        limit: 24,
      }),
    enabled: Boolean(coords),
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" /> Nearby offers
            </CardTitle>
            <CardDescription>
              {coords ? `Searching within ${radius} km of ${coords.label}` : 'Locating you…'}
              {denied ? ' — geolocation blocked, using fallback' : null}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={bankId || 'all'} onValueChange={(v) => setBankId(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-44" aria-label="Filter by bank">
                <SelectValue placeholder="All banks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All banks</SelectItem>
                {banksQ.data?.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={mallId || 'all'} onValueChange={(v) => setMallId(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-44" aria-label="Filter by mall">
                <SelectValue placeholder={
                  mallsQ.data && mallsQ.data.length > 0
                    ? `All malls (${mallsQ.data.length})`
                    : 'No malls in range'
                } />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All malls{mallsQ.data ? ` (${mallsQ.data.length} in range)` : ''}
                </SelectItem>
                {mallsQ.data?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} · {m.distanceKm.toFixed(1)} km
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {[5, 10, 25, 50].map((r) => (
              <Button key={r} size="sm" variant={radius === r ? 'default' : 'outline'} onClick={() => setRadius(r)}>
                {r}km
              </Button>
            ))}
          </div>
        </CardHeader>
      </Card>

      {!coords || offersQ.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-lg" />)}
        </div>
      ) : offersQ.data && offersQ.data.data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {offersQ.data.data.map((o) => <OfferCard key={o.id} {...o} distanceKm={o.distanceKm} />)}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Navigation className="h-5 w-5" /> No offers here</CardTitle>
            <CardDescription>Try increasing the radius or check back later.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
