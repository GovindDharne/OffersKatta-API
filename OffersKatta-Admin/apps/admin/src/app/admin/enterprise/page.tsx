'use client';

/// Super-admin Enterprise sales queue. Lists inbound "Contact Sales" leads,
/// lets sales move them through the pipeline (status + private notes), and
/// provisions the ENTERPRISE tier for the linked brand on a won deal.
///
/// Backend: apps/api/src/modules/enterprise/*
///   GET   /enterprise/leads?status=
///   PATCH /enterprise/leads/:id           { status?, internalNotes? }
///   POST  /enterprise/leads/:id/provision { brandId?, termMonths?, amount? }

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Loader2, CheckCircle2, Mail, Phone, Store } from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { timeAgo } from '@/lib/utils';

type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'WON' | 'LOST';
const STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST'];

interface Lead {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  estimatedBranches: number | null;
  message: string | null;
  status: LeadStatus;
  internalNotes: string | null;
  brandId: string | null;
  createdAt: string;
  brand?: { id: string; name: string } | null;
}

function statusVariant(s: LeadStatus) {
  if (s === 'WON') return 'success' as const;
  if (s === 'LOST') return 'destructive' as const;
  if (s === 'NEW') return 'default' as const;
  return 'secondary' as const;
}

export default function AdminEnterprisePage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<LeadStatus | 'ALL'>('ALL');

  const leadsQ = useQuery({
    queryKey: ['enterprise', 'leads', filter],
    queryFn: () =>
      apiGet<Lead[]>('/enterprise/leads', filter === 'ALL' ? undefined : { status: filter }),
  });

  // Per-lead notes drafts (so typing doesn't refetch on each keystroke).
  const [notes, setNotes] = useState<Record<string, string>>({});

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
      apiPatch(`/enterprise/leads/${id}`, { status }),
    onSuccess: () => {
      toast.success('Status updated');
      void qc.invalidateQueries({ queryKey: ['enterprise', 'leads'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const saveNotes = useMutation({
    mutationFn: ({ id, internalNotes }: { id: string; internalNotes: string }) =>
      apiPatch(`/enterprise/leads/${id}`, { internalNotes }),
    onSuccess: () => toast.success('Notes saved'),
    onError: (e) => toast.error((e as Error).message),
  });

  // Provision dialog
  const [provLead, setProvLead] = useState<Lead | null>(null);
  const [termMonths, setTermMonths] = useState('12');
  const [amount, setAmount] = useState('');
  const [brandOverride, setBrandOverride] = useState('');

  const provision = useMutation({
    mutationFn: () => {
      if (!provLead) throw new Error('No lead selected');
      const body: Record<string, unknown> = { termMonths: Number(termMonths) || 12 };
      if (amount) body.amount = Number(amount);
      const brandId = brandOverride.trim() || provLead.brandId;
      if (!brandId) throw new Error('This lead has no linked brand — paste a brand ID to provision.');
      if (brandOverride.trim()) body.brandId = brandOverride.trim();
      return apiPost(`/enterprise/leads/${provLead.id}/provision`, body);
    },
    onSuccess: () => {
      toast.success('Enterprise plan provisioned · lead marked WON');
      setProvLead(null);
      setBrandOverride('');
      setAmount('');
      setTermMonths('12');
      void qc.invalidateQueries({ queryKey: ['enterprise', 'leads'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Enterprise leads</h1>
        <Select value={filter} onValueChange={(v) => setFilter(v as LeadStatus | 'ALL')}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {leadsQ.isLoading ? (
        <Skeleton className="h-40" />
      ) : leadsQ.data && leadsQ.data.length > 0 ? (
        <div className="space-y-3">
          {leadsQ.data.map((l) => (
            <Card key={l.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> {l.companyName}
                    {l.estimatedBranches ? (
                      <span className="text-xs font-normal text-muted-foreground">
                        · ~{l.estimatedBranches} branches
                      </span>
                    ) : null}
                  </span>
                  <Badge variant={statusVariant(l.status)}>{l.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
                  <span>{l.contactName}</span>
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {l.email}</span>
                  {l.phone ? <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {l.phone}</span> : null}
                  {l.brand ? (
                    <span className="flex items-center gap-1"><Store className="h-3 w-3" /> {l.brand.name}</span>
                  ) : (
                    <span className="italic">no linked brand</span>
                  )}
                  <span>· {timeAgo(l.createdAt)}</span>
                </div>

                {l.message ? (
                  <p className="rounded border bg-muted/40 px-3 py-2 text-foreground">{l.message}</p>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                  <div className="space-y-1">
                    <Label className="text-xs">Pipeline status</Label>
                    <Select
                      value={l.status}
                      onValueChange={(v) => setStatus.mutate({ id: l.id, status: v as LeadStatus })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Internal notes</Label>
                    <div className="flex gap-2">
                      <Textarea
                        rows={1}
                        className="min-h-9"
                        defaultValue={l.internalNotes ?? ''}
                        onChange={(e) => setNotes((s) => ({ ...s, [l.id]: e.target.value }))}
                        placeholder="Private — visible to admins only"
                      />
                      <Button
                        variant="outline"
                        disabled={saveNotes.isPending}
                        onClick={() =>
                          saveNotes.mutate({ id: l.id, internalNotes: notes[l.id] ?? l.internalNotes ?? '' })
                        }
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
              <div className="flex justify-end gap-2 border-t p-3">
                <Button
                  size="sm"
                  disabled={l.status === 'WON'}
                  onClick={() => {
                    setProvLead(l);
                    setBrandOverride('');
                    setAmount('');
                    setTermMonths('12');
                  }}
                >
                  <CheckCircle2 className="mr-2 h-3 w-3" />
                  {l.status === 'WON' ? 'Provisioned' : 'Provision Enterprise'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No leads {filter === 'ALL' ? 'yet' : `in ${filter}`}.</p>
      )}

      {/* ── Provision dialog ───────────────────────────────────── */}
      <Dialog open={provLead !== null} onOpenChange={(o) => !o && setProvLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Provision Enterprise</DialogTitle>
            <DialogDescription>
              Activates the ENTERPRISE tier for{' '}
              <strong>{provLead?.brand?.name ?? provLead?.companyName}</strong> and marks this
              lead WON. Billing is handled offline — no payment is taken.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="p-term">Term (months)</Label>
                <Input id="p-term" type="number" min={1} max={120} value={termMonths}
                  onChange={(e) => setTermMonths(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="p-amount">Contract value ₹ (optional)</Label>
                <Input id="p-amount" type="number" min={0} value={amount}
                  onChange={(e) => setAmount(e.target.value)} placeholder="for reporting" />
              </div>
            </div>
            {!provLead?.brandId ? (
              <div className="space-y-1">
                <Label htmlFor="p-brand">Brand ID (required — lead has no linked brand)</Label>
                <Input id="p-brand" value={brandOverride}
                  onChange={(e) => setBrandOverride(e.target.value)} placeholder="UUID of the brand to upgrade" />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Linked brand: <span className="font-medium">{provLead.brand?.name ?? provLead.brandId}</span>.
                {' '}Paste a different brand ID below to override.
              </p>
            )}
            {provLead?.brandId ? (
              <div className="space-y-1">
                <Label htmlFor="p-brand-ovr" className="text-xs">Override brand ID (optional)</Label>
                <Input id="p-brand-ovr" value={brandOverride}
                  onChange={(e) => setBrandOverride(e.target.value)} placeholder="leave blank to use the linked brand" />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProvLead(null)}>Cancel</Button>
            <Button onClick={() => provision.mutate()} disabled={provision.isPending}>
              {provision.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Provisioning…</> : 'Provision'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
