'use client';

import { useTodayStats } from '@/hooks/useTodayStats';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  IndianRupee,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  CreditCard,
  Banknote,
  QrCode,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';

export default function OwnerDashboardPage() {
  const { stats, isLoading, error, refetch } = useTodayStats();

  const handleRefresh = async () => {
    try {
      await refetch();
      toast.success('Financial figures refreshed!');
    } catch {
      toast.error('Failed to refresh data');
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
          <span>Calculating real-time cafe financial metrics...</span>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <Card className="border-destructive/60 bg-destructive/10 p-6 text-center">
        <p className="text-sm font-medium text-destructive">
          Unable to load dashboard stats: {error}
        </p>
        <Button
          onClick={handleRefresh}
          variant="outline"
          className="mt-4 h-11 text-xs"
        >
          Try Again
        </Button>
      </Card>
    );
  }

  const sales = Number(stats.today_sales || 0);
  const expenses = Number(stats.today_expenses || 0);
  const profit = Number(stats.today_profit || 0);
  const totalOrders = stats.orders_count || 0;

  const chartData = [
    { name: 'UPI / QR', amount: Number(stats.mode_breakdown?.upi || 0), color: '#a855f7' },
    { name: 'Cash', amount: Number(stats.mode_breakdown?.cash || 0), color: '#10b981' },
    { name: 'Card', amount: Number(stats.mode_breakdown?.card || 0), color: '#3b82f6' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
            Owner Executive Dashboard
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Daily turnover, expenditures, and net cafe profits
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          className="h-11 w-full sm:w-auto gap-2 text-xs font-semibold"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh Metrics</span>
        </Button>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Today's Sales */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Today's Sales
            </span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-extrabold text-foreground">
              ₹{sales.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Gross billed revenue today
            </p>
          </CardContent>
        </Card>

        {/* Today's Expenses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Today's Expenses
            </span>
            <div className="rounded-lg bg-rose-500/10 p-2 text-rose-500">
              <TrendingDown className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-extrabold text-foreground">
              ₹{expenses.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Dairy, beans, inventory & sundries
            </p>
          </CardContent>
        </Card>

        {/* Today's Net Profit */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Net Profit
            </span>
            <div
              className={`rounded-lg p-2 ${
                profit >= 0
                  ? 'bg-amber-500/10 text-amber-500'
                  : 'bg-red-500/10 text-red-500'
              }`}
            >
              <IndianRupee className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl md:text-3xl font-extrabold ${
                profit >= 0 ? 'text-amber-500' : 'text-red-500'
              }`}
            >
              ₹{profit.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Sales minus daily logged expenses
            </p>
          </CardContent>
        </Card>

        {/* Total Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Orders Served
            </span>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-500">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-extrabold text-foreground">
              {totalOrders}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Customer dining tables handled
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart & Distribution Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Responsive Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base md:text-lg">
              Revenue by Settlement Channel
            </CardTitle>
            <CardDescription className="text-xs">
              Real-time tender breakdown across Cash, UPI, and Card
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `₹${value}`}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem' }}
                    formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']}
                  />
                  <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Quick Breakdown Cards */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Tender Summary</CardTitle>
            <CardDescription className="text-xs">Individual channel breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                  <QrCode className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">UPI / QR Code</p>
                  <p className="text-base font-bold text-foreground">
                    ₹{Number(stats.mode_breakdown?.upi || 0).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-purple-400 border-purple-500/30">
                UPI
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Banknote className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Cash Register</p>
                  <p className="text-base font-bold text-foreground">
                    ₹{Number(stats.mode_breakdown?.cash || 0).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                Cash
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Card POS Swipes</p>
                  <p className="text-base font-bold text-foreground">
                    ₹{Number(stats.mode_breakdown?.card || 0).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-blue-400 border-blue-500/30">
                Card
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
