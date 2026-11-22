import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mehfil Cafe | POS & Management System',
  description: 'Role-based cafe operations, realtime kitchen orders, billing and business dashboard.',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-amber-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
