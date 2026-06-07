'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Heart, MapPin, Navigation, QrCode, Share2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { formatDate } from '@/lib/utils';

interface Offer {
  id: string;
  title: string;
  titleHindi?: string | null;
  description?: string | null;
  descriptionRegional?: string | null;
  termsAndConditions?: string | null;
  offerType: string;
  discountValue: number;
  couponCode?: string | null;
  startsAt: string;
  expiresAt: string;
  images?: string[];
  isFeatured?: boolean;
  isStackable?: boolean;
  priority?: number;
  visibility?: string;
  applicableProducts?: string | null;
  excludedProducts?: string | null;
  tags?: string[];
  totalRedemptions: number;
  viewCount: number;
  videoUrl?: string | null;
  isRecurring?: boolean;
  recurringDays?: number[];
  recurringStartTime?: string | null;
  recurringEndTime?: string | null;
  cardTypes?: Array<{
    cardCategory?: string | null;
    benefitType?: string | null;
    benefitValue?: string | null;
    minSpend?: number | null;
    maxBenefit?: number | null;
    cardType: {
      id: string;
      name: string;
      category: string;
      network?: string | null;
      bank: { id: string; name: string; slug: string };
    };
  }>;
  branch?: {
    id: string;
    name: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state: string;
    postalCode?: string;
    phone?: string;
    latitude?: number;
    longitude?: number;
    brand?: { id: string; name: string; slug: string };
  };
  branches?: Array<{ branch: { id: string; name: string; city: string } }>;
  /// All stores this offer reaches after scope resolution (BRAND/CITY/TAGS/BRANCH).
  /// The `isPrimary` one is the anchor branch.
  reachableBranches?: Array<{
    id: string;
    name: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state: string;
    postalCode?: string;
    phone?: string | null;
    latitude?: number;
    longitude?: number;
    isPrimary: boolean;
  }>;
  platforms?: Array<{ id: string; platformName: string; url?: string | null }>;
  categories?: Array<{ category: { id: string; name: string } }>;
}

interface RedemptionResponse {
  redemption: { id: string; qrCode: string; expiresAt: string };
  qrDataUrl: string;
}

