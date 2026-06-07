'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { apiGet, apiPatch } from '@/lib/api';
import { Protected } from '@/components/protected';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const schema = z.object({
  fullName: z.string().min(2),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface UserProfile {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  role: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

export default function ProfilePage() {
  return <Protected><Inner /></Protected>;
}

function Inner() {
  const qc = useQueryClient();
  const profileQ = useQuery({ queryKey: ['me'], queryFn: () => apiGet<UserProfile>('/users/me') });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', city: '', state: '', country: '' },
  });

  useEffect(() => {
    if (profileQ.data) {
      form.reset({
        fullName: profileQ.data.fullName ?? '',
        city: profileQ.data.city ?? '',
        state: profileQ.data.state ?? '',
        country: profileQ.data.country ?? '',
      });
    }
  }, [profileQ.data, form]);

  const update = useMutation({
    mutationFn: (values: FormValues) => apiPatch('/users/me', values),
    onSuccess: () => { toast.success('Profile updated'); qc.invalidateQueries({ queryKey: ['me'] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
          <CardDescription>{profileQ.data?.email ?? profileQ.data?.phone}</CardDescription>
        </CardHeader>
        <form onSubmit={form.handleSubmit((v) => update.mutate(v))}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" {...form.register('fullName')} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2"><Label>City</Label><Input {...form.register('city')} /></div>
              <div className="space-y-2"><Label>State</Label><Input {...form.register('state')} /></div>
              <div className="space-y-2"><Label>Country</Label><Input {...form.register('country')} /></div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={update.isPending}>Save changes</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
