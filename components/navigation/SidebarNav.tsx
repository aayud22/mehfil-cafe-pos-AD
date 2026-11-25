'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavItem } from '@/lib/auth/roles';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { TranslationKey } from '@/lib/i18n/translations';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  FileBarChart,
  Settings,
  UtensilsCrossed,
  Grid,
  Wallet,
  Package,
  Truck,
  Users,
  ChefHat,
  Receipt,
  History,
} from 'lucide-react';

interface SidebarNavProps {
  items: NavItem[];
  onItemClick?: () => void;
}

export function SidebarNav({ items, onItemClick }: SidebarNavProps) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const getTranslatedLabel = (iconName: NavItem['iconName'], fallback: string) => {
    const key = `nav_${iconName}` as TranslationKey;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const isItemActive = (href: string) => {
    if (href === '/owner') {
      return pathname === '/owner';
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const renderIcon = (iconName: NavItem['iconName'], isActive: boolean) => {
    switch (iconName) {
      case 'dashboard':
        return (
          <LayoutDashboard
            className={`h-5 w-5 shrink-0 transition-colors ${
              isActive ? 'text-amber-500 scale-105' : 'text-amber-500/70'
            }`}
          />
        );
      case 'reports':
        return (
          <FileBarChart
            className={`h-5 w-5 shrink-0 transition-colors ${
              isActive ? 'text-violet-400 scale-105' : 'text-violet-400/70'
            }`}
          />
        );
      case 'settings':
        return (
          <Settings
            className={`h-5 w-5 shrink-0 transition-colors ${
              isActive ? 'text-slate-200 scale-105' : 'text-slate-400/70'
            }`}
          />
        );
      case 'menu':
        return (
          <UtensilsCrossed
            className={`h-5 w-5 shrink-0 transition-colors ${
              isActive ? 'text-blue-500 scale-105' : 'text-blue-500/70'
            }`}
          />
        );
      case 'tables':
        return (
          <Grid
            className={`h-5 w-5 shrink-0 transition-colors ${
              isActive ? 'text-emerald-500 scale-105' : 'text-emerald-500/70'
            }`}
          />
        );
      case 'expenses':
        return (
          <Wallet
            className={`h-5 w-5 shrink-0 transition-colors ${
              isActive ? 'text-rose-500 scale-105' : 'text-rose-500/70'
            }`}
          />
        );
      case 'stock':
        return (
          <Package
            className={`h-5 w-5 shrink-0 transition-colors ${
              isActive ? 'text-cyan-400 scale-105' : 'text-cyan-400/70'
            }`}
          />
        );
      case 'vendors':
        return (
          <Truck
            className={`h-5 w-5 shrink-0 transition-colors ${
              isActive ? 'text-orange-400 scale-105' : 'text-orange-400/70'
            }`}
          />
        );
      case 'staff':
        return (
          <Users
            className={`h-5 w-5 shrink-0 transition-colors ${
              isActive ? 'text-sky-400 scale-105' : 'text-sky-400/70'
            }`}
          />
        );
      case 'waiter':
        return (
          <Grid
            className={`h-5 w-5 shrink-0 transition-colors ${
              isActive ? 'text-purple-500 scale-105' : 'text-purple-500/70'
            }`}
          />
        );
      case 'kitchen':
        return (
          <ChefHat
            className={`h-5 w-5 shrink-0 transition-colors ${
              isActive ? 'text-amber-500 scale-105' : 'text-amber-500/70'
            }`}
          />
        );
      case 'cashier':
        return (
          <Receipt
            className={`h-5 w-5 shrink-0 transition-colors ${
              isActive ? 'text-emerald-500 scale-105' : 'text-emerald-500/70'
            }`}
          />
        );
      case 'history':
        return (
          <History
            className={`h-5 w-5 shrink-0 transition-colors ${
              isActive ? 'text-indigo-400 scale-105' : 'text-indigo-400/70'
            }`}
          />
        );
    }
  };

  return (
    <div className="space-y-1">
      {items.map((item) => {
        const active = isItemActive(item.href);
        return (
          <Link key={item.href} href={item.href} onClick={onItemClick} className="block">
            <Button
              variant="ghost"
              className={`w-full h-11 justify-start gap-3 text-sm transition-all rounded-xl ${
                active
                  ? 'bg-primary/15 text-primary font-bold border border-primary/30 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 font-medium'
              }`}
            >
              {renderIcon(item.iconName, active)}
              <span>{getTranslatedLabel(item.iconName, item.label)}</span>
            </Button>
          </Link>
        );
      })}
    </div>
  );
}