export default function OfferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, user } = useAuth();
  const qc = useQueryClient();
  const [qr, setQr] = useState<RedemptionResponse | null>(null);

  const offerQ = useQuery({
    queryKey: ['offer', id],
    queryFn: () => apiGet<Offer>(`/offers/${id}`),
  });

  const addFav = useMutation({
    mutationFn: () => apiPost(`/favorites/${id}`),
    onSuccess: () => { toast.success('Saved to favorites'); qc.invalidateQueries({ queryKey: ['favorites'] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const removeFav = useMutation({
    mutationFn: () => apiDelete(`/favorites/${id}`),
    onSuccess: () => { toast.success('Removed from favorites'); qc.invalidateQueries({ queryKey: ['favorites'] }); },
  });

  const redeem = useMutation({
    mutationFn: () => apiPost<RedemptionResponse>(`/redemptions/offer/${id}`),
    onSuccess: (data) => setQr(data),
    onError: (e) => toast.error((e as Error).message),
  });

  if (offerQ.isLoading) {
    return (
      <div className="container mx-auto space-y-4 px-4 py-8">
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }
  if (offerQ.isError || !offerQ.data) {
    return <div className="container mx-auto py-16 text-center text-muted-foreground">Offer not found.</div>;
  }

  const o = offerQ.data;
  const expired = new Date(o.expiresAt) < new Date();

  // All stores this offer reaches (scope-resolved server-side). Fall back to
  // the single primary branch for older/cached payloads without the field.
  const stores =
    o.reachableBranches && o.reachableBranches.length > 0
      ? o.reachableBranches
      : o.branch
        ? [{ ...o.branch, isPrimary: true }]
        : [];
  const primaryStore = stores.find((s) => s.isPrimary) ?? stores[0];
  const otherStores = stores.filter((s) => s.id !== primaryStore?.id);

  const onShare = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) navigator.share({ title: o.title, url }).catch(() => undefined);
    else { navigator.clipboard.writeText(url); toast.success('Link copied'); }
    apiPost(`/offers/${id}/share`).catch(() => undefined);
  };

  const onRedeem = () => {
    if (!isAuthenticated) { toast.error('Please log in to redeem this offer'); return; }
    if (user?.role !== 'CUSTOMER') { toast.error('Only customers can redeem offers'); return; }
    redeem.mutate();
  };

  return (
    <div className="container mx-auto grid gap-6 px-4 py-8 lg:grid-cols-[2fr_1fr]">
      <div className="min-w-0 space-y-6">
        <OfferMediaGallery
          images={o.images ?? []}
          videoUrl={o.videoUrl ?? null}
          fallbackHeadline={headline(o.offerType, o.discountValue)}
          title={o.title}
        />


        <div className="space-y-2">
          {o.isFeatured ? <Badge>Featured</Badge> : null}
          <h1 className="text-3xl font-bold tracking-tight">{o.title}</h1>
          {o.titleHindi ? <p className="text-lg text-muted-foreground">{o.titleHindi}</p> : null}
          {o.branch?.brand ? (
            <p className="text-muted-foreground">
              by <span className="font-medium text-foreground">{o.branch.brand.name}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="secondary"><Tag className="mr-1 h-3 w-3" /> {headline(o.offerType, o.discountValue)}</Badge>
            <Badge variant="outline">{o.totalRedemptions} redeemed</Badge>
            <Badge variant="outline">{o.viewCount} views</Badge>
            {o.visibility && o.visibility !== 'PUBLIC' ? <Badge variant="secondary">{visibilityLabel(o.visibility)}</Badge> : null}
            {o.isStackable ? <Badge variant="outline">Combinable</Badge> : null}
            {expired ? <Badge variant="destructive">Expired</Badge> : null}
          </div>
          {o.tags && o.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1 pt-1">
              {o.tags.map((t) => (
                <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">#{t}</span>
              ))}
            </div>
          ) : null}
        </div>

        {o.description || o.descriptionRegional ? (
          <Card>
            <CardHeader><CardTitle className="text-base">About this offer</CardTitle></CardHeader>
            <CardContent className="space-y-2 whitespace-pre-line text-sm text-muted-foreground">
              {o.description ? <p>{o.description}</p> : null}
              {o.descriptionRegional ? <p>{o.descriptionRegional}</p> : null}
            </CardContent>
          </Card>
        ) : null}

        {o.termsAndConditions ? (
          <Card>
            <CardHeader><CardTitle className="text-base">Terms & conditions</CardTitle></CardHeader>
            <CardContent className="whitespace-pre-line text-sm text-muted-foreground">{o.termsAndConditions}</CardContent>
          </Card>
        ) : null}

        {o.applicableProducts || o.excludedProducts ? (
          <Card>
            <CardHeader><CardTitle className="text-base">Products</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {o.applicableProducts ? (
                <p><span className="font-medium text-foreground">Applies to: </span><span className="text-muted-foreground">{o.applicableProducts}</span></p>
              ) : null}
              {o.excludedProducts ? (
                <p><span className="font-medium text-foreground">Excluded: </span><span className="text-muted-foreground">{o.excludedProducts}</span></p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {o.isRecurring ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">When</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">{describeRecurring(o.recurringDays, o.recurringStartTime, o.recurringEndTime)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Within validity: {formatDate(o.startsAt)} – {formatDate(o.expiresAt)}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {o.cardTypes && o.cardTypes.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Card offers</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                {groupByBank(o.cardTypes).map((g) => (
                  <li key={g.bank.id}>
                    <p className="font-medium">{g.bank.name}</p>
                    <ul className="mt-1 space-y-1">
                      {g.cards.map((c) => (
                        <li key={c.id} className="text-xs text-muted-foreground">
                          <span className="text-foreground">{c.name}</span>
                          {c.benefitValue || c.benefitType ? (
                            <span> — {[c.benefitValue, c.benefitType].filter(Boolean).join(' ')}</span>
                          ) : null}
                          {c.minSpend ? <span> · min spend ₹{c.minSpend}</span> : null}
                          {c.maxBenefit ? <span> · up to ₹{c.maxBenefit}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {o.platforms && o.platforms.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Also available online</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {o.platforms.map((p) =>
                  p.url ? (
                    <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer">
                      <Badge variant="outline" className="cursor-pointer hover:bg-accent">{p.platformName} ↗</Badge>
                    </a>
                  ) : (
                    <Badge key={p.id} variant="outline">{p.platformName}</Badge>
                  ),
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <aside className="min-w-0 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Redeem</CardTitle>
            <CardDescription>
              Valid {formatDate(o.startsAt)} – {formatDate(o.expiresAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {o.couponCode ? (
              <div className="rounded-md border border-dashed bg-muted/50 p-2 text-center">
                <p className="text-xs text-muted-foreground">Use coupon code</p>
                <p className="text-lg font-bold tracking-wider">{o.couponCode}</p>
              </div>
            ) : null}
            <Button className="w-full" size="lg" onClick={onRedeem} disabled={expired || redeem.isPending}>
              <QrCode className="mr-2 h-4 w-4" /> Get my QR
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => (isAuthenticated ? addFav.mutate() : toast.error('Please log in first'))}>
                <Heart className="mr-2 h-4 w-4" /> Save
              </Button>
              <Button variant="outline" onClick={onShare}>
                <Share2 className="mr-2 h-4 w-4" /> Share
              </Button>
            </div>
          </CardContent>
        </Card>

        {primaryStore ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {stores.length > 1 ? `Available at ${stores.length} stores` : 'Location'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="font-medium">{primaryStore.name}</p>
              <p className="text-muted-foreground">
                <MapPin className="mr-1 inline h-3 w-3" />
                {[primaryStore.addressLine1, primaryStore.addressLine2, primaryStore.city, primaryStore.state, primaryStore.postalCode]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              {primaryStore.phone ? (
                <p className="text-muted-foreground">
                  <a href={`tel:${primaryStore.phone}`} className="hover:underline">
                    {primaryStore.phone}
                  </a>
                </p>
              ) : null}

              {typeof primaryStore.latitude === 'number' && typeof primaryStore.longitude === 'number' ? (
                <div className="space-y-2 pt-1">
                  <Button asChild className="w-full">
                    <a
                      href={directionsUrl(primaryStore.latitude, primaryStore.longitude, primaryStore.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Navigation className="mr-2 h-4 w-4" /> Get directions
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <a
                      href={mapPreviewUrl(primaryStore.latitude, primaryStore.longitude, primaryStore.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapPin className="mr-2 h-4 w-4" /> View on map
                    </a>
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    {primaryStore.latitude.toFixed(5)}, {primaryStore.longitude.toFixed(5)}
                  </p>
                </div>
              ) : null}

              {otherStores.length > 0 ? (
                <div className="space-y-2 pt-1">
                  <Separator />
                  <p className="text-xs font-medium text-foreground">
                    Also at {otherStores.length} more {otherStores.length === 1 ? 'store' : 'stores'}
                  </p>
                  <ul className="space-y-2">
                    {otherStores.map((s) => (
                      <li key={s.id} className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">{s.name}</span>
                          <span className="block break-words text-xs text-muted-foreground">
                            {[s.addressLine1, s.city, s.state].filter(Boolean).join(', ')}
                          </span>
                        </span>
                        {typeof s.latitude === 'number' && typeof s.longitude === 'number' ? (
                          <a
                            href={directionsUrl(s.latitude, s.longitude, s.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-xs text-primary hover:underline"
                          >
                            <Navigation className="mr-1 inline h-3 w-3" />Directions
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {o.categories && o.categories.length > 0 ? (
                <>
                  <Separator />
                  <div className="flex flex-wrap gap-1">
                    {o.categories.map((c) => (
                      <Badge key={c.category.id} variant="outline">{c.category.name}</Badge>
                    ))}
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </aside>

      <Dialog open={!!qr} onOpenChange={(open) => { if (!open) setQr(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Show this at the counter</DialogTitle>
            <DialogDescription>
              {qr ? `Valid until ${new Date(qr.redemption.expiresAt).toLocaleString()}` : null}
            </DialogDescription>
          </DialogHeader>
          {qr ? (
            <div className="flex flex-col items-center gap-3 py-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr.qrDataUrl} alt="QR code" className="h-56 w-56" />
              <code className="rounded bg-muted px-3 py-1 text-sm">{qr.redemption.qrCode}</code>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQr(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OfferMediaGallery({
  images,
  videoUrl,
  fallbackHeadline,
  title,
}: {
  images: string[];
  videoUrl: string | null;
  fallbackHeadline: string;
  title: string;
}) {
  // We always show a 16:9 hero (active item). Below it, a thumb strip lets the
  // viewer switch between each image and (optionally) the video.
  // Order: images first, video last — gives the visual product photo precedence
  // and treats the video as a "see also" element at the end of the strip.
  const items: Array<{ kind: 'image' | 'video'; src: string }> = [];
  for (const img of images) items.push({ kind: 'image', src: img });
  if (videoUrl) items.push({ kind: 'video', src: videoUrl });

  const [activeIdx, setActiveIdx] = useState(0);
  const active = items[activeIdx];
  const total = items.length;

  // Wrap-around navigation so prev from index 0 jumps to the last item, and
  // next from the last item jumps back to 0.
  const goPrev = () => setActiveIdx((i) => (i - 1 + total) % total);
  const goNext = () => setActiveIdx((i) => (i + 1) % total);

  // Bonus: arrow-key navigation when the gallery is focused/in view.
  // Skipped if there's only one item or the user is typing in an input.
  useEffect(() => {
    if (total <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total]);

  if (items.length === 0) {
    return (
      <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 to-primary/30">
        <div className="flex h-full items-center justify-center text-7xl font-bold text-primary/60">
          {fallbackHeadline}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-black">
        {active.kind === 'video' ? (
          // autoPlay+muted: most browsers (Chrome, Safari, Firefox) only allow
          // autoplay when the video is muted. The user can unmute via the controls.
          // playsInline keeps it inside the page on iOS instead of going fullscreen.
          // key={src} unmounts/remounts on switch, so each video starts fresh.
          <video
            key={active.src}
            src={active.src}
            controls
            playsInline
            autoPlay
            muted
            preload="metadata"
            className="h-full w-full object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={active.src} alt={title} className="h-full w-full object-cover" />
        )}

        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white shadow-md transition-colors hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white shadow-md transition-colors hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-xs font-medium text-white">
              {activeIdx + 1} / {total}
            </div>
          </>
        ) : null}
      </div>

      {items.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {items.map((it, i) => (
            <button
              key={`${it.kind}-${it.src}-${i}`}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                i === activeIdx ? 'border-primary' : 'border-transparent'
              }`}
              aria-label={`Show ${it.kind} ${i + 1}`}
            >
              {it.kind === 'video' ? (
                <div className="flex h-full w-full items-center justify-center bg-black/80 text-xs font-medium text-white">
                  ▶ Video
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.src} alt="" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function visibilityLabel(v: string): string {
  switch (v) {
    case 'MEMBERS': return 'Members only';
    case 'NEW_CUSTOMERS': return 'New customers';
    case 'REFERRAL': return 'Referral only';
    default: return 'Public';
  }
}

function headline(type: string, value: number): string {
  switch (type) {
    case 'PERCENTAGE': return `${Math.round(value)}% off`;
    case 'FLAT':       return `₹${Math.round(value)} off`;
    case 'BUY_ONE_GET_ONE': return 'BOGO';
    case 'FREE_ITEM':  return 'Free item';
    default:           return 'Deal';
  }
}

/**
 * Google Maps "directions to here" URL. Works in three layers automatically:
 *   - on Android / iOS the OS sniffs google.com/maps URLs and offers to open Google Maps / Apple Maps
 *   - the page itself loads in a browser if the user declines / has no app
 *   - on desktop it opens the Google Maps web UI with a route from "Your location"
 * Docs: https://developers.google.com/maps/documentation/urls/get-started
 */
function directionsUrl(lat: number, lng: number, label?: string): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${lat},${lng}`,
  });
  if (label) params.set('destination_place_id', '');
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** "Pin on map" preview — useful before committing to navigation. */
function mapPreviewUrl(lat: number, lng: number, label?: string): string {
  const q = label ? `${lat},${lng}(${encodeURIComponent(label)})` : `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Mon–Fri 4:00 PM – 9:00 PM" / "Sat & Sun, all day" / "Daily 9:00 PM – 11:00 PM" */
function describeRecurring(
  days?: number[],
  start?: string | null,
  end?: string | null,
): string {
  const time = start && end ? `${formatTime(start)} – ${formatTime(end)}` : 'All day';
  const d = (days ?? []).slice().sort((a, b) => a - b);
  if (d.length === 0 || d.length === 7) return `Daily, ${time}`;

  // Detect contiguous run (e.g. 1,2,3,4,5 → Mon–Fri). Sundays normalise to 7
  // for run detection so Sat+Sun shows as a range, but for short labels we
  // still use the 0-indexed week.
  const norm = d.map((x) => (x === 0 ? 7 : x)).sort((a, b) => a - b);
  const contiguous = norm.every((v, i) => i === 0 || v === norm[i - 1] + 1);
  if (contiguous && norm.length >= 2) {
    const first = norm[0] === 7 ? 0 : norm[0];
    const last = norm[norm.length - 1] === 7 ? 0 : norm[norm.length - 1];
    return `${WEEKDAY_SHORT[first]}–${WEEKDAY_SHORT[last]}, ${time}`;
  }
  return `${d.map((x) => WEEKDAY_SHORT[x]).join(', ')}, ${time}`;
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

/** Collapse OfferCardType[] into { bank, cards[] } groups, carrying benefit detail. */
interface GroupedCard {
  id: string;
  name: string;
  benefitType?: string | null;
  benefitValue?: string | null;
  minSpend?: number | null;
  maxBenefit?: number | null;
}
function groupByBank(
  rows: Array<{
    benefitType?: string | null;
    benefitValue?: string | null;
    minSpend?: number | null;
    maxBenefit?: number | null;
    cardType: { id: string; name: string; bank: { id: string; name: string; slug: string } };
  }>,
): Array<{ bank: { id: string; name: string; slug: string }; cards: GroupedCard[] }> {
  const map = new Map<string, { bank: { id: string; name: string; slug: string }; cards: GroupedCard[] }>();
  for (const r of rows) {
    const key = r.cardType.bank.id;
    if (!map.has(key)) map.set(key, { bank: r.cardType.bank, cards: [] });
    map.get(key)!.cards.push({
      id: r.cardType.id,
      name: r.cardType.name,
      benefitType: r.benefitType,
      benefitValue: r.benefitValue,
      minSpend: r.minSpend,
      maxBenefit: r.maxBenefit,
    });
  }
  return Array.from(map.values()).sort((a, b) => a.bank.name.localeCompare(b.bank.name));
}
