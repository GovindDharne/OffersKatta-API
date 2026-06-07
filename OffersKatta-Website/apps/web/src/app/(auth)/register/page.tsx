'use client';

import React, { forwardRef, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Phone } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// E.164-ish: optional +, 7–15 digits, no leading zero. Sloppy enough for India
// (with or without country code) but rejects garbage.
const phoneRegex = /^\+?[1-9]\d{6,14}$/;

const customerSchema = z.object({
  fullName: z.string().min(2, 'Please enter your name'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().regex(phoneRegex, 'Enter a valid phone (e.g. +919876543210)'),
  password: z.string().min(8, 'At least 8 characters'),
});
type CustomerValues = z.infer<typeof customerSchema>;

const sellerSchema = z.object({
  fullName: z.string().min(2, 'Please enter your name'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().regex(phoneRegex).optional().or(z.literal('')),
  password: z.string().min(8, 'At least 8 characters'),
});
type SellerValues = z.infer<typeof sellerSchema>;

const otpSchema = z.object({ otp: z.string().length(6, 'Enter the 6-digit code') });
type OtpValues = z.infer<typeof otpSchema>;

function RegisterFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/';
  const initialTab: 'customer' | 'seller' = params.get('as') === 'seller' ? 'seller' : 'customer';
  const { registerCustomer, registerSeller, verifyPhone } = useAuth();

  const [tab, setTab] = useState<'customer' | 'seller'>(initialTab);
  // After a successful customer signup we flip to OTP entry. Phone is shown
  // back to the user as "OTP sent to +91…234".
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const customerForm = useForm<CustomerValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { fullName: '', email: '', phone: '', password: '' },
  });
  const sellerForm = useForm<SellerValues>({
    resolver: zodResolver(sellerSchema),
    defaultValues: { fullName: '', email: '', phone: '', password: '' },
  });
  const otpForm = useForm<OtpValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  });

  async function onCustomerSubmit(values: CustomerValues) {
    setSubmitting(true);
    try {
      const { user, otpSent } = await registerCustomer(values);
      toast.success(`Welcome, ${user.fullName ?? user.email}!`);
      setPendingPhone(values.phone);
      if (!otpSent) {
        toast.warning("OTP couldn't be sent automatically — try Resend.");
      }
    } catch (err) {
      toast.error((err as Error).message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onSellerSubmit(values: SellerValues) {
    setSubmitting(true);
    try {
      const user = await registerSeller({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        phone: values.phone?.trim() || undefined,
      });
      toast.success(`Welcome, ${user.fullName ?? user.email}!`);
      router.replace('/seller/dashboard');
    } catch (err) {
      toast.error((err as Error).message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onOtpSubmit({ otp }: OtpValues) {
    setSubmitting(true);
    try {
      await verifyPhone(otp);
      toast.success("Phone verified — you're all set.");
      router.replace(next);
    } catch (err) {
      toast.error((err as Error).message || 'OTP verification failed.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── OTP step (customer-only, after signup) ─────────────────
  if (pendingPhone) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" /> Verify your phone
          </CardTitle>
          <CardDescription>
            We sent a 6-digit code to <span className="font-medium">{pendingPhone}</span>.
            Enter it below to finish setup.
          </CardDescription>
        </CardHeader>
        <form onSubmit={otpForm.handleSubmit(onOtpSubmit)}>
          <CardContent className="space-y-4">
            <Field id="otp" label="OTP" inputMode="numeric" maxLength={6} placeholder="••••••"
              err={otpForm.formState.errors.otp?.message} {...otpForm.register('otp')} />
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & continue'}
            </Button>
            <Button type="button" variant="ghost" className="w-full text-xs"
              onClick={() => router.replace(next)}>
              Skip — verify later from your profile
            </Button>
          </CardFooter>
        </form>
      </Card>
    );
  }

  // ── Signup tabs (customer / seller) ────────────────────────
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Pick how you’ll use OffersKatta.</CardDescription>
      </CardHeader>
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'customer' | 'seller')}>
        <div className="px-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="customer">I’m a customer</TabsTrigger>
            <TabsTrigger value="seller">I’m a business</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="customer" className="mt-0">
          <form onSubmit={customerForm.handleSubmit(onCustomerSubmit)}>
            <CardContent className="space-y-4 pt-6">
              <Field id="c-name" label="Full name" autoComplete="name"
                err={customerForm.formState.errors.fullName?.message}
                {...customerForm.register('fullName')} />
              <Field id="c-email" label="Email" type="email" autoComplete="email"
                err={customerForm.formState.errors.email?.message}
                {...customerForm.register('email')} />
              <Field id="c-phone" label="Mobile number" type="tel" autoComplete="tel"
                placeholder="+91 9876543210" hint="We’ll send an OTP to verify."
                err={customerForm.formState.errors.phone?.message}
                {...customerForm.register('phone')} />
              <Field id="c-password" label="Password" type="password" autoComplete="new-password"
                err={customerForm.formState.errors.password?.message}
                {...customerForm.register('password')} />
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create customer account'}
              </Button>
              <LoginPrompt next={next} />
            </CardFooter>
          </form>
        </TabsContent>

        <TabsContent value="seller" className="mt-0">
          <form onSubmit={sellerForm.handleSubmit(onSellerSubmit)}>
            <CardContent className="space-y-4 pt-6">
              <Field id="s-name" label="Full name" autoComplete="name"
                err={sellerForm.formState.errors.fullName?.message}
                {...sellerForm.register('fullName')} />
              <Field id="s-email" label="Email" type="email" autoComplete="email"
                err={sellerForm.formState.errors.email?.message}
                {...sellerForm.register('email')} />
              <Field id="s-phone" label="Mobile number (optional)" type="tel" autoComplete="tel"
                placeholder="+91 9876543210"
                err={sellerForm.formState.errors.phone?.message}
                {...sellerForm.register('phone')} />
              <Field id="s-password" label="Password" type="password" autoComplete="new-password"
                err={sellerForm.formState.errors.password?.message}
                {...sellerForm.register('password')} />
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create business account'}
              </Button>
              <LoginPrompt next={next} />
            </CardFooter>
          </form>
        </TabsContent>
      </Tabs>
    </Card>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  err?: string;
  hint?: string;
}
const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, err, hint, id, ...rest },
  ref,
) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} ref={ref} {...rest} />
      {hint && !err ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {err ? <p className="text-xs text-destructive">{err}</p> : null}
    </div>
  );
});

function LoginPrompt({ next }: { next: string }) {
  return (
    <p className="text-center text-sm text-muted-foreground">
      Already have an account?{' '}
      <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-primary hover:underline">
        Log in
      </Link>
    </p>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <RegisterFlow />
    </Suspense>
  );
}
