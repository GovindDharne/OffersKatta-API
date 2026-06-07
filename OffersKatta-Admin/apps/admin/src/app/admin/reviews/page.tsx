'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Star, ThumbsUp, Trash2 } from 'lucide-react';
import { apiGet, apiPatch, apiDelete } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { timeAgo } from '@/lib/utils';

interface Review {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  createdAt: string;
  user?: { id: string; email: string | null; fullName: string | null };
}

export default function AdminReviewsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'reviews', 'pending'], queryFn: () => apiGet<Review[]>('/admin/reviews/pending') });

  const approve = useMutation({
    mutationFn: (id: string) => apiPatch(`/reviews/${id}/moderate`, { isApproved: true }),
    onSuccess: () => { toast.success('Approved'); qc.invalidateQueries({ queryKey: ['admin', 'reviews'] }); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/reviews/${id}`),
    onSuccess: () => { toast.success('Removed'); qc.invalidateQueries({ queryKey: ['admin', 'reviews'] }); },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pending reviews</h1>
      {q.isLoading ? (
        <Skeleton className="h-32" />
      ) : q.data && q.data.length > 0 ? (
        <div className="space-y-3">
          {q.data.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-500 text-amber-500" />
                    ))}
                    <span className="font-normal text-muted-foreground">by {r.user?.fullName ?? r.user?.email}</span>
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">{timeAgo(r.createdAt)}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {r.title ? <p className="font-medium">{r.title}</p> : null}
                {r.comment ? <p className="text-sm text-muted-foreground">{r.comment}</p> : null}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => approve.mutate(r.id)}>
                    <ThumbsUp className="mr-2 h-4 w-4" /> Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => remove.mutate(r.id)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No reviews pending moderation. 🎉</p>
      )}
    </div>
  );
}
