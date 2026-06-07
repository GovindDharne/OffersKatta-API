'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { apiPost } from '@/lib/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const schema = z.object({ email: z.string().email() });
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      await apiPost('/auth/password/forgot', values);
      setSent(true);
      toast.success('If that email exists, a reset link has been sent.');
    } catch {
      // The endpoint deliberately returns success regardless to prevent enumeration.
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot your password?</CardTitle>
        <CardDescription>We'll send a reset link if an account exists.</CardDescription>
      </CardHeader>
      {sent ? (
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Check your inbox. In development the email is routed to{' '}
            <Link href="http://localhost:8025" target="_blank" className="text-primary hover:underline">
              MailHog
            </Link>.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Back to login</Link>
          </Button>
        </CardContent>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link'}
            </Button>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
