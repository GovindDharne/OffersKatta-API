'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGetPaginated } from '@/lib/api';
import { Protected } from '@/components/protected';
import { OfferCard, type OfferCardProps } from '@/components/offer-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface FavoriteRow { id: string; offer: OfferCardProps }

export default function FavoritesPage() {
  return (
    <Protected>
      <FavoritesInner />
    </Protected>
  );
}

function FavoritesInner() {
  const q = useQuery({
    queryKey: ['favorites'],
    queryFn: () => apiGetPaginated<FavoriteRow>('/favorites', { limit: 24 }),
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold">Your favorites</h1>
      {q.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-lg" />)}
        </div>
      ) : q.data && q.data.data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {q.data.data.map((row) => <OfferCard key={row.id} {...row.offer} />)}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No favorites yet</CardTitle>
            <CardDescription>Tap the heart on any offer to save it here.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
