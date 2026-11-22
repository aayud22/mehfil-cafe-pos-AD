'use client';

import { useTodayStats } from '@/hooks/useTodayStats';
import { IndianRupee, TrendingUp, TrendingDown, ShoppingBag, CreditCard, Banknote, QrCode, RefreshCw } from 'lucide-react';

export default function OwnerDashboardPage() {
  const { stats, isLoading, error, refetch } = useTodayStats();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw className="h-5 w-5 animate-spin text-amber-500" />
          <span>Calculating today's cafe financial metrics...</span>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-xl border border-red-800 bg-red-950/40 p-6 text-center">
        <p className="text-red-200">Unable to load dashboard stats: {error}</p>
        <button
          onClick={() => refetch()}
          className="mt-4 rounded-lg bg-red-900/60 px-4 py-2 text-sm text-red-100 hover:bg-red-800"
        >
          Retry
        </button>
      </div>
    );
  }

  const sales = Number(stats.today_sales || 0);
  const expenses = Number(stats.today_expenses || 0);
  const profit = Number(stats.today_profit || 0);
  const totalOrders = stats.orders_count || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Owner Executive Dashboard</h1>
          <p className="text-sm text-slate-400">Real-time daily turnover, expenditures, and net profits</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 self-start rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Today's Sales */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Today's Sales</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-white">₹{sales.toLocaleString('en-IN')}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Gross revenue from settled bills today</p>
        </div>

        {/* Today's Expenses */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Today's Expenses</span>
            <div className="rounded-lg bg-rose-500/10 p-2 text-rose-400">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-white">₹{expenses.toLocaleString('en-IN')}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Dairy, beans, inventory & sundries</p>
        </div>

        {/* Today's Net Profit */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Net Profit</span>
            <div className={`rounded-lg p-2 ${profit >= 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
              <IndianRupee className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className={`text-2xl font-extrabold ${profit >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
              ₹{profit.toLocaleString('en-IN')}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Sales minus daily expenses</p>
        </div>

        {/* Total Orders */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Completed Orders</span>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-white">{totalOrders}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Total customer tables handled today</p>
        </div>
      </div>

      {/* Payment Modes Breakdown */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-white">Payment Method Distribution</h2>
        <p className="text-xs text-slate-400">Breakdown of settled revenue by settlement channel</p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-800/40 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
              <QrCode className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">UPI / QR Payment</p>
              <p className="text-lg font-bold text-white">₹{Number(stats.mode_breakdown?.upi || 0).toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-800/40 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Banknote className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Cash Register</p>
              <p className="text-lg font-bold text-white">₹{Number(stats.mode_breakdown?.cash || 0).toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-800/40 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Card Swipes (POS)</p>
              <p className="text-lg font-bold text-white">₹{Number(stats.mode_breakdown?.card || 0).toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
