'use client';

import { useEffect, useState } from 'react';
import { useTodayStats } from '@/hooks/useTodayStats';
import { createClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/format';
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
  Award,
  Calendar,
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
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';

interface TopItem {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
}

interface DailySales {
  date: string;
  label: string;
  amount: number;
}

export default function OwnerDashboardPage() {
  const { stats, isLoading, error, refetch } = useTodayStats();
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [weeklySales, setWeeklySales] = useState<DailySales[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(true);

  const supabase = createClient();

  const loadExtras = async () => {
    setLoadingExtras(true);
    try {
      // 1. Fetch Top 5 items sold today (strictly excluding voided items and cancelled orders)
      const { data: orderItems } = await supabase
        .from('order_items')
        .select(`
          quantity,
          unit_price,
          voided_at,
          menu_item:menu_items(id, name),
          order:orders!inner(status, created_at)
        `)
        .is('voided_at', null)
        .neq('order.status', 'cancelled')
        .in('order.status', ['served', 'billed']);

      if (orderItems) {
        const itemMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
        orderItems.forEach((item: any) => {
          if (!item.menu_item || item.voided_at) return;
          const id = item.menu_item.id;
          if (!itemMap[id]) {
            itemMap[id] = { name: item.menu_item.name, quantity: 0, revenue: 0 };
          }
          itemMap[id].quantity += item.quantity;
          itemMap[id].revenue += Number(item.unit_price) * item.quantity;
        });

        const sorted = Object.entries(itemMap)
          .map(([id, val]) => ({ id, ...val }))
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 5);

        setTopItems(sorted);
      }

      // 2. Fetch last 7 days sales
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const { data: payments } = await supabase
        .from('payments')
        .select('amount, paid_at')
        .gte('paid_at', sevenDaysAgo.toISOString())
        .order('paid_at', { ascending: true });

      // Build 7-day bucket in Asia/Kolkata timezone
      const dayMap: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
        dayMap[dateStr] = 0;
      }

      (payments || []).forEach((p) => {
        const pDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(p.paid_at));
        if (dayMap[pDate] !== undefined) {
          dayMap[pDate] += Number(p.amount);
        }
      });

      const weeklyList: DailySales[] = Object.entries(dayMap).map(([dateStr, amount]) => {
        const d = new Date(dateStr);
        const label = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' }).format(d);
        return { date: dateStr, label, amount };
      });

      setWeeklySales(weeklyList);
    } catch {
      // Ignore background analytics fetch errors
    } finally {
      setLoadingExtras(false);
    }
  };

  useEffect(() => {
    loadExtras();
  }, []);

  const handleRefresh = async () => {
    try {
      await Promise.all([refetch(), loadExtras()]);
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

  const totalCollected = Number(stats.today_sales || 0);
  const gstCollected = Number(stats.gst_collected_today || 0);
  const netSales = Number(stats.net_sales_today ?? totalCollected - gstCollected);
  const discountsGiven = Number(stats.discounts_today || 0);
  const expenses = Number(stats.today_expenses || 0);
  const profit = Number(stats.today_profit || 0);
  const totalOrders = stats.orders_count || 0;

  const chartData = [
    { name: 'UPI / QR', amount: Number(stats.mode_breakdown?.upi || 0), color: '#a855f7' },
    { name: 'Cash', amount: Number(stats.mode_breakdown?.cash || 0), color: '#10b981' },
    { name: 'Card', amount: Number(stats.mode_breakdown?.card || 0), color: '#3b82f6' },
  ];

  const totalWeekly = weeklySales.reduce((sum, d) => sum + d.amount, 0);

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
        {/* Total Collected */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total collected
            </span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-extrabold text-foreground">
              {formatMoney(totalCollected)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Net sales: {formatMoney(netSales)} · GST: {formatMoney(gstCollected)}
            </p>
          </CardContent>
        </Card>

        {/* GST & Discounts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              GST & Discounts
            </span>
            <div className="rounded-lg bg-purple-500/10 p-2 text-purple-400">
              <IndianRupee className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-extrabold text-foreground">
              {formatMoney(gstCollected)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              GST collected · Discounts given: {formatMoney(discountsGiven)}
            </p>
          </CardContent>
        </Card>

        {/* Today's Expenses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Today&apos;s Expenses
            </span>
            <div className="rounded-lg bg-rose-500/10 p-2 text-rose-500">
              <TrendingDown className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-extrabold text-foreground">
              {formatMoney(expenses)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Dairy, beans, inventory & sundries
            </p>
          </CardContent>
        </Card>

        {/* Net Profit (net sales minus expenses, excluding GST) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Net Profit ({totalOrders} orders)
            </span>
            <div
              className={`rounded-lg p-2 ${
                profit >= 0
                  ? 'bg-amber-500/10 text-amber-500'
                  : 'bg-red-500/10 text-red-500'
              }`}
            >
              <ShoppingBag className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl md:text-3xl font-extrabold ${
                profit >= 0 ? 'text-amber-500' : 'text-red-500'
              }`}
            >
              {formatMoney(profit)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Net sales ({formatMoney(netSales)}) minus expenses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart & Distribution Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Tender Channel Bar Chart with value labels and unclipped Y-axis */}
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
                <BarChart data={chartData} margin={{ top: 25, right: 15, left: 10, bottom: 5 }}>
                  <XAxis
                    dataKey="name"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    width={75}
                    stroke="#888888"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, (dataMax: number) => (dataMax > 0 ? 'auto' : 500)]}
                    tickFormatter={(value) => formatMoney(value)}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    content={({ active, payload, label }: any) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border border-slate-700 bg-slate-900/95 p-2.5 shadow-xl backdrop-blur-sm">
                            <p className="text-xs font-semibold text-slate-200">{label}</p>
                            <p className="text-xs font-bold text-foreground mt-1">
                              <span className="text-muted-foreground font-normal">Revenue: </span>
                              {formatMoney(Number(payload[0].value || 0))}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="amount"
                    radius={[8, 8, 0, 0]}
                    label={{
                      position: 'top',
                      fill: '#f8fafc',
                      fontSize: 11,
                      formatter: (val: any) => (val > 0 ? formatMoney(Number(val)) : ''),
                    }}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Channel Summary */}
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
                    {formatMoney(Number(stats.mode_breakdown?.upi || 0))}
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
                    {formatMoney(Number(stats.mode_breakdown?.cash || 0))}
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
                    {formatMoney(Number(stats.mode_breakdown?.card || 0))}
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

      {/* 7-Day Sales Chart & Top 5 Items Today */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 7-Day Sales Trend with Empty State */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span>Last 7 Days Sales Trend</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Total weekly volume: {formatMoney(totalWeekly)}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {totalWeekly === 0 ? (
              <div className="flex flex-col items-center justify-center h-52 border border-dashed border-border rounded-xl text-center p-4">
                <Calendar className="h-8 w-8 text-muted-foreground/60 mb-2" />
                <p className="text-xs font-semibold text-muted-foreground">
                  No sales recorded in the last 7 days.
                </p>
                <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                  Transactions will populate the weekly trend line automatically.
                </p>
              </div>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklySales} margin={{ top: 15, right: 15, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis dataKey="label" stroke="#888888" fontSize={11} tickLine={false} />
                    <YAxis
                      width={75}
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, (dataMax: number) => (dataMax > 0 ? 'auto' : 1000)]}
                      tickFormatter={(value) => formatMoney(value)}
                    />
                    <Tooltip
                      content={({ active, payload, label }: any) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-lg border border-slate-700 bg-slate-900/95 p-2.5 shadow-xl backdrop-blur-sm">
                              <p className="text-xs font-semibold text-slate-200">{label}</p>
                              <p className="text-xs font-bold text-amber-400 mt-1">
                                <span className="text-muted-foreground font-normal">Sales: </span>
                                {formatMoney(Number(payload[0].value || 0))}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      dot={{ fill: '#f59e0b', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top 5 Items Today with Empty State */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              <span>Top 5 Items Today</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Best-selling cafe dishes and drinks
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-52 border border-dashed border-border rounded-xl text-center p-4">
                <Award className="h-8 w-8 text-muted-foreground/60 mb-2" />
                <p className="text-xs font-semibold text-muted-foreground">
                  No items sold yet today.
                </p>
                <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                  Ordered items will rank here as bills settle.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {topItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card/60"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-foreground line-clamp-1">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.quantity} sold
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-foreground">
                      {formatMoney(item.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
