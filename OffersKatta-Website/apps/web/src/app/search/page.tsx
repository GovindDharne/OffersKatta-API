'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { apiGetPaginated, apiGet } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { OfferCard, type OfferCardProps } from '@/components/offer-card';

interface Category { id: string; name: string }
interface Bank { id: string; name: string; slug: string }

function SearchView() {
  const router = useRouter();
  const params = useSearchParams();
  const initialQ = params.get('q') ?? '';
  const initialCategory = params.get('categoryId') ?? '';
  const initialBank = params.get('bankId') ?? '';

  const [q, setQ] = useState(initialQ);
  const [debouncedQ, setDebouncedQ] = useState(initialQ);
  const [categoryId, setCategoryId] = useState(initialCategory);
  const [bankId, setBankId] = useState(initialBank);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => { setPage(1); }, [debouncedQ, categoryId, bankId]);

  useEffect(() => {
    const sp = new URLSearchParams();
    if (debouncedQ) sp.set('q', debouncedQ);
    if (categoryId) sp.set('categoryId', categoryId);
    if (bankId) sp.set('bankId', bankId);
    router.replace(`/search${sp.toString() ? `?${sp}` : ''}`, { scroll: false });
  }, [debouncedQ, categoryId, bankId, router]);

  const categoriesQ = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiGet<Category[]>('/categories'),
  });

  const banksQ = useQuery({
    queryKey: ['banks'],
    queryFn: () => apiGet<Bank[]>('/banks'),
  });

  const offersQ = useQuery({
    queryKey: ['offers', 'search', debouncedQ, categoryId, bankId, page],
    queryFn: () =>
      apiGetPaginated<OfferCardProps>('/offers', {
        search: debouncedQ || undefined,
        categoryId: categoryId || undefined,
        bankId: bankId || undefined,
        status: 'PUBLISHED',
        page,
        limit: 12,
      }),
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search restaurants, salons, hotels..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryId || 'all'} onValueChange={(v) => setCategoryId(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categoriesQ.data?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={bankId || 'all'} onValueChange={(v) => setBankId(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="All banks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All banks</SelectItem>
            {banksQ.data?.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {offersQ.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-lg" />)}
        </div>
      ) : offersQ.data && offersQ.data.data.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {offersQ.data.data.map((o) => <OfferCard key={o.id} {...o} />)}
          </div>
          <Pagination
            page={offersQ.data.meta.page}
            totalPages={offersQ.data.meta.totalPages}
            onChange={setPage}
          />
        </>
      ) : (
        <p className="py-16 text-center text-muted-foreground">No offers match your filters.</p>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8" />}>
      <SearchView />
    </Suspense>
  );
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-8 flex items-center justify-center gap-2">
      <Button variant="outline" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
      <Button variant="outline" size="sm" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
        Next
      </Button>
    </div>
  );
}
