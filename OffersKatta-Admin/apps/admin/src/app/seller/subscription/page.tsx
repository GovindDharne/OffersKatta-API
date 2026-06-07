'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Loader2, Building2 } from 'lucide-react';
import { apiGet, apiGetPaginated, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/utils';
import { loadRazorpay } from '@/lib/razorpay';

type PlanName = 'FREE' | 'PREMIUM' | 'FEATURED' | 'ENTERPRISE';
interface Plan {
  plan: PlanName;
  monthly: number | null;
  yearly: number | null;
  currency: string;
  contactSales: boolean;
}
interface Brand { id: string; name: string }
interface Subscription {
  id: string;
  plan: PlanName;
  status: string;
  startDate: string;
  endDate: string | null;
  amount: number;
  currency: string;
  billingInterval: 'MONTHLY' | 'YEARLY';
}
interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description?: string | null;
  createdAt: string;
  paidAt?: string | null;
}

export default function SubscriptionPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const brandsQ = useQuery({ queryKey: ['brands', 'mine'], queryFn: () => apiGetPaginated<Brand>('/brands/mine', { limit: 50 }) });
  const [brandId, setBrandId] = useState<string>('');
  const [interval, setInterval] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [processing, setProcessing] = useState<string | null>(null);

  // Contact-Sales (Enterprise) lead dialog
  const [salesOpen, setSalesOpen] = useState(false);
  const [salesBusy, setSalesBusy] = useState(false);
  const emptyLead = { companyName: '', contactName: '', email: '', phone: '', estimatedBranches: '', message: '' };
  const [lead, setLead] = useState(emptyLead);

  const plansQ = useQuery({ queryKey: ['plans'], queryFn: () => apiGet<Plan[]>('/subscriptions/plans') });
  const cfgQ = useQuery({
    queryKey: ['payments-config'],
    queryFn: () => apiGet<{ enabled: boolean; keyId: string | null }>('/payments/config'),
  });
  const subQ = useQuery({
    queryKey: ['subscription', brandId],
    queryFn: () => apiGet<Subscription | null>(`/subscriptions/${brandId}`),
    enabled: Boolean(brandId),
  });
  const paymentsQ = useQuery({
    queryKey: ['payments', brandId],
    queryFn: () => apiGet<Payment[]>(`/payments/brand/${brandId}`),
    enabled: Boolean(brandId),
  });

  async function choosePlan(p: Plan) {
    if (!brandId || processing) return;
    setProcessing(p.plan);
    try {
      // 1. Record the plan choice — paid plans come back TRIALING until paid.
      const res = await apiPost<{ subscription: Subscription; amount: number }>('/subscriptions/change', {
        brandId, plan: p.plan, billingInterval: interval,
      });
      qc.invalidateQueries({ queryKey: ['subscription', brandId] });

      // 2. Free plan — no payment needed.
      if (res.amount <= 0) {
        toast.success('Plan updated');
        return;
      }

      // 3. Paid plan — needs Razorpay.
      const cfg = cfgQ.data;
      if (!cfg?.enabled || !cfg.keyId) {
        toast.error('Online payments are not configured yet. Please contact the administrator.');
        return;
      }
      const sdkReady = await loadRazorpay();
      if (!sdkReady || !window.Razorpay) {
        toast.error('Could not load the payment gateway. Check your internet connection and try again.');
        return;
      }
      const Razorpay = window.Razorpay;

      // 4. Create a Razorpay order on the server.
      const created = await apiPost<{ order: { id: string; amount: number; currency: string } }>(
        '/payments/create-order',
        { brandId, amount: res.amount, description: `${p.plan} subscription (${interval.toLowerCase()})` },
      );

      // 5. Open Checkout.
      const rzp = new Razorpay({
        key: cfg.keyId,
        order_id: created.order.id,
        amount: created.order.amount,
        currency: created.order.currency,
        name: 'OffersKatta',
        description: `${p.plan} subscription — ${interval.toLowerCase()}`,
        prefill: { name: user?.fullName ?? undefined, email: user?.email ?? undefined },
        theme: { color: '#0f172a' },
        handler: (resp) => {
          // 6. Verify the signature server-side; this activates the subscription.
          void (async () => {
            try {
              await apiPost('/payments/verify', {
                razorpayOrderId: resp.razorpay_order_id,
                razorpayPaymentId: resp.razorpay_payment_id,
                razorpaySignature: resp.razorpay_signature,
              });
              toast.success('Payment successful — your plan is now active');
              qc.invalidateQueries({ queryKey: ['subscription', brandId] });
              qc.invalidateQueries({ queryKey: ['payments', brandId] });
            } catch (e) {
              toast.error(`Payment received but verification failed: ${(e as Error).message}`);
            }
          })();
        },
        modal: { ondismiss: () => toast('Payment cancelled — your plan was not activated') },
      });
      rzp.on('payment.failed', () => toast.error('Payment failed. Please try again.'));
      rzp.open();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProcessing(null);
    }
  }

  function openSales() {
    // Prefill from the selected brand + signed-in user so the form is mostly done.
    const brandName = brandsQ.data?.data.find((b) => b.id === brandId)?.name ?? '';
    setLead({
      ...emptyLead,
      companyName: brandName,
      contactName: user?.fullName ?? '',
      email: user?.email ?? '',
    });
    setSalesOpen(true);
  }

  async function submitLead() {
    if (salesBusy) return;
    if (lead.companyName.trim().length < 2 || lead.contactName.trim().length < 2 || !lead.email.trim()) {
      toast.error('Company, contact name and email are required');
      return;
    }
    setSalesBusy(true);
    try {
      await apiPost('/enterprise/leads', {
        companyName: lead.companyName.trim(),
        contactName: lead.contactName.trim(),
        email: lead.email.trim(),
        phone: lead.phone.trim() || undefined,
        estimatedBranches: lead.estimatedBranches ? Number(lead.estimatedBranches) : undefined,
        message: lead.message.trim() || undefined,
        brandId: brandId || undefined,
      });
      toast.success('Thanks! Our sales team will reach out shortly.');
      setSalesOpen(false);
      setLead(emptyLead);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalesBusy(false);
    }
  }

  const sub = subQ.data;
  const hasActiveSub = Boolean(
    sub && sub.status === 'ACTIVE' && sub.endDate && new Date(sub.endDate) > new Date(),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Subscription &amp; billing</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select brand</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Select value={brandId} onValueChange={setBrandId}>
              <SelectTrigger className="w-72"><SelectValue placeholder="Select brand" /></SelectTrigger>
              <SelectContent>
                {brandsQ.data?.data.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Select value={interval} onValueChange={(v) => setInterval(v as 'MONTHLY' | 'YEARLY')}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
                <SelectItem value="YEARLY">Yearly (save 17%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {cfgQ.data && !cfgQ.data.enabled ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Online payments aren&apos;t configured on this server yet — paid plans can be selected but not activated until
          Razorpay keys are added.
        </div>
      ) : null}

      {brandId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current plan</CardTitle>
          </CardHeader>
          <CardContent>
            {subQ.isLoading ? (
              <Skeleton className="h-16" />
            ) : subQ.data ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-semibold">{subQ.data.plan}</p>
                  <p className="text-xs text-muted-foreground">
                    {subQ.data.status.toLowerCase()} · {formatCurrency(subQ.data.amount, subQ.data.currency)} / {subQ.data.billingInterval.toLowerCase()}
                    {subQ.data.endDate ? ` · renews ${formatDate(subQ.data.endDate)}` : ''}
                  </p>
                </div>
                <Badge variant={subQ.data.status === 'ACTIVE' ? 'success' : 'secondary'}>{subQ.data.status}</Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No subscription yet.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {hasActiveSub ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This brand has an active subscription until {formatDate(sub!.endDate!)}. You can renew or
          change the plan once it expires.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {plansQ.data?.map((p) => {
          const isCurrent = subQ.data?.plan === p.plan && subQ.data?.status === 'ACTIVE';
          const price = interval === 'MONTHLY' ? p.monthly : p.yearly;
          const lockedByActive = hasActiveSub;

          // ── Enterprise / Contact-Sales card ──────────────────
          if (p.contactSales) {
            return (
              <Card key={p.plan} className="border-dashed">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> {p.plan}
                  </CardTitle>
                  <CardDescription>Custom pricing</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Everything in Featured</p>
                  <p className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Region/zone management at scale</p>
                  <p className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Top push priority &amp; bulk onboarding</p>
                  <p className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Dedicated account manager</p>
                </CardContent>
                <CardFooter>
                  {isCurrent ? (
                    <Button className="w-full" variant="outline" disabled>Current plan</Button>
                  ) : (
                    <Button className="w-full" onClick={openSales}>Contact Sales</Button>
                  )}
                </CardFooter>
              </Card>
            );
          }

          // ── Self-serve cards (FREE / PREMIUM / FEATURED) ─────
          return (
            <Card key={p.plan} className={p.plan === 'PREMIUM' ? 'border-primary' : ''}>
              <CardHeader>
                <CardTitle>{p.plan}</CardTitle>
                <CardDescription>
                  {formatCurrency(price ?? 0, p.currency)} / {interval.toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> {p.plan === 'FREE' ? '1 branch' : p.plan === 'PREMIUM' ? 'Unlimited branches' : 'Featured placement'}</p>
                <p className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> {p.plan === 'FREE' ? '3 offers/month' : 'Unlimited offers'}</p>
                <p className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> {p.plan === 'FEATURED' ? 'Top of search' : 'Standard ranking'}</p>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={p.plan === 'PREMIUM' ? 'default' : 'outline'}
                  disabled={!brandId || processing !== null || isCurrent || lockedByActive}
                  onClick={() => choosePlan(p)}
                >
                  {processing === p.plan ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
                  ) : isCurrent ? (
                    'Current plan'
                  ) : lockedByActive ? (
                    'Subscription active'
                  ) : (price ?? 0) > 0 ? (
                    'Subscribe'
                  ) : (
                    'Choose'
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {brandId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment history</CardTitle>
            <CardDescription>Razorpay transactions for this brand.</CardDescription>
          </CardHeader>
          <CardContent>
            {paymentsQ.isLoading ? (
              <Skeleton className="h-16" />
            ) : paymentsQ.data && paymentsQ.data.length > 0 ? (
              <ul className="divide-y text-sm">
                {paymentsQ.data.map((pay) => (
                  <li key={pay.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">{formatCurrency(pay.amount, pay.currency)}</p>
                      <p className="text-xs text-muted-foreground">
                        {pay.description ?? 'Payment'} · {formatDate(pay.paidAt ?? pay.createdAt)}
                      </p>
                    </div>
                    <Badge variant={paymentVariant(pay.status)}>{pay.status.toLowerCase()}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* ── Contact Sales (Enterprise) lead dialog ─────────────── */}
      <Dialog open={salesOpen} onOpenChange={setSalesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Talk to sales about Enterprise</DialogTitle>
            <DialogDescription>
              Tell us a bit about your business and we&apos;ll get in touch to set up a
              custom Enterprise plan. No payment is taken here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="l-company">Company</Label>
                <Input id="l-company" value={lead.companyName}
                  onChange={(e) => setLead((s) => ({ ...s, companyName: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="l-contact">Contact name</Label>
                <Input id="l-contact" value={lead.contactName}
                  onChange={(e) => setLead((s) => ({ ...s, contactName: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="l-email">Email</Label>
                <Input id="l-email" type="email" value={lead.email}
                  onChange={(e) => setLead((s) => ({ ...s, email: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="l-phone">Phone (optional)</Label>
                <Input id="l-phone" value={lead.phone}
                  onChange={(e) => setLead((s) => ({ ...s, phone: e.target.value }))} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label htmlFor="l-branches">Approx. number of stores/branches (optional)</Label>
                <Input id="l-branches" type="number" min={1} value={lead.estimatedBranches}
                  onChange={(e) => setLead((s) => ({ ...s, estimatedBranches: e.target.value }))} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label htmlFor="l-msg">Anything else? (optional)</Label>
                <Textarea id="l-msg" rows={3} value={lead.message}
                  onChange={(e) => setLead((s) => ({ ...s, message: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalesOpen(false)}>Cancel</Button>
            <Button onClick={submitLead} disabled={salesBusy}>
              {salesBusy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</> : 'Send enquiry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function paymentVariant(status: string) {
  if (status === 'SUCCESS') return 'success' as const;
  if (status === 'FAILED') return 'destructive' as const;
  return 'secondary' as const;
}
