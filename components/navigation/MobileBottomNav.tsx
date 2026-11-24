'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Grid, ChefHat, Receipt, History } from 'lucide-react';

interface MobileBottomNavProps {
  role: string;
}

export function MobileBottomNav({ role }: MobileBottomNavProps) {
  const pathname = usePathname();

  const isOwnerOrManager = role === 'owner' || role === 'manager';

  if (!isOwnerOrManager) {
    return null;
  }

  const navs = [
    { href: '/owner', label: 'Owner', icon: LayoutDashboard },
    { href: '/waiter', label: 'Floor', icon: Grid },
    { href: '/kitchen', label: 'Kitchen', icon: ChefHat },
    { href: '/cashier', label: 'Billing', icon: Receipt },
    { href: '/history', label: 'History', icon: History },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-16 w-full items-center justify-around border-t border-border bg-card/95 px-2 backdrop-blur md:hidden print:hidden">
      {navs.map((item) => {
        const isActive =
          item.href === '/owner'
            ? pathname === '/owner'
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center py-1 transition-colors ${
              isActive
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className={`h-5 w-5 transition-transform ${isActive ? 'scale-110 text-primary' : ''}`} />
            <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
