import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  Role,
  ROLE_LABELS,
  navForRole,
  NavItem,
} from '@/lib/auth/roles';
import { signOutAction } from '@/app/actions/auth';
import {
  Coffee,
  LogOut,
  LayoutDashboard,
  UtensilsCrossed,
  Grid,
  Receipt,
  ChefHat,
  Wallet,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch verified role directly from server profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || profile.is_active === false) {
    redirect('/login');
  }

  const role = (profile.role as Role) || 'waiter';
  const roleNavItems = navForRole(role);
  const isSingleItemRole = roleNavItems.length <= 1;

  const renderIcon = (iconName: NavItem['iconName']) => {
    switch (iconName) {
      case 'dashboard':
        return <LayoutDashboard className="h-5 w-5 text-amber-500 shrink-0" />;
      case 'menu':
        return <UtensilsCrossed className="h-5 w-5 text-blue-500 shrink-0" />;
      case 'tables':
        return <Grid className="h-5 w-5 text-emerald-500 shrink-0" />;
      case 'expenses':
        return <Wallet className="h-5 w-5 text-rose-500 shrink-0" />;
      case 'waiter':
        return <Grid className="h-5 w-5 text-purple-500 shrink-0" />;
      case 'kitchen':
        return <ChefHat className="h-5 w-5 text-amber-500 shrink-0" />;
      case 'cashier':
        return <Receipt className="h-5 w-5 text-emerald-500 shrink-0" />;
    }
  };

  const NavList = () => (
    <div className="space-y-1">
      {roleNavItems.map((item) => (
        <Link key={item.href} href={item.href} className="block">
          <Button
            variant="ghost"
            className="w-full h-11 justify-start gap-3 text-sm font-medium"
          >
            {renderIcon(item.iconName)}
            <span>{item.label}</span>
          </Button>
        </Link>
      ))}
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground md:flex-row">
      {/* Mobile Top Header */}
      {isSingleItemRole ? (
        <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow">
              <Coffee className="h-4 w-4" />
            </div>
            <div>
              <span className="font-bold text-sm leading-none block">Mehfil Cafe</span>
              <span className="text-[10px] text-primary font-semibold uppercase">
                {ROLE_LABELS[role] || role}
              </span>
            </div>
          </div>

          <form action={signOutAction}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="h-9 px-2.5 text-xs text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4 mr-1" />
              <span>Sign Out</span>
            </Button>
          </form>
        </header>
      ) : (
        <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow">
              <Coffee className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-sm leading-none block">Mehfil Cafe</span>
              <span className="text-[10px] text-primary font-semibold uppercase">
                {ROLE_LABELS[role] || role}
              </span>
            </div>
          </Link>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11"
                aria-label="Open Navigation Menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[85vw] max-w-xs p-6 flex flex-col justify-between"
            >
              <div>
                <SheetHeader className="text-left pb-4">
                  <SheetTitle className="flex items-center gap-2">
                    <Coffee className="h-5 w-5 text-primary" />
                    <span>Mehfil Cafe POS</span>
                  </SheetTitle>
                  <div className="pt-2">
                    <Badge variant="secondary" className="text-xs">
                      {ROLE_LABELS[role]}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {profile?.full_name || user.email}
                    </p>
                  </div>
                </SheetHeader>
                <Separator className="my-3" />
                <NavList />
              </div>

              <div className="pt-6 border-t border-border">
                <form action={signOutAction}>
                  <Button
                    type="submit"
                    variant="destructive"
                    className="w-full h-11 justify-center gap-2 text-sm font-medium"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </Button>
                </form>
              </div>
            </SheetContent>
          </Sheet>
        </header>
      )}

      {/* Desktop Sidebar: Scrollable nav list & pinned Sign Out button */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:h-dvh md:sticky md:top-0 md:border-r md:border-border md:bg-card/60 p-4">
        {/* Brand Header */}
        <div className="flex items-center gap-3 pb-6 shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <Coffee className="h-5 w-5" />
          </div>
          <div>
            <span className="font-bold text-base tracking-wide block">Mehfil Cafe</span>
            <span className="text-[11px] uppercase tracking-wider text-primary font-semibold">
              {ROLE_LABELS[role] || role}
            </span>
          </div>
        </div>

        {/* Profile Card */}
        <div className="mb-4 rounded-xl border border-border bg-muted/40 p-3 shrink-0">
          <p className="text-xs text-muted-foreground">Logged in as</p>
          <p className="truncate text-xs font-semibold text-foreground">
            {profile?.full_name || user.email}
          </p>
          <Badge variant="outline" className="mt-1.5 text-[10px]">
            {role.toUpperCase()}
          </Badge>
        </div>

        {/* Scrollable Navigation List */}
        {!isSingleItemRole && (
          <nav className="flex-1 overflow-y-auto pr-1 space-y-1 scrollbar-thin">
            <NavList />
          </nav>
        )}

        {/* Pinned Sign Out Button (Always visible at bottom) */}
        <div className="pt-4 border-t border-border mt-auto shrink-0">
          <form action={signOutAction}>
            <Button
              type="submit"
              variant="outline"
              className="w-full h-11 justify-center gap-2 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </Button>
          </form>
        </div>
      </aside>

      {/* Main Content View */}
      <main
        className={`flex-1 overflow-y-auto p-4 md:p-8 w-full max-w-full ${
          !isSingleItemRole ? 'pb-20 md:pb-8' : 'pb-8'
        }`}
      >
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar for Owner/Manager */}
      {!isSingleItemRole && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-16 w-full items-center justify-around border-t border-border bg-card/95 px-2 backdrop-blur md:hidden">
          <Link
            href="/owner"
            className="flex flex-col items-center justify-center py-1 text-muted-foreground hover:text-foreground"
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-[10px] font-medium mt-0.5">Owner</span>
          </Link>
          <Link
            href="/waiter"
            className="flex flex-col items-center justify-center py-1 text-muted-foreground hover:text-foreground"
          >
            <Grid className="h-5 w-5" />
            <span className="text-[10px] font-medium mt-0.5">Floor</span>
          </Link>
          <Link
            href="/kitchen"
            className="flex flex-col items-center justify-center py-1 text-muted-foreground hover:text-foreground"
          >
            <ChefHat className="h-5 w-5" />
            <span className="text-[10px] font-medium mt-0.5">Kitchen</span>
          </Link>
          <Link
            href="/cashier"
            className="flex flex-col items-center justify-center py-1 text-muted-foreground hover:text-foreground"
          >
            <Receipt className="h-5 w-5" />
            <span className="text-[10px] font-medium mt-0.5">Billing</span>
          </Link>
        </nav>
      )}
    </div>
  );
}
