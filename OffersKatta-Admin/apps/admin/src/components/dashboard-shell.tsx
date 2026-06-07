'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  BarChart3,
  Briefcase,
  Building2,
  LayoutDashboard,
  MapPin,
  ShieldCheck,
  Star,
  Store,
  Tag,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SELLER_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/seller/dashboard', icon: LayoutDashboard },
  { label: 'Brands',    href: '/seller/brands',    icon: Building2 },
  { label: 'Offers',    href: '/seller/offers',    icon: Tag },
  { label: 'Team',      href: '/seller/team',      icon: Users },
  { label: 'Cities',    href: '/seller/cities',    icon: MapPin },
  { label: 'Subscription', href: '/seller/subscription', icon: BarChart3 },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Users',     href: '/admin/users',     icon: Users },
  { label: 'Brands',    href: '/admin/brands',    icon: Store },
  { label: 'Malls',     href: '/admin/malls',     icon: Building2 },
  { label: 'Cities',    href: '/admin/cities',    icon: MapPin },
  { label: 'Reviews',   href: '/admin/reviews',   icon: Star },
  { label: 'Enterprise', href: '/admin/enterprise', icon: Briefcase },
  { label: 'Verification', href: '/admin/brands?pending=1', icon: ShieldCheck },
];

interface ShellProps {
  area: 'seller' | 'admin';
  title?: string;
  children: ReactNode;
}

export function DashboardShell({ area, title, children }: ShellProps) {
  const pathname = usePathname();
  const nav = area === 'admin' ? ADMIN_NAV : SELLER_NAV;
  return (
    <div className="container mx-auto grid gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
      <aside className="md:sticky md:top-20 md:h-[calc(100vh-6rem)]">
        <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="min-w-0 space-y-6">
        {title ? <h1 className="text-2xl font-bold tracking-tight">{title}</h1> : null}
        {children}
      </main>
    </div>
  );
}
