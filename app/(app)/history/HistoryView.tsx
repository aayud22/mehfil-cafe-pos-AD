'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { HistoryFilters } from '@/schemas/history';
import { useBillsQuery } from '@/hooks/queries/useBillsQuery';
import { useCancelledOrdersQuery } from '@/hooks/queries/useCancelledOrdersQuery';
import { formatMoney, formatDateTime, todayInIndia } from '@/lib/format';
import { HistoryFiltersCard } from './HistoryFiltersCard';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  History,
  Receipt,
  Ban,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RotateCcw,
  Clock,
  Layers,
  User,
  Loader2,
} from 'lucide-react';

interface HistoryViewProps {
  initialRole: string;
  initialFilters: HistoryFilters;
}

export function HistoryView({ initialRole, initialFilters }: HistoryViewProps) {
  const isCashier = initialRole === 'cashier';
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Active filters state (managed entirely in-memory via React & TanStack Query)
  const [filters, setFilters] = useState<HistoryFilters>(() => ({
    ...initialFilters,
    tab: isCashier ? 'bills' : initialFilters.tab,
  }));

  const today = todayInIndia();

  // Keep the browser URL clean at /history without query parameters
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState(null, '', '/history');
    }
  }, []);

  // Invalidate queries when payments or orders change in realtime
  useEffect(() => {
    const channel = supabase
      .channel('history-realtime-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['bills'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['cancelled_orders'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);

  // TanStack Queries
  const billsQuery = useBillsQuery(
    {
      from: filters.from,
      to: filters.to,
      mode: filters.mode,
      page: filters.page,
      limit: 20,
    },
    filters.tab === 'bills'
  );

  const cancelledQuery = useCancelledOrdersQuery(
    {
      from: filters.from,
      to: filters.to,
      page: filters.page,
      limit: 20,
    },
    filters.tab === 'cancelled' && !isCashier
  );

  const activeQuery = filters.tab === 'bills' ? billsQuery : cancelledQuery;
  const isLoading = activeQuery.isLoading;
  const isFetching = activeQuery.isFetching;
  const isError = activeQuery.isError;
  const data = activeQuery.data;

  const handleFilterChange = (updates: Partial<HistoryFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  const handleReset = () => {
    setFilters({
      tab: filters.tab,
      from: today,
      to: today,
      mode: undefined,
      page: 1,
    });
  };

  // Summary strip metrics from RPC first row
  const firstRow = data?.[0];
  const totalRows = Number(firstRow?.total_rows || 0);
  const grandTotal = Number(firstRow?.grand_total || 0);
  const pageSize = 20;
  const totalPages = Math.ceil(totalRows / pageSize) || 1;

  const getModeBadge = (mode: string) => {
    const normalized = (mode || 'cash').toLowerCase();
    if (normalized.includes('+')) {
      return (
        <Badge variant="outline" className="text-xs font-semibold border-amber-500/30 text-amber-400 bg-amber-500/10">
          {mode}
        </Badge>
      );
    }
    switch (normalized) {
      case 'upi':
        return (
          <Badge variant="outline" className="text-xs font-semibold border-purple-500/30 text-purple-400 bg-purple-500/10">
            UPI / QR
          </Badge>
        );
      case 'card':
        return (
          <Badge variant="outline" className="text-xs font-semibold border-blue-500/30 text-blue-400 bg-blue-500/10">
            Card
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs font-semibold border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
            Cash
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-border pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
              <History className="h-6 w-6 text-primary" />
              <span>Bill History & Records</span>
              {isFetching && !isLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-1" />
              )}
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
              Audit settled customer receipts, rounds breakdown, and cancellations
            </p>
          </div>

          {/* Tab Selector (Owner & Manager only) */}
          {!isCashier && (
            <div className="flex items-center gap-1.5 bg-card p-1 rounded-xl border border-border self-start sm:self-auto">
              <Button
                size="sm"
                variant={filters.tab === 'bills' ? 'default' : 'ghost'}
                onClick={() => setFilters((prev) => ({ ...prev, tab: 'bills', page: 1 }))}
                className="h-9 px-3.5 text-xs font-bold gap-1.5"
              >
                <Receipt className="h-3.5 w-3.5" />
                <span>Bills</span>
              </Button>
              <Button
                size="sm"
                variant={filters.tab === 'cancelled' ? 'default' : 'ghost'}
                onClick={() => setFilters((prev) => ({ ...prev, tab: 'cancelled', page: 1 }))}
                className="h-9 px-3.5 text-xs font-bold gap-1.5"
              >
                <Ban className="h-3.5 w-3.5" />
                <span>Cancelled Orders</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Strip (Only on Bills Tab) */}
      {filters.tab === 'bills' && !isError && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="border-border bg-card/60 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Bills Settled
            </span>
            <div className="text-2xl md:text-3xl font-black text-foreground mt-1">
              {isLoading ? '—' : totalRows}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Matching selected criteria
            </p>
          </Card>

          <Card className="border-border bg-card/60 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Combined Billed Revenue
            </span>
            <div className="text-2xl md:text-3xl font-black text-emerald-500 mt-1">
              {isLoading ? '—' : formatMoney(grandTotal)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Net collected across rounds
            </p>
          </Card>
        </div>
      )}

      {/* Filter Card Component */}
      <HistoryFiltersCard
        filters={filters}
        isCashier={isCashier}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
      />

      {/* Main Content Area */}
      {isError ? (
        /* Friendly Error State */
        <Card className="flex flex-col items-center justify-center border-dashed py-16 text-center">
          <AlertCircle className="h-12 w-12 text-destructive/80" />
          <h3 className="mt-4 text-base font-semibold text-foreground">
            Unable to load records
          </h3>
          <p className="mt-1 text-xs md:text-sm text-muted-foreground max-w-sm">
            We encountered an unexpected error while retrieving transaction logs. Please try again.
          </p>
          <Button
            variant="outline"
            onClick={() => activeQuery.refetch()}
            className="mt-5 h-11 px-4 gap-2 border-border font-bold"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Retry</span>
          </Button>
        </Card>
      ) : isLoading ? (
        /* Loading Skeleton */
        <Card className="p-8 border-border bg-card/40 flex flex-col items-center justify-center space-y-3 min-h-[220px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-medium">Fetching history records...</p>
        </Card>
      ) : filters.tab === 'bills' ? (
        /* Bills Tab Listing */
        !data || data.length === 0 ? (
          <Card className="flex flex-col items-center justify-center border-dashed py-16 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground/60" />
            <h3 className="mt-4 text-base font-semibold text-foreground">
              No bills for this period
            </h3>
            <p className="mt-1 text-xs md:text-sm text-muted-foreground">
              Try adjusting the date range or payment filter above.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View */}
            <div className="hidden md:block rounded-xl border border-border bg-card/60 overflow-hidden shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Time</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Table</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Payment</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Rounds</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Cashier</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase tracking-wider">Discount</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase tracking-wider">Total</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row: any) => (
                    <TableRow
                      key={row.receipt_id}
                      className="border-border hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground py-3">
                        <Link href={`/cashier/receipt/${row.receipt_id}`} className="block">
                          {formatDateTime(row.paid_at)}
                        </Link>
                      </TableCell>
                      <TableCell className="font-bold text-foreground py-3">
                        <Link href={`/cashier/receipt/${row.receipt_id}`} className="block">
                          Table {row.table_label}
                        </Link>
                      </TableCell>
                      <TableCell className="py-3">
                        <Link href={`/cashier/receipt/${row.receipt_id}`} className="block">
                          {getModeBadge(row.mode)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-3">
                        <Link href={`/cashier/receipt/${row.receipt_id}`} className="block">
                          {row.orders_count} {row.orders_count === 1 ? 'round' : 'rounds'}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-3">
                        <Link href={`/cashier/receipt/${row.receipt_id}`} className="block">
                          {row.cashier_name || 'Staff'}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold py-3">
                        <Link href={`/cashier/receipt/${row.receipt_id}`} className="block">
                          {Number(row.discount_amount || 0) > 0 ? (
                            <span className="text-amber-400">
                              -{formatMoney(Number(row.discount_amount))}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-black text-sm text-foreground py-3">
                        <Link href={`/cashier/receipt/${row.receipt_id}`} className="block">
                          {formatMoney(Number(row.total))}
                        </Link>
                      </TableCell>
                      <TableCell className="py-3 text-muted-foreground">
                        <Link href={`/cashier/receipt/${row.receipt_id}`} className="block">
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card List View */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {data.map((row: any) => (
                <Link
                  key={row.receipt_id}
                  href={`/cashier/receipt/${row.receipt_id}`}
                  className="block focus:outline-none"
                >
                  <Card className="p-4 border-border bg-card/60 hover:border-primary/50 transition-colors shadow-sm">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-base text-foreground">
                          Table {row.table_label}
                        </span>
                        {getModeBadge(row.mode)}
                      </div>
                      <span className="text-base font-black text-foreground">
                        {formatMoney(Number(row.total))}
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(row.paid_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="h-3 w-3" />
                        {row.orders_count} {row.orders_count === 1 ? 'round' : 'rounds'}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs border-t border-border/40 pt-2 text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {row.cashier_name || 'Staff'}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-primary">
                        <span>View Receipt</span>
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )
      ) : (
        /* Cancelled Orders Tab Listing */
        !data || data.length === 0 ? (
          <Card className="flex flex-col items-center justify-center border-dashed py-16 text-center">
            <Ban className="h-12 w-12 text-muted-foreground/60" />
            <h3 className="mt-4 text-base font-semibold text-foreground">
              No cancelled orders for this period
            </h3>
            <p className="mt-1 text-xs md:text-sm text-muted-foreground">
              No orders were revoked or cancelled within this date window.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View */}
            <div className="hidden md:block rounded-xl border border-border bg-card/60 overflow-hidden shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Table</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Cancelled Time</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Reason</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Cancelled By</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Items Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row: any) => (
                    <TableRow key={row.order_id} className="border-border">
                      <TableCell className="font-bold text-foreground py-3">
                        Table {row.table_label}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground py-3">
                        {formatDateTime(row.cancelled_at)}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="destructive" className="text-xs font-semibold">
                          {row.cancel_reason}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-3">
                        {row.cancelled_by_name || 'Staff'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-3 max-w-xs truncate">
                        {row.items_summary || 'No items'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card List View */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {data.map((row: any) => (
                <Card key={row.order_id} className="p-4 border-border bg-card/60 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="font-bold text-base text-foreground">
                      Table {row.table_label}
                    </span>
                    <Badge variant="destructive" className="text-xs font-semibold">
                      {row.cancel_reason}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-mono text-[11px] flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(row.cancelled_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {row.cancelled_by_name || 'Staff'}
                    </span>
                  </div>

                  {row.items_summary && (
                    <div className="rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Items: </span>
                      {row.items_summary}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )
      )}

      {/* Pagination Controls */}
      {!isError && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button
            disabled={filters.page <= 1}
            variant="outline"
            onClick={() => handleFilterChange({ page: filters.page - 1 })}
            className="h-11 px-4 text-xs font-bold gap-1 border-border"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous</span>
          </Button>

          <span className="text-xs font-semibold text-muted-foreground">
            Page {filters.page} of {totalPages}
          </span>

          <Button
            disabled={filters.page >= totalPages}
            variant="outline"
            onClick={() => handleFilterChange({ page: filters.page + 1 })}
            className="h-11 px-4 text-xs font-bold gap-1 border-border"
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
