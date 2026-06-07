import Link from 'next/link';
import { MapPin, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface OfferCardProps {
  id: string;
  title: string;
  description?: string | null;
  offerType: string;
  discountValue: number;
  isFeatured?: boolean;
  images?: string[];
  branch?: { id: string; name?: string; city?: string; brand?: { id: string; name?: string } | null } | null;
  distanceKm?: number;
  className?: string;
}

export function OfferCard(props: OfferCardProps) {
  const headlineDiscount = headline(props.offerType, props.discountValue);
  return (
    <Card className={cn('group flex flex-col overflow-hidden transition-shadow hover:shadow-md', props.className)}>
      <Link href={`/offers/${props.id}`} className="flex h-full flex-col">
        {/* Cards always show the discount tag on a brand gradient.
            Actual images/video render only on the offer detail page. */}
        <div className="relative aspect-[16/9] w-full bg-gradient-to-br from-primary/10 to-primary/30">
          <div className="flex h-full items-center justify-center text-5xl font-bold text-primary/60">
            {headlineDiscount}
          </div>
          {props.isFeatured ? (
            <Badge className="absolute left-2 top-2" variant="default">Featured</Badge>
          ) : null}
        </div>
        <CardHeader className="flex-1 space-y-1 pb-3">
          <CardTitle className="line-clamp-2 text-base">{props.title}</CardTitle>
          {props.branch?.brand?.name ? (
            <p className="text-xs text-muted-foreground">{props.branch.brand.name}</p>
          ) : null}
        </CardHeader>
        <CardContent className="pb-3 pt-0">
          {props.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{props.description}</p>
          ) : null}
        </CardContent>
        <CardFooter className="flex items-center justify-between pt-0 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Tag className="h-3 w-3" /> {headlineDiscount}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {props.branch?.city}
            {typeof props.distanceKm === 'number' ? ` · ${props.distanceKm.toFixed(1)} km` : ''}
          </span>
        </CardFooter>
      </Link>
    </Card>
  );
}

function headline(type: string, value: number): string {
  switch (type) {
    case 'PERCENTAGE': return `${Math.round(value)}% off`;
    case 'FLAT':       return `₹${Math.round(value)} off`;
    case 'BUY_ONE_GET_ONE': return 'BOGO';
    case 'FREE_ITEM':  return 'Free item';
    case 'BUNDLE':     return 'Bundle';
    default:           return 'Deal';
  }
}
