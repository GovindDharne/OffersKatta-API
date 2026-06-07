'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CreditCard, Sparkles } from 'lucide-react';
import { apiGetPaginated, apiGet } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OfferCard, type OfferCardProps } from '@/components/offer-card';

interface CategoryDto { id: string; name: string; slug: string; iconUrl?: string | null }
interface BankDto { id: string; name: string; slug: string }

export default function HomePage() {
  const router = useRouter();

  const offersQ = useQuery({
    queryKey: ['offers', 'featured'],
    queryFn: () =>
      apiGetPaginated<OfferCardProps>('/offers', { limit: 8, isFeatured: true, status: 'PUBLISHED' }),
  });

  const categoriesQ = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiGet<CategoryDto[]>('/categories'),
  });

  const banksQ = useQuery({
    queryKey: ['banks'],
    queryFn: () => apiGet<BankDto[]>('/banks'),
  });

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-background py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Discover deals near you.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Restaurants, hotels, salons, gyms, shops, and local businesses — all in one place.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/search">Browse offers <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/register?next=/seller/dashboard">List your business</Link>
            </Button>
          </div>

          <div className="mx-auto mt-6 flex max-w-md items-center gap-2">
            <CreditCard className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Select
              onValueChange={(v) => {
                if (v && v !== 'all') router.push(`/search?bankId=${v}`);
              }}
            >
              <SelectTrigger className="bg-background" aria-label="Filter offers by bank">
                <SelectValue placeholder="Filter offers by bank (HDFC, SBI, ICICI…)" />
              </SelectTrigger>
              <SelectContent>
                {banksQ.data?.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container mx-auto px-4 py-10">
        <h2 className="mb-4 text-xl font-semibold">Browse by category</h2>
        {categoriesQ.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {categoriesQ.data?.map((c) => (
              <Link
                key={c.id}
                href={`/search?categoryId=${c.id}`}
                className="group flex h-24 items-center justify-center rounded-lg border bg-card p-4 text-center text-sm font-medium transition-colors hover:bg-accent"
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Featured */}
      <section className="container mx-auto px-4 py-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Sparkles className="h-5 w-5 text-primary" /> Featured offers
            </h2>
            <p className="text-sm text-muted-foreground">Hand-picked deals from verified brands.</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/search">See all <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
        {offersQ.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-lg" />)}
          </div>
        ) : offersQ.data && offersQ.data.data.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {offersQ.data.data.map((o) => <OfferCard key={o.id} {...o} />)}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No featured offers yet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Featured offers will appear here once businesses publish them.
              </p>
            </CardContent>
          </Card>
        )}
      </section>
    </>
  );
}
