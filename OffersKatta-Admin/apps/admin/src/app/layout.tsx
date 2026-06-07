import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { Navbar } from '@/components/navbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'OffersKatta — Management Panel',
  description: 'Manage your brands, branches, offers, team and subscription on OffersKatta.',
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
              OffersKatta — Management Panel
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
