'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import Link from 'next/link';
import { Plus, ExternalLink, Trash2, Pencil, Rocket, ImagePlus, Loader2, X, Bell, ChevronDown } from 'lucide-react';
import { api, apiGet, apiGetPaginated, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { CitySelect } from '@/components/city-select';
import { formatDate } from '@/lib/utils';
import { MediaUploader } from '@/components/media-uploader';
import { loadRazorpay } from '@/lib/razorpay';
import { useAuth } from '@/lib/auth-context';

interface BrandRow { id: string; name: string }
interface BranchRow { id: string; name: string; brandId: string }

interface OfferRow {
  id: string; title: string; status: string; offerType: string; discountValue: number;
  startsAt: string; expiresAt: string; totalRedemptions: number; viewCount: number;
  isFeatured?: boolean; featuredUntil?: string | null;
  branch?: { id: string; name: string; brand?: { id: string; name: string } };
}

interface BoostOption { days: number; price: number; currency: string }

// Full offer shape returned by GET /offers/:id — used to populate the edit form.
interface FullOffer {
  id: string;
  branchId: string;
  title: string;
  titleHindi?: string | null;
  description?: string | null;
  descriptionRegional?: string | null;
  termsAndConditions?: string | null;
  offerType: string;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minPurchaseAmount?: number | null;
  couponCode?: string | null;
  startsAt: string;
  expiresAt: string;
  status: string;
  isFeatured: boolean;
  isStackable: boolean;
  priority: number;
  visibility: string;
  applicableProducts?: string | null;
  excludedProducts?: string | null;
  tags: string[];
  maxRedemptions?: number | null;
  redemptionPerUser?: number | null;
  images: string[];
  videoUrl?: string | null;
  listImage?: string | null;
  isRecurring: boolean;
  recurringDays: number[];
  recurringStartTime?: string | null;
  recurringEndTime?: string | null;
  cardTypes: Array<{
    cardTypeId: string;
    cardCategory?: string | null;
    benefitType?: string | null;
    benefitValue?: string | null;
    minSpend?: number | null;
    maxBenefit?: number | null;
  }>;
  branches: Array<{ branchId: string }>;
  platforms: Array<{ platformName: string; url?: string | null }>;
  categories?: Array<{ category: { id: string; name: string } }>;
  scope?: 'BRANCH' | 'BRAND' | 'CITY' | 'TAGS';
  scopeCity?: string | null;
  scopeTags?: string[];
}

const OFFER_TYPES = ['PERCENTAGE', 'FLAT', 'BUY_ONE_GET_ONE', 'FREE_ITEM', 'BUNDLE'] as const;
const STATUSES = ['DRAFT', 'PUBLISHED', 'PAUSED', 'EXPIRED', 'ARCHIVED'] as const;
const VISIBILITIES = ['PUBLIC', 'MEMBERS', 'NEW_CUSTOMERS', 'REFERRAL'] as const;
const BENEFIT_TYPES = ['Cashback', 'Discount', 'No-cost EMI', 'Extra Off', 'Reward Points'] as const;

const VISIBILITY_LABEL: Record<(typeof VISIBILITIES)[number], string> = {
  PUBLIC: 'Public — everyone',
  MEMBERS: 'Members only',
  NEW_CUSTOMERS: 'New customers',
  REFERRAL: 'Referral only',
};

const TIME_RX = /^([01]\d|2[0-3]):[0-5]\d$/;

// Empty numeric input → undefined (so optional fields aren't coerced to 0).
const numOpt = {
  setValueAs: (v: unknown) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
};

const cardOfferSchema = z.object({
  cardTypeId: z.string().uuid(),
  cardCategory: z.string().optional(),
  benefitType: z.string().optional(),
  benefitValue: z.string().optional(),
  minSpend: z.number().min(0).optional(),
  maxBenefit: z.number().min(0).optional(),
});
type CardOfferValue = z.infer<typeof cardOfferSchema>;

const platformSchema = z.object({
  platformName: z.string(),
  url: z.string().optional(),
});
type PlatformValue = z.infer<typeof platformSchema>;

const schema = z.object({
  branchId: z.string().uuid('Select a branch'),
  branchIds: z.array(z.string().uuid()).default([]),
  title: z.string().min(3),
  titleHindi: z.string().optional(),
  description: z.string().optional(),
  descriptionRegional: z.string().optional(),
  termsAndConditions: z.string().optional(),
  offerType: z.enum(OFFER_TYPES),
  discountValue: z.coerce.number().positive(),
  maxDiscountAmount: z.number().min(0).optional(),
  minPurchaseAmount: z.number().min(0).optional(),
  couponCode: z.string().optional(),
  startsAt: z.string(),
  expiresAt: z.string(),
  status: z.enum(STATUSES).default('DRAFT'),
  isStackable: z.boolean().default(false),
  priority: z.coerce.number().int().min(1).max(10).default(5),
  visibility: z.enum(VISIBILITIES).default('PUBLIC'),
  applicableProducts: z.string().optional(),
  excludedProducts: z.string().optional(),
  tags: z.string().optional(),
  maxRedemptions: z.number().int().positive().optional(),
  redemptionPerUser: z.number().int().positive().optional(),
  images: z.array(z.string()).max(10).default([]),
  videoUrl: z.string().optional().nullable(),
  listImage: z.string().optional().nullable(),
  isRecurring: z.boolean().default(false),
  recurringDays: z.array(z.number().int().min(0).max(6)).default([]),
  recurringStartTime: z.string().regex(TIME_RX).optional().or(z.literal('')),
  recurringEndTime: z.string().regex(TIME_RX).optional().or(z.literal('')),
  cardOffers: z.array(cardOfferSchema).default([]),
  platforms: z.array(platformSchema).default([]),
  categoryIds: z.array(z.string()).default([]),
  // Scope: how this offer spreads across the brand's branches.
  scope: z.enum(['BRANCH', 'BRAND', 'CITY', 'TAGS']).default('BRANCH'),
  scopeCity: z.string().optional(),
  scopeTags: z.array(z.string()).default([]),
});
type FormValues = z.infer<typeof schema>;

interface BankRow {
  id: string;
  name: string;
  slug: string;
  cards: Array<{ id: string; name: string; category: string; network?: string | null }>;
}

const DAYS = [
  { value: 1, short: 'Mon' },
  { value: 2, short: 'Tue' },
  { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' },
  { value: 5, short: 'Fri' },
  { value: 6, short: 'Sat' },
  { value: 0, short: 'Sun' },
];

function blankForm(): FormValues {
  return {
    branchId: '', branchIds: [], title: '', titleHindi: '',
    description: '', descriptionRegional: '', termsAndConditions: '',
    offerType: 'PERCENTAGE', discountValue: 10,
    maxDiscountAmount: undefined, minPurchaseAmount: undefined, couponCode: '',
    isStackable: false, priority: 5, visibility: 'PUBLIC',
    applicableProducts: '', excludedProducts: '', tags: '',
    maxRedemptions: undefined, redemptionPerUser: undefined,
    status: 'DRAFT', startsAt: today(), expiresAt: addDays(today(), 30),
    images: [], videoUrl: null, listImage: null,
    isRecurring: false, recurringDays: [], recurringStartTime: '', recurringEndTime: '',
    cardOffers: [], platforms: [], categoryIds: [],
    scope: 'BRANCH', scopeCity: '', scopeTags: [],
  };
}

function offerToForm(o: FullOffer): FormValues {
  return {
    branchId: o.branchId,
    branchIds: o.branches.map((b) => b.branchId),
    title: o.title,
    titleHindi: o.titleHindi ?? '',
    description: o.description ?? '',
    descriptionRegional: o.descriptionRegional ?? '',
    termsAndConditions: o.termsAndConditions ?? '',
    offerType: o.offerType as FormValues['offerType'],
    discountValue: o.discountValue,
    maxDiscountAmount: o.maxDiscountAmount ?? undefined,
    minPurchaseAmount: o.minPurchaseAmount ?? undefined,
    couponCode: o.couponCode ?? '',
    startsAt: o.startsAt.slice(0, 10),
    expiresAt: o.expiresAt.slice(0, 10),
    status: o.status as FormValues['status'],
    isStackable: o.isStackable,
    priority: o.priority,
    visibility: o.visibility as FormValues['visibility'],
    applicableProducts: o.applicableProducts ?? '',
    excludedProducts: o.excludedProducts ?? '',
    tags: (o.tags ?? []).join(', '),
    maxRedemptions: o.maxRedemptions ?? undefined,
    redemptionPerUser: o.redemptionPerUser ?? undefined,
    images: o.images ?? [],
    videoUrl: o.videoUrl ?? null,
    listImage: o.listImage ?? null,
    isRecurring: o.isRecurring,
    recurringDays: o.recurringDays ?? [],
    recurringStartTime: o.recurringStartTime ?? '',
    recurringEndTime: o.recurringEndTime ?? '',
    cardOffers: (o.cardTypes ?? []).map((c) => ({
      cardTypeId: c.cardTypeId,
      cardCategory: c.cardCategory ?? undefined,
      benefitType: c.benefitType ?? undefined,
      benefitValue: c.benefitValue ?? undefined,
      minSpend: c.minSpend ?? undefined,
      maxBenefit: c.maxBenefit ?? undefined,
    })),
    platforms: (o.platforms ?? []).map((p) => ({ platformName: p.platformName, url: p.url ?? '' })),
    categoryIds: (o.categories ?? []).map((c) => c.category.id),
    scope: o.scope ?? 'BRANCH',
    scopeCity: o.scopeCity ?? '',
    scopeTags: o.scopeTags ?? [],
  };
}

// Form values → API payload (shared by create + update).
function buildPayload(v: FormValues) {
  const tags = (v.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 15);
  return {
    branchId: v.branchId,
    // branchIds is set below based on scope (see the conditional override).
    title: v.title,
    titleHindi: v.titleHindi || undefined,
    description: v.description || undefined,
    descriptionRegional: v.descriptionRegional || undefined,
    termsAndConditions: v.termsAndConditions || undefined,
    offerType: v.offerType,
    discountValue: v.discountValue,
    maxDiscountAmount: v.maxDiscountAmount,
    minPurchaseAmount: v.minPurchaseAmount,
    couponCode: v.couponCode || undefined,
    startsAt: v.startsAt,
    expiresAt: v.expiresAt,
    status: v.status,
    isStackable: v.isStackable,
    priority: v.priority,
    visibility: v.visibility,
    applicableProducts: v.applicableProducts || undefined,
    excludedProducts: v.excludedProducts || undefined,
    tags,
    maxRedemptions: v.maxRedemptions,
    redemptionPerUser: v.redemptionPerUser,
    images: v.images,
    videoUrl: v.videoUrl || undefined,
    listImage: v.listImage || undefined,
    isRecurring: v.isRecurring,
    recurringDays: v.isRecurring ? v.recurringDays : [],
    recurringStartTime: v.isRecurring && v.recurringStartTime ? v.recurringStartTime : undefined,
    recurringEndTime: v.isRecurring && v.recurringEndTime ? v.recurringEndTime : undefined,
    scope: v.scope,
    scopeCity: v.scope === 'CITY' ? v.scopeCity?.trim() || undefined : undefined,
    scopeTags: v.scope === 'TAGS' ? (v.scopeTags ?? []).map((t) => t.trim()).filter(Boolean) : [],
    // When the scope isn't explicit-BRANCH the additional-branch list is moot;
    // the server resolves the branch set from scope+brand instead.
    branchIds: v.scope === 'BRANCH' ? v.branchIds.filter((id) => id !== v.branchId) : [],
    cardOffers: (v.cardOffers ?? []).map((c) => ({
      cardTypeId: c.cardTypeId,
      cardCategory: c.cardCategory && c.cardCategory !== 'Any' ? c.cardCategory : undefined,
      benefitType: c.benefitType || undefined,
      benefitValue: c.benefitValue || undefined,
      minSpend: c.minSpend,
      maxBenefit: c.maxBenefit,
    })),
    platforms: (v.platforms ?? [])
      .filter((p) => p.platformName.trim().length >= 2)
      .map((p) => ({ platformName: p.platformName.trim(), url: p.url || undefined })),
    categoryIds: v.categoryIds ?? [],
  };
}

// Single-image upload for the offer-card thumbnail (separate from the gallery
// `images[]` shown on the detail page).
function ListImageUploader({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post<{ success: boolean; data: { url: string }; error?: { message: string } }>(
        '/uploads/file',
        form,
        { headers: { 'Content-Type': null as unknown as string } },
      );
      if (!res.data.success) throw new Error(res.data.error?.message ?? 'Upload failed');
      onChange(res.data.data.url);
      toast.success('List thumbnail uploaded.');
    } catch (e) {
      toast.error(`Thumbnail upload failed: ${(e as Error).message}`);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          List thumbnail <span className="text-muted-foreground">(optional, single image)</span>
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading
            ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Uploading…</>
            : <><ImagePlus className="mr-2 h-3 w-3" /> {value ? 'Replace' : 'Add thumbnail'}</>}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
        />
      </div>
      {value ? (
        <div className="group relative aspect-[16/9] w-full max-w-xs overflow-hidden rounded-md border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="List thumbnail" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
            aria-label="Remove thumbnail"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Shown on the offer card in lists/grids. The detail page is unaffected.
        </p>
      )}
    </div>
  );
}

export default function SellerOffersPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [boosting, setBoosting] = useState<OfferRow | null>(null);
  const [boostingDays, setBoostingDays] = useState<number | null>(null);
  // "Notify nearby" dialog target — Phase 4 push pipeline.
  const [notifying, setNotifying] = useState<OfferRow | null>(null);
  const [notifyRadius, setNotifyRadius] = useState<5 | 10 | 25>(5);
  const [notifyAudience, setNotifyAudience] = useState<'BOTH' | 'NEARBY' | 'FOLLOWERS'>('BOTH');
  const [notifySending, setNotifySending] = useState(false);
  // Card-offer picker: which bank/card the user is about to add. These
  // are local to the picker — `cardOffers` in the form holds the committed
  // selection plus per-card benefit detail.
  const [pickBankId, setPickBankId] = useState<string>('');
  const [pickCardId, setPickCardId] = useState<string>('');
  const isEditing = editing !== null;

  const brandsQ = useQuery({ queryKey: ['brands', 'mine'], queryFn: () => apiGetPaginated<BrandRow>('/brands/mine', { limit: 50 }) });
  const branchesQ = useQuery({
    queryKey: ['branches', 'all'],
    queryFn: async () => {
      const brands = brandsQ.data?.data ?? [];
      const all: BranchRow[] = [];
      for (const b of brands) {
        const r = await apiGetPaginated<BranchRow>('/branches', { brandId: b.id, limit: 50 });
        all.push(...r.data);
      }
      return all;
    },
    enabled: Boolean(brandsQ.data),
  });
  const offersQ = useQuery({
    queryKey: ['offers', 'mine'],
    queryFn: async () => {
      const brands = brandsQ.data?.data ?? [];
      const rows: OfferRow[] = [];
      for (const b of brands) {
        const r = await apiGetPaginated<OfferRow>('/offers', { brandId: b.id, limit: 100 });
        rows.push(...r.data);
      }
      return rows;
    },
    enabled: Boolean(brandsQ.data),
  });

  const banksQ = useQuery({
    queryKey: ['banks'],
    queryFn: () => apiGet<BankRow[]>('/banks'),
  });

  const categoriesQ = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiGet<Array<{ id: string; name: string }>>('/categories'),
  });

  const paymentCfgQ = useQuery({
    queryKey: ['payments-config'],
    queryFn: () => apiGet<{ enabled: boolean; keyId: string | null }>('/payments/config'),
  });
  const boostOptionsQ = useQuery({
    queryKey: ['boost-options'],
    queryFn: () => apiGet<BoostOption[]>('/payments/boost/options'),
  });

  // Full offer fetched only when editing.
  const editQ = useQuery({
    queryKey: ['offer-edit', editing],
    queryFn: () => apiGet<FullOffer>(`/offers/${editing}`),
    enabled: Boolean(editing),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // cardTypeId → "Bank · Card" label, for the benefit-detail rows.
  const cardLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const bank of banksQ.data ?? []) {
      for (const c of bank.cards) m.set(c.id, `${bank.name} · ${c.name}`);
    }
    return m;
  }, [banksQ.data]);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: blankForm() });

  // Populate the form exactly once per open: blank for create, the loaded
  // offer for edit. The ref guards against a refetch clobbering user edits.
  const populatedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!open) { populatedFor.current = null; return; }
    if (editing) {
      if (editQ.data && populatedFor.current !== editing) {
        form.reset(offerToForm(editQ.data));
        populatedFor.current = editing;
      }
    } else if (populatedFor.current !== '__create__') {
      form.reset(blankForm());
      populatedFor.current = '__create__';
    }
  }, [open, editing, editQ.data, form]);

  const openCreate = () => { setEditing(null); setOpen(true); };
  const openEdit = (id: string) => { setEditing(id); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); };

  const cardOffers = form.watch('cardOffers') ?? [];
  const platforms = form.watch('platforms') ?? [];
  const branchIds = form.watch('branchIds') ?? [];
  const primaryBranch = form.watch('branchId');

  function addPickedCard() {
    if (!pickCardId) return;
    const cur = form.getValues('cardOffers') ?? [];
    if (cur.some((c) => c.cardTypeId === pickCardId)) {
      // already added — just reset the picker
      setPickBankId('');
      setPickCardId('');
      return;
    }
    form.setValue(
      'cardOffers',
      [...cur, { cardTypeId: pickCardId, benefitType: 'Cashback', benefitValue: '' }],
      { shouldDirty: true },
    );
    setPickBankId('');
    setPickCardId('');
  }
  function removeCardOffer(cardTypeId: string) {
    const cur = form.getValues('cardOffers') ?? [];
    form.setValue('cardOffers', cur.filter((c) => c.cardTypeId !== cardTypeId), { shouldDirty: true });
  }
  function updateCardOffer(cardTypeId: string, patch: Partial<CardOfferValue>) {
    const cur = form.getValues('cardOffers') ?? [];
    form.setValue('cardOffers', cur.map((c) => (c.cardTypeId === cardTypeId ? { ...c, ...patch } : c)), { shouldDirty: true });
  }

  function addPlatform() {
    form.setValue('platforms', [...(form.getValues('platforms') ?? []), { platformName: '', url: '' }], { shouldDirty: true });
  }
  function updatePlatform(idx: number, patch: Partial<PlatformValue>) {
    const cur = [...(form.getValues('platforms') ?? [])];
    cur[idx] = { ...cur[idx], ...patch };
    form.setValue('platforms', cur, { shouldDirty: true });
  }
  function removePlatform(idx: number) {
    form.setValue('platforms', (form.getValues('platforms') ?? []).filter((_, i) => i !== idx), { shouldDirty: true });
  }

  function toggleBranch(id: string, checked: boolean) {
    const cur = form.getValues('branchIds') ?? [];
    form.setValue('branchIds', checked ? [...new Set([...cur, id])] : cur.filter((b) => b !== id), { shouldDirty: true });
  }

  const create = useMutation({
    mutationFn: (v: FormValues) => apiPost('/offers', buildPayload(v)),
    onSuccess: () => {
      toast.success('Offer created');
      closeDialog();
      qc.invalidateQueries({ queryKey: ['offers', 'mine'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: (v: FormValues) => apiPatch(`/offers/${editing}`, buildPayload(v)),
    onSuccess: () => {
      toast.success('Offer updated');
      closeDialog();
      qc.invalidateQueries({ queryKey: ['offers', 'mine'] });
      qc.invalidateQueries({ queryKey: ['offer'] });
      qc.invalidateQueries({ queryKey: ['offer-edit'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const togglePublish = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiPatch(`/offers/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['offers', 'mine'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/offers/${id}`),
    onSuccess: () => { toast.success('Offer archived'); qc.invalidateQueries({ queryKey: ['offers', 'mine'] }); },
  });

  // Pay to feature an offer for a chosen number of days.
  async function boost(offer: OfferRow, days: number) {
    if (boostingDays !== null) return;
    setBoostingDays(days);
    try {
      const cfg = paymentCfgQ.data;
      if (!cfg?.enabled || !cfg.keyId) {
        toast.error('Online payments are not configured yet. Please contact the administrator.');
        return;
      }
      const sdkReady = await loadRazorpay();
      if (!sdkReady || !window.Razorpay) {
        toast.error('Could not load the payment gateway. Check your connection and try again.');
        return;
      }
      const Razorpay = window.Razorpay;
      const created = await apiPost<{ order: { id: string; amount: number; currency: string } }>(
        '/payments/boost/create-order',
        { offerId: offer.id, days },
      );
      const rzp = new Razorpay({
        key: cfg.keyId,
        order_id: created.order.id,
        amount: created.order.amount,
        currency: created.order.currency,
        name: 'OffersKatta',
        description: `Boost: ${offer.title} (${days} days featured)`,
        prefill: { name: user?.fullName ?? undefined, email: user?.email ?? undefined },
        theme: { color: '#0f172a' },
        handler: (resp) => {
          void (async () => {
            try {
              await apiPost('/payments/verify', {
                razorpayOrderId: resp.razorpay_order_id,
                razorpayPaymentId: resp.razorpay_payment_id,
                razorpaySignature: resp.razorpay_signature,
              });
              toast.success('Offer boosted — it is now featured');
              setBoosting(null);
              qc.invalidateQueries({ queryKey: ['offers', 'mine'] });
            } catch (e) {
              toast.error(`Payment verification failed: ${(e as Error).message}`);
            }
          })();
        },
        modal: { ondismiss: () => toast('Payment cancelled') },
      });
      rzp.on('payment.failed', () => toast.error('Payment failed. Please try again.'));
      setBoosting(null);
      rzp.open();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBoostingDays(null);
    }
  }

  const submitting = create.isPending || update.isPending;
  const onSubmit = form.handleSubmit((v) => (isEditing ? update.mutate(v) : create.mutate(v)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Offers</h1>
        <Button disabled={(branchesQ.data?.length ?? 0) === 0} onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New offer
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit offer' : 'Create offer'}</DialogTitle>
          </DialogHeader>
          {isEditing && editQ.isLoading ? (
            <div className="space-y-3 py-6">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : isEditing && editQ.isError ? (
            <p className="py-6 text-sm text-destructive">Could not load this offer. Please close and try again.</p>
          ) : (
            <form onSubmit={onSubmit} className="flex max-h-[calc(90vh-8rem)] flex-col">
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {/* ── Scope (Phase 3) — how the offer spreads across the brand ── */}
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <Label className="text-sm font-medium">Where does this offer apply?</Label>
                <ScopePicker
                  value={form.watch('scope')}
                  onChange={(s) => form.setValue('scope', s, { shouldDirty: true })}
                />
              </div>

              <div className="space-y-2">
                <Label>{form.watch('scope') === 'BRANCH' ? 'Branch' : 'Anchor branch'}</Label>
                {form.watch('scope') !== 'BRANCH' ? (
                  <p className="text-xs text-muted-foreground">
                    Pick any branch as the geographic anchor for this offer. The actual
                    branches reached are resolved by the scope you picked above.
                  </p>
                ) : null}
                <Select value={form.watch('branchId')} onValueChange={(v) => form.setValue('branchId', v)}>
                  <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>
                    {branchesQ.data?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.formState.errors.branchId && <p className="text-xs text-destructive">{form.formState.errors.branchId.message}</p>}
              </div>

              {/* Conditional scope inputs */}
              {form.watch('scope') === 'CITY' ? (
                <div className="space-y-2">
                  <Label htmlFor="scopeCity">City</Label>
                  <CitySelect
                    id="scopeCity"
                    value={form.watch('scopeCity') ?? ''}
                    onChange={(v) => form.setValue('scopeCity', v, { shouldDirty: true })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Case-insensitive match against each branch&apos;s city. Pick the city
                    of your branches so the offer reaches them.
                  </p>
                </div>
              ) : null}

              {form.watch('scope') === 'TAGS' ? (
                <div className="space-y-2">
                  <Label htmlFor="scopeTags">Branch tags</Label>
                  <Input
                    id="scopeTags"
                    placeholder="flagship, metro, tier-2"
                    defaultValue={(form.watch('scopeTags') ?? []).join(', ')}
                    onChange={(e) => form.setValue(
                      'scopeTags',
                      e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                      { shouldDirty: true },
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    Applies to every branch in the brand whose tags overlap with any of these.
                    Add tags on each branch from the Branches page.
                  </p>
                </div>
              ) : null}

              {/* Additional branches — only shown for explicit BRANCH scope */}
              {form.watch('scope') === 'BRANCH'
                && (branchesQ.data?.filter((b) => b.id !== primaryBranch).length ?? 0) > 0 ? (
                <div className="space-y-1">
                  <Label className="text-xs">Also applies to (optional)</Label>
                  <div className="flex flex-wrap gap-1">
                    {branchesQ.data?.filter((b) => b.id !== primaryBranch).map((b) => {
                      const active = branchIds.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => toggleBranch(b.id, !active)}
                          className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                            active ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background hover:bg-accent'
                          }`}
                        >
                          {b.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" {...form.register('title')} />
                  {form.formState.errors.title && <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="titleHindi">Title (Hindi) — optional</Label>
                  <Input id="titleHindi" {...form.register('titleHindi')} placeholder="सभी पर 20% छूट" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea rows={2} {...form.register('description')} />
              </div>
              <div className="space-y-2">
                <Label>Description (regional) — optional</Label>
                <Textarea rows={2} {...form.register('descriptionRegional')} placeholder="ऑफ़र का विवरण" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.watch('offerType')} onValueChange={(v) => form.setValue('offerType', v as FormValues['offerType'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OFFER_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ').toLowerCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discountValue">Discount value</Label>
                  <Input id="discountValue" type="number" step="any" {...form.register('discountValue')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minPurchaseAmount">Min purchase (₹)</Label>
                  <Input id="minPurchaseAmount" type="number" step="any" placeholder="optional" {...form.register('minPurchaseAmount', numOpt)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxDiscountAmount">Max discount cap (₹)</Label>
                  <Input id="maxDiscountAmount" type="number" step="any" placeholder="optional" {...form.register('maxDiscountAmount', numOpt)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="couponCode">Coupon code — optional</Label>
                <Input id="couponCode" {...form.register('couponCode')} placeholder="e.g. SAVE20" className="max-w-[260px]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="startsAt">Starts</Label>
                  <Input id="startsAt" type="date" {...form.register('startsAt')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiresAt">Expires</Label>
                  <Input id="expiresAt" type="date" {...form.register('expiresAt')} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.watch('status')} onValueChange={(v) => form.setValue('status', v as FormValues['status'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.toLowerCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={String(form.watch('priority'))} onValueChange={(v) => form.setValue('priority', Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((p) => (
                        <SelectItem key={p} value={String(p)}>
                          {p}{p === 1 ? ' (highest)' : p === 10 ? ' (lowest)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <Select value={form.watch('visibility')} onValueChange={(v) => form.setValue('visibility', v as FormValues['visibility'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VISIBILITIES.map((v) => <SelectItem key={v} value={v}>{VISIBILITY_LABEL[v]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="maxRedemptions">Max redemptions</Label>
                  <Input id="maxRedemptions" type="number" min="1" placeholder="unlimited" {...form.register('maxRedemptions', numOpt)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="redemptionPerUser">Max per customer</Label>
                  <Input id="redemptionPerUser" type="number" min="1" placeholder="unlimited" {...form.register('redemptionPerUser', numOpt)} />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 rounded"
                  checked={form.watch('isStackable')}
                  onChange={(e) => form.setValue('isStackable', e.target.checked, { shouldDirty: true })} />
                Can be combined with other offers
              </label>

              {/* ─── Product targeting ─── */}
              <div className="grid grid-cols-2 gap-3 border-t pt-3">
                <div className="space-y-2">
                  <Label>Applicable products — optional</Label>
                  <Textarea rows={2} {...form.register('applicableProducts')} placeholder="e.g. All footwear, Samsung TVs" />
                </div>
                <div className="space-y-2">
                  <Label>Excluded products — optional</Label>
                  <Textarea rows={2} {...form.register('excludedProducts')} placeholder="e.g. iPhone 15, premium brands" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags — optional</Label>
                <Input id="tags" {...form.register('tags')} placeholder="Diwali, Flash Sale, Clearance (comma-separated)" />
                <p className="text-xs text-muted-foreground">Up to 15 tags — helps customers discover the offer.</p>
              </div>

              {/* Categories — multi-select dropdown. Controls which category
                  buckets the offer shows under when customers browse/filter by
                  category. Persisted as offer_categories. */}
              <div className="space-y-2">
                <Label>Categories</Label>
                <p className="text-xs text-muted-foreground">
                  Pick where this offer appears when customers browse by category. Select all that apply.
                </p>
                {(() => {
                  const cats = categoriesQ.data ?? [];
                  const selectedIds = form.watch('categoryIds') ?? [];
                  const selectedNames = cats.filter((c) => selectedIds.includes(c.id)).map((c) => c.name);
                  const toggle = (id: string, checked: boolean) => {
                    const cur = form.getValues('categoryIds') ?? [];
                    const next = checked ? [...new Set([...cur, id])] : cur.filter((x) => x !== id);
                    form.setValue('categoryIds', next, { shouldDirty: true });
                  };
                  return (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-between font-normal"
                          disabled={cats.length === 0}
                        >
                          <span className="truncate text-left">
                            {selectedNames.length === 0
                              ? (cats.length === 0 ? 'No categories defined yet' : 'Select categories')
                              : selectedNames.length <= 3
                                ? selectedNames.join(', ')
                                : `${selectedNames.length} categories selected`}
                          </span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className="max-h-72 w-[--radix-dropdown-menu-trigger-width] overflow-auto"
                        align="start"
                      >
                        {cats.map((c) => (
                          <DropdownMenuCheckboxItem
                            key={c.id}
                            checked={selectedIds.includes(c.id)}
                            onCheckedChange={(checked) => toggle(c.id, Boolean(checked))}
                            onSelect={(e) => e.preventDefault()}
                          >
                            {c.name}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })()}
                {(form.watch('categoryIds') ?? []).length > 0 ? (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(categoriesQ.data ?? [])
                      .filter((c) => (form.watch('categoryIds') ?? []).includes(c.id))
                      .map((c) => (
                        <Badge key={c.id} variant="secondary" className="gap-1">
                          {c.name}
                          <button
                            type="button"
                            onClick={() => {
                              const cur = form.getValues('categoryIds') ?? [];
                              form.setValue('categoryIds', cur.filter((x) => x !== c.id), { shouldDirty: true });
                            }}
                            className="ml-0.5 rounded-full hover:bg-muted"
                            aria-label={`Remove ${c.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Terms &amp; conditions — optional</Label>
                <Textarea rows={2} {...form.register('termsAndConditions')} />
              </div>

              {/* ─── Recurring window (happy hours etc.) ─── */}
              <div className="space-y-3 border-t pt-3">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded"
                    checked={form.watch('isRecurring')}
                    onChange={(e) => form.setValue('isRecurring', e.target.checked, { shouldDirty: true })}
                  />
                  <span>
                    <span className="text-sm font-medium">Recurring offer (happy hours / day-of-week)</span>
                    <span className="block text-xs text-muted-foreground">
                      Limit when the offer is active within its validity window — e.g. Mon–Fri 16:00–21:00.
                    </span>
                  </span>
                </label>

                {form.watch('isRecurring') ? (
                  <div className="space-y-2 pl-6">
                    <div>
                      <Label className="mb-1 block text-xs">Days</Label>
                      <div className="flex flex-wrap gap-1">
                        {DAYS.map((d) => {
                          const active = (form.watch('recurringDays') ?? []).includes(d.value);
                          return (
                            <button
                              key={d.value}
                              type="button"
                              onClick={() => {
                                const cur = form.getValues('recurringDays') ?? [];
                                form.setValue(
                                  'recurringDays',
                                  active ? cur.filter((v) => v !== d.value) : [...cur, d.value].sort(),
                                  { shouldDirty: true },
                                );
                              }}
                              className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                                active
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-input bg-background hover:bg-accent'
                              }`}
                            >
                              {d.short}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="rStart" className="text-xs">Start time</Label>
                        <Input id="rStart" type="time" {...form.register('recurringStartTime')} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="rEnd" className="text-xs">End time</Label>
                        <Input id="rEnd" type="time" {...form.register('recurringEndTime')} />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* ─── Bank / card offers ─── */}
              <div className="space-y-2 border-t pt-3">
                <Label>Card offers (optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Pick a bank, then the specific card, and click Add. Set the benefit detail for each card below.
                </p>
                {(() => {
                  const selectedBank = banksQ.data?.find((b) => b.id === pickBankId);
                  const takenCardIds = new Set(cardOffers.map((c) => c.cardTypeId));
                  const availableCards = (selectedBank?.cards ?? []).filter((c) => !takenCardIds.has(c.id));
                  return (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-[10rem] flex-1 space-y-1">
                        <Label className="text-xs">Bank</Label>
                        <Select
                          value={pickBankId || undefined}
                          onValueChange={(v) => { setPickBankId(v); setPickCardId(''); }}
                        >
                          <SelectTrigger className="h-9"><SelectValue placeholder="Select bank" /></SelectTrigger>
                          <SelectContent>
                            {banksQ.data?.map((b) => (
                              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="min-w-[10rem] flex-1 space-y-1">
                        <Label className="text-xs">Card</Label>
                        <Select
                          value={pickCardId || undefined}
                          onValueChange={setPickCardId}
                          disabled={!selectedBank || availableCards.length === 0}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue
                              placeholder={
                                !selectedBank
                                  ? 'Pick a bank first'
                                  : availableCards.length === 0
                                    ? 'All cards added'
                                    : 'Select card'
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCards.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name} <span className="text-muted-foreground">({c.category.toLowerCase()})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={addPickedCard}
                        disabled={!pickCardId}
                      >
                        <Plus className="mr-1 h-3 w-3" /> Add card
                      </Button>
                    </div>
                  );
                })()}
                {cardOffers.length > 0 ? (
                  <div className="space-y-2 rounded-md border bg-muted/40 p-2">
                    <p className="text-xs font-medium">Benefit detail</p>
                    {cardOffers.map((c) => (
                      <div key={c.cardTypeId} className="space-y-1 rounded-md border bg-background p-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium">{cardLabel.get(c.cardTypeId) ?? 'Card'}</p>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => removeCardOffer(c.cardTypeId)}
                            aria-label="Remove card"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <Select value={c.benefitType ?? 'Cashback'} onValueChange={(v) => updateCardOffer(c.cardTypeId, { benefitType: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {BENEFIT_TYPES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Input
                            className="h-8 text-xs" placeholder="value e.g. 10%"
                            value={c.benefitValue ?? ''}
                            onChange={(e) => updateCardOffer(c.cardTypeId, { benefitValue: e.target.value })}
                          />
                          <Input
                            className="h-8 text-xs" type="number" placeholder="min spend ₹"
                            value={c.minSpend ?? ''}
                            onChange={(e) => updateCardOffer(c.cardTypeId, { minSpend: e.target.value === '' ? undefined : Number(e.target.value) })}
                          />
                          <Input
                            className="h-8 text-xs" type="number" placeholder="max benefit ₹"
                            value={c.maxBenefit ?? ''}
                            onChange={(e) => updateCardOffer(c.cardTypeId, { maxBenefit: e.target.value === '' ? undefined : Number(e.target.value) })}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* ─── Online platforms ─── */}
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between">
                  <Label>Online platforms (optional)</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addPlatform}>
                    <Plus className="mr-1 h-3 w-3" /> Add platform
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Where the offer also runs online — Amazon, Flipkart, your website.</p>
                {platforms.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      className="h-9 flex-1" placeholder="Platform name"
                      value={p.platformName}
                      onChange={(e) => updatePlatform(idx, { platformName: e.target.value })}
                    />
                    <Input
                      className="h-9 flex-1" placeholder="Link (optional)"
                      value={p.url ?? ''}
                      onChange={(e) => updatePlatform(idx, { url: e.target.value })}
                    />
                    <Button type="button" size="icon" variant="ghost" onClick={() => removePlatform(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-2 border-t pt-3">
                <Label>Media</Label>
                <MediaUploader
                  images={form.watch('images') ?? []}
                  videoUrl={form.watch('videoUrl')}
                  onImagesChange={(urls) => form.setValue('images', urls, { shouldDirty: true })}
                  onVideoChange={(url) => form.setValue('videoUrl', url, { shouldDirty: true })}
                />
                <div className="pt-3">
                  <ListImageUploader
                    value={form.watch('listImage') ?? null}
                    onChange={(url) => form.setValue('listImage', url, { shouldDirty: true })}
                  />
                </div>
              </div>
              </div>

              <DialogFooter className="mt-3 shrink-0 border-t pt-3">
                <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (isEditing ? 'Saving…' : 'Creating…') : isEditing ? 'Save changes' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={boosting !== null} onOpenChange={(o) => { if (!o) setBoosting(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Boost &ldquo;{boosting?.title}&rdquo;</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A boosted offer is marked Featured and floats to the top of listings and search for the
            chosen duration.
          </p>
          {paymentCfgQ.data && !paymentCfgQ.data.enabled ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Online payments aren&apos;t configured on this server yet.
            </p>
          ) : null}
          <div className="space-y-2">
            {boostOptionsQ.data?.map((opt) => (
              <button
                key={opt.days}
                type="button"
                disabled={boostingDays !== null}
                onClick={() => boosting && boost(boosting, opt.days)}
                className="flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-accent disabled:opacity-60"
              >
                <span className="font-medium">{opt.days} days featured</span>
                <span className="text-sm font-semibold">
                  {boostingDays === opt.days ? 'Processing…' : `₹${opt.price}`}
                </span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBoosting(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Notify nearby dialog (Phase 4 push trigger) ─── */}
      <Dialog open={notifying !== null} onOpenChange={(o) => { if (!o) setNotifying(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notify &ldquo;{notifying?.title}&rdquo;
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Send a push notification to customers. Frequency cap is 3 / brand / customer / day.
          </p>

          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Radius</Label>
              <div className="flex gap-2">
                {[5, 10, 25].map((r) => (
                  <Button
                    key={r}
                    type="button"
                    size="sm"
                    variant={notifyRadius === r ? 'default' : 'outline'}
                    onClick={() => setNotifyRadius(r as 5 | 10 | 25)}
                  >
                    {r} km
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Audience</Label>
              <div className="flex gap-2">
                {([
                  { value: 'BOTH', label: 'Both' },
                  { value: 'NEARBY', label: 'Nearby only' },
                  { value: 'FOLLOWERS', label: 'Followers only' },
                ] as const).map((a) => (
                  <Button
                    key={a.value}
                    type="button"
                    size="sm"
                    variant={notifyAudience === a.value ? 'default' : 'outline'}
                    onClick={() => setNotifyAudience(a.value)}
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>Nearby</strong> = customers within the radius of any reachable branch.{' '}
                <strong>Followers</strong> = anyone who clicked Follow on this brand, regardless of distance.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button variant="outline" onClick={() => setNotifying(null)} disabled={notifySending}>Cancel</Button>
            <Button
              disabled={notifySending}
              onClick={async () => {
                if (!notifying) return;
                setNotifySending(true);
                try {
                  // 1. Enqueue — returns immediately with QUEUED.
                  const queued = await apiPost<{ jobId: string; status: string }>(
                    `/push/offer/${notifying.id}`,
                    { radiusKm: notifyRadius, audience: notifyAudience },
                  );
                  toast.info('Queued — waiting for the worker to send…', { duration: 2000 });

                  // 2. Poll the job row until terminal or 30s pass.
                  type JobRow = {
                    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
                    recipientsPlanned: number;
                    recipientsCapped: number;
                    recipientsDeferred: number;
                    recipientsSent: number;
                    recipientsFailed: number;
                    errorMessage?: string | null;
                  };
                  const deadline = Date.now() + 30_000;
                  let finalJob: JobRow | null = null;
                  while (Date.now() < deadline) {
                    await new Promise((r) => setTimeout(r, 1500));
                    const job = await apiGet<JobRow>(`/push/jobs/${queued.jobId}`);
                    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
                      finalJob = job;
                      break;
                    }
                  }

                  if (finalJob?.status === 'COMPLETED') {
                    const bits = [
                      `${finalJob.recipientsSent} sent`,
                      finalJob.recipientsCapped > 0 ? `${finalJob.recipientsCapped} capped` : null,
                      finalJob.recipientsDeferred > 0 ? `${finalJob.recipientsDeferred} deferred (quiet hours)` : null,
                      finalJob.recipientsFailed > 0 ? `${finalJob.recipientsFailed} failed` : null,
                    ].filter(Boolean).join(', ');
                    toast.success(`Push done — ${bits} (${finalJob.recipientsPlanned} eligible).`);
                  } else if (finalJob?.status === 'FAILED') {
                    toast.error(`Push failed: ${finalJob.errorMessage ?? 'unknown error'}`);
                  } else {
                    // 30s elapsed and still processing — likely big send. Job
                    // continues in the background; seller can check the Jobs
                    // endpoint later.
                    toast.warning('Still processing — check Push Jobs in a minute.');
                  }
                  setNotifying(null);
                } catch (e) {
                  toast.error((e as Error).message ?? 'Push failed');
                } finally {
                  setNotifySending(false);
                }
              }}
            >
              {notifySending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>
                : <><Bell className="mr-2 h-4 w-4" /> Send notification</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {(branchesQ.data?.length ?? 0) === 0 && !brandsQ.isLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>Add a branch first</CardTitle>
            <CardDescription>Offers attach to a branch. Create a branch under one of your brands.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {offersQ.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : offersQ.data && offersQ.data.length > 0 ? (
        <div className="space-y-3">
          {offersQ.data.map((o) => (
            <Card key={o.id}>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/offers/${o.id}`} className="font-medium hover:underline">{o.title}</Link>
                    <Badge variant={statusVariant(o.status)}>{o.status.toLowerCase()}</Badge>
                    {o.isFeatured ? <Badge>Featured</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {o.branch?.brand?.name} · {o.branch?.name} · valid until {formatDate(o.expiresAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {o.totalRedemptions} redemptions · {o.viewCount} views
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(o.id)}>
                    <Pencil className="mr-1 h-3 w-3" /> Edit
                  </Button>
                  {o.featuredUntil && new Date(o.featuredUntil) > new Date() ? (
                    <Button size="sm" variant="outline" disabled title={`Featured until ${formatDate(o.featuredUntil)}`}>
                      <Rocket className="mr-1 h-3 w-3" /> Boosted
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setBoosting(o)}>
                      <Rocket className="mr-1 h-3 w-3" /> Boost
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() =>
                    togglePublish.mutate({ id: o.id, status: o.status === 'PUBLISHED' ? 'PAUSED' : 'PUBLISHED' })
                  }>
                    {o.status === 'PUBLISHED' ? 'Pause' : 'Publish'}
                  </Button>
                  {o.status === 'PUBLISHED' ? (
                    <Button size="sm" variant="outline" onClick={() => setNotifying(o)}
                      title="Push this offer to nearby customers + brand followers">
                      <Bell className="mr-1 h-3 w-3" /> Notify
                    </Button>
                  ) : null}
                  <Button size="icon" variant="ghost" asChild>
                    <Link href={`/offers/${o.id}`}><ExternalLink className="h-4 w-4" /></Link>
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => remove.mutate(o.id)}>Archive</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No offers yet</CardTitle>
            <CardDescription>Create your first offer to start attracting customers.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

function statusVariant(status: string) {
  if (status === 'PUBLISHED') return 'success' as const;
  if (status === 'PAUSED' || status === 'EXPIRED') return 'secondary' as const;
  if (status === 'ARCHIVED') return 'destructive' as const;
  return 'outline' as const;
}

function today(): string { return new Date().toISOString().slice(0, 10); }
function addDays(date: string, days: number): string {
  const d = new Date(date); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10);
}

/// Compact radio-card picker for the four offer scopes. The seller picks one;
/// the form then reveals city/tags/branch inputs as appropriate.
type Scope = 'BRANCH' | 'BRAND' | 'CITY' | 'TAGS';
function ScopePicker({ value, onChange }: { value: Scope; onChange: (s: Scope) => void }) {
  const options: Array<{ value: Scope; title: string; hint: string }> = [
    { value: 'BRANCH', title: 'Specific branches', hint: 'Pick branches by hand. Good for ≤20 stores.' },
    { value: 'CITY',   title: 'Whole city',        hint: 'Every branch in the brand in this city.' },
    { value: 'TAGS',   title: 'By branch tag',     hint: 'Branches tagged "flagship", "metro", etc.' },
    { value: 'BRAND',  title: 'Entire brand',      hint: 'Every branch the brand has, now and later.' },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-md border p-2 text-left transition-colors ${
              active
                ? 'border-primary bg-primary/10'
                : 'border-input bg-background hover:bg-accent'
            }`}
          >
            <div className="text-xs font-semibold">{o.title}</div>
            <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{o.hint}</div>
          </button>
        );
      })}
    </div>
  );
}
