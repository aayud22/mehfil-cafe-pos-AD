import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ROLE_LABELS } from '@/lib/auth/roles';
import { UserRole } from '@/types/database';
import { Coffee, LogOut, LayoutDashboard, UtensilsCrossed, Grid, Receipt, ChefHat, Wallet } from 'lucide-react';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const role = (profile?.role as UserRole) || 'waiter';

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full border-b border-slate-800 bg-slate-900/60 p-4 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between pb-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 text-white shadow-md">
              <Coffee className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-white tracking-wide block">Mehfil Cafe</span>
              <span className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold">
                {ROLE_LABELS[role] || role}
              </span>
            </div>
          </Link>
        </div>

        {/* User Card */}
        <div className="mb-6 rounded-lg bg-slate-800/60 p-3 border border-slate-700/60">
          <p className="text-xs text-slate-400">Signed in as</p>
          <p className="truncate text-sm font-medium text-slate-100">{profile?.full_name || user.email}</p>
        </div>

        {/* Navigation Links based on role */}
        <nav className="space-y-1 text-sm">
          {(role === 'owner' || role === 'manager') && (
            <Link
              href="/owner"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <LayoutDashboard className="h-4 w-4 text-amber-400" />
              <span>Owner Dashboard</span>
            </Link>
          )}

          {(role === 'owner' || role === 'manager') && (
            <>
              <Link
                href="/manager/menu"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <UtensilsCrossed className="h-4 w-4 text-blue-400" />
                <span>Menu Catalog</span>
              </Link>
              <Link
                href="/manager/tables"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <Grid className="h-4 w-4 text-emerald-400" />
                <span>Tables Layout</span>
              </Link>
              <Link
                href="/manager/expenses"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <Wallet className="h-4 w-4 text-rose-400" />
                <span>Daily Expenses</span>
              </Link>
            </>
          )}

          <Link
            href="/waiter"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <Grid className="h-4 w-4 text-purple-400" />
            <span>Waiter POS (Floor)</span>
          </Link>

          <Link
            href="/kitchen"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <ChefHat className="h-4 w-4 text-amber-400" />
            <span>Kitchen Display (KDS)</span>
          </Link>

          <Link
            href="/cashier"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <Receipt className="h-4 w-4 text-emerald-400" />
            <span>Cashier Billing</span>
          </Link>
        </nav>

        {/* Sign out form */}
        <div className="pt-8 mt-auto">
          <form action="/login" method="GET">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-red-950/40 hover:text-red-300 transition"
            >
              <LogOut className="h-4 w-4" />
              <span>Switch / Sign Out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
