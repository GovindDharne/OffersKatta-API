import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { Navbar } from '@/components/navbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'OffersKatta — Discover nearby deals',
  description:
    'Find promotional offers from restaurants, hotels, salons, gyms, shops, and local businesses near you.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <div className="flex-1">{children}</div>
            <footer className="border-t bg-muted/40 py-6 text-center text-sm text-muted-foreground">
              OffersKatta — built with Next.js, NestJS, Prisma, Postgres
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
