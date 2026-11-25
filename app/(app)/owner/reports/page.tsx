'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { MonthlyBusinessReport } from '@/types/database';
import { formatMoney, todayInIndia } from '@/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  FileBarChart,
  TrendingUp,
  TrendingDown,
  Users,
  IndianRupee,
  Printer,
  Calendar,
  Loader2,
  QrCode,
  Banknote,
  CreditCard,
  ShoppingBag,
  Ban,
  Truck,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export default function MonthlyReportPage() {
  const currentMonth = todayInIndia().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const supabase = createClient();

  const {
    data: report,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['monthly_business_report', selectedMonth],
    queryFn: async () => {
      const { data, error: rpcError } = await supabase.rpc('get_monthly_business_report', {
        p_month: selectedMonth,
      });
      if (rpcError) throw rpcError;
      return data as MonthlyBusinessReport;
    },
    staleTime: 60 * 1000,
  });

  const sales = Number(report?.total_sales || 0);
  const opExpenses = Number(report?.operating_expenses || 0);
  const salaryExpenses = Number(report?.salary_expenses || 0);
  const netProfit = Number(report?.net_profit || 0);
  const profitMargin = sales > 0 ? Math.round((netProfit / sales) * 100) : 0;

  // Format month title nicely e.g. "November 2026"
  const monthLabel = (() => {
    try {
      const [y, m] = selectedMonth.split('-').map(Number);
      return new Intl.DateTimeFormat('en-IN', {
        month: 'long',
        year: 'numeric',
      }).format(new Date(y, m - 1, 1));
    } catch {
      return selectedMonth;
    }
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <FileBarChart className="h-6 w-6 text-primary" />
            <span>Monthly Business Report</span>
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            Executive Profit & Loss statement for <strong className="text-foreground">{monthLabel}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2.5 print:hidden">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-11 w-44 text-xs bg-card"
            />
          </div>

          <Button
            variant="outline"
            onClick={() => window.print()}
            className="h-11 px-4 text-xs font-bold gap-2"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Print / PDF</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="flex flex-col items-center justify-center p-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground mt-2">
            Generating monthly financial statement for {monthLabel}...
          </p>
        </Card>
      ) : isError || !report ? (
        <Card className="border-destructive/60 bg-destructive/10 p-8 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
          <p className="text-sm font-semibold text-destructive">
            Unable to load report: {(error as Error)?.message || 'Database RPC error'}
          </p>
          <Button onClick={() => refetch()} variant="outline" className="mt-4 h-11 text-xs">
            Retry
          </Button>
        </Card>
      ) : (
        <>
          {/* 4 Main P&L KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border bg-card/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Monthly Revenue
                </span>
                <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl md:text-3xl font-black text-foreground">
                  {formatMoney(sales)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {report.orders_count} settled orders
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Operating Expenses
                </span>
                <div className="rounded-lg bg-rose-500/10 p-2 text-rose-500">
                  <TrendingDown className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl md:text-3xl font-black text-foreground">
                  {formatMoney(opExpenses)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Dairy, coffee beans, rent & vendors
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Staff Payroll
                </span>
                <div className="rounded-lg bg-blue-500/10 p-2 text-blue-500">
                  <Users className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl md:text-3xl font-black text-foreground">
                  {formatMoney(salaryExpenses)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Salaries, advances & bonuses paid
                </p>
              </CardContent>
            </Card>

            <Card
              className={`border-border ${
                netProfit >= 0 ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-red-500/5 border-red-500/30'
              }`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Net Monthly Profit
                </span>
                <Badge
                  variant={netProfit >= 0 ? 'success' : 'destructive'}
                  className="text-[10px] font-bold"
                >
                  {profitMargin}% Margin
                </Badge>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl md:text-3xl font-black ${
                    netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'
                  }`}
                >
                  {formatMoney(netProfit)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Revenue minus all expenses & payroll
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Revenue vs Expenses Chart */}
          <Card className="border-border bg-card/60">
            <CardHeader>
              <CardTitle className="text-base md:text-lg">
                Daily Revenue vs. Expenses ({monthLabel})
              </CardTitle>
              <CardDescription className="text-xs">
                Day-by-day cashflow comparison across the month
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={report.daily_breakdown || []}
                    margin={{ top: 15, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                    <XAxis
                      dataKey="day"
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      width={75}
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => formatMoney(val)}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                      content={({ active, payload }: any) => {
                        if (active && payload && payload.length) {
                          const row = payload[0].payload;
                          return (
                            <div className="rounded-lg border border-slate-700 bg-slate-900/95 p-3 shadow-xl backdrop-blur-sm space-y-1">
                              <p className="text-xs font-bold text-slate-200">{row.label}</p>
                              <p className="text-xs font-semibold text-emerald-400">
                                Sales: {formatMoney(Number(row.sales || 0))}
                              </p>
                              <p className="text-xs font-semibold text-rose-400">
                                Expenses: {formatMoney(Number(row.expenses || 0))}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                    <Bar dataKey="sales" name="Sales" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Bottom Breakdown Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Payment Channel Breakdown */}
            <Card className="border-border bg-card/60">
              <CardHeader>
                <CardTitle className="text-base md:text-lg">Tender Channel Breakdown</CardTitle>
                <CardDescription className="text-xs">
                  Monthly collections split by payment method
                </CardDescription>
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
                        {formatMoney(Number(report.upi_sales || 0))}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-purple-400 border-purple-500/30">
                    {sales > 0 ? Math.round((Number(report.upi_sales) / sales) * 100) : 0}%
                  </Badge>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                      <Banknote className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Cash Drawer</p>
                      <p className="text-base font-bold text-foreground">
                        {formatMoney(Number(report.cash_sales || 0))}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                    {sales > 0 ? Math.round((Number(report.cash_sales) / sales) * 100) : 0}%
                  </Badge>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Card Terminal</p>
                      <p className="text-base font-bold text-foreground">
                        {formatMoney(Number(report.card_sales || 0))}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-blue-400 border-blue-500/30">
                    {sales > 0 ? Math.round((Number(report.card_sales) / sales) * 100) : 0}%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Operational Health & Payables */}
            <Card className="border-border bg-card/60">
              <CardHeader>
                <CardTitle className="text-base md:text-lg">Operational Health & Payables</CardTitle>
                <CardDescription className="text-xs">
                  Order volume, cancellations & pending supplier dues
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Completed Orders</p>
                      <p className="text-base font-bold text-foreground">{report.orders_count}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">Avg Ticket: {formatMoney(report.orders_count > 0 ? Math.round(sales / report.orders_count) : 0)}</span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
                      <Ban className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Cancelled Orders</p>
                      <p className="text-base font-bold text-foreground">{report.cancelled_count}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">Audited</Badge>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">
                        Outstanding Vendor Dues
                      </p>
                      <p className="text-base font-bold text-orange-400">
                        {formatMoney(Number(report.vendor_dues_pending || 0))}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-orange-400 border-orange-500/30">
                    Payables
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
