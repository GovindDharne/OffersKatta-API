'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { apiGetPaginated, apiPatch } from '@/lib/api';
import { Protected } from '@/components/protected';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { timeAgo } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  return <Protected><Inner /></Protected>;
}

function Inner() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiGetPaginated<Notification>('/notifications', { limit: 50 }),
  });
  const readAll = useMutation({
    mutationFn: () => apiPatch('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const readOne = useMutation({
    mutationFn: (id: string) => apiPatch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <Button variant="outline" size="sm" onClick={() => readAll.mutate()}>
          <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
        </Button>
      </div>
      {q.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      ) : q.data && q.data.data.length > 0 ? (
        <div className="space-y-3">
          {q.data.data.map((n) => (
            <Card key={n.id} className={n.isRead ? 'opacity-60' : ''} onClick={() => !n.isRead && readOne.mutate(n.id)}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{n.title}</span>
                  <span className="text-xs font-normal text-muted-foreground">{timeAgo(n.createdAt)}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{n.body}</CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> No notifications yet</CardTitle>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
