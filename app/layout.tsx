import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { QueryProvider } from '@/components/providers/QueryProvider';

export const metadata: Metadata = {
  title: 'Mehfil Cafe | POS & Management System',
  description: 'Role-based cafe operations, realtime kitchen orders, billing, and business dashboard.',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
        <QueryProvider>
          {children}
        </QueryProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
