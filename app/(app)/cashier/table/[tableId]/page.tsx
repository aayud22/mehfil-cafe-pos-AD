'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CafeTable, Order, PaymentMode, UserRole, OrderStatus } from '@/types/database';
import { payTable } from '@/app/actions/payments';
import { cancelOrder, voidOrderItem } from '@/app/actions/cancel';
import { formatMoney, formatTime } from '@/lib/format';
import { CancelReasonDialog } from '@/components/orders/CancelReasonDialog';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Check,
  QrCode,
  Banknote,
  CreditCard,
  Loader2,
  AlertTriangle,
  Clock,
  Layers,
  X,
  Ban,
} from 'lucide-react';

export default function CashierTableBillPage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [table, setTable] = useState<CafeTable | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [userRole, setUserRole] = useState<UserRole>('cashier');
  const [selectedMode, setSelectedMode] = useState<PaymentMode>('upi');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Cancellation dialog state
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    type: 'cancel_order' | 'void_item';
    id: string;
    title: string;
    description: string;
  }>({
    open: false,
    type: 'cancel_order',
    id: '',
    title: '',
    description: '',
  });

  const loadTableAndOrders = async () => {
    setLoading(true);

    // 0. User role
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile?.role) setUserRole(profile.role as UserRole);
    }

    // 1. Table info
    const { data: tableData } = await supabase
      .from('cafe_tables')
      .select('*')
      .eq('id', resolvedParams.tableId)
      .single();
    if (tableData) setTable(tableData as CafeTable);

    // 2. Orders for this table (active and uncancelled)
    const { data: orderList, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(*, menu_item:menu_items(*))
      `)
      .eq('table_id', resolvedParams.tableId)
      .in('status', ['new', 'preparing', 'ready', 'served'])
      .order('created_at', { ascending: true });

    if (!error && orderList) {
      setOrders(orderList as Order[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadTableAndOrders();

    // Subscribe to realtime changes on orders, items and tables for this specific table
    const channel = supabase
      .channel(`cashier-table-${resolvedParams.tableId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `table_id=eq.${resolvedParams.tableId}`,
        },
        () => {
          loadTableAndOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
        },
        () => {
          loadTableAndOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cafe_tables',
          filter: `id=eq.${resolvedParams.tableId}`,
        },
        () => {
          loadTableAndOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, resolvedParams.tableId]);

  if (loading || !table) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        Loading table bill and orders...
      </div>
    );
  }

  // Calculate item subtotal across all rounds, strictly excluding voided items
  const subtotal = orders.reduce((sum, order) => {
    const orderSum = (order.order_items || [])
      .filter((item) => !item.voided_at)
      .reduce((s, item) => s + Number(item.unit_price) * item.quantity, 0);
    return sum + orderSum;
  }, 0);

  // 5% GST (2.5% CGST + 2.5% SGST)
  const cgst = Math.round(subtotal * 0.025);
  const sgst = Math.round(subtotal * 0.025);
  const totalGst = cgst + sgst;
  const grandTotal = subtotal + totalGst;

  // Check if any order is still new, preparing, or ready
  const hasUnfinishedKitchenOrders = orders.some(
    (o) => o.status === 'new' || o.status === 'preparing' || o.status === 'ready'
  );

  // Cash calculations
  const cashReceivedNum = parseFloat(cashReceived) || 0;
  const changeToReturn = cashReceivedNum - grandTotal;
  const isCashInsufficient = selectedMode === 'cash' && cashReceivedNum < grandTotal;

  // Determine if current user can cancel an order based on role and status
  const canCancelOrder = (status: OrderStatus) => {
    if (userRole === 'owner' || userRole === 'manager') {
      return ['new', 'preparing', 'ready', 'served'].includes(status);
    }
    if (userRole === 'cashier' || userRole === 'waiter') {
      return status === 'new';
    }
    return false;
  };

  const handleSettleTable = async () => {
    if (hasUnfinishedKitchenOrders) {
      toast.error('Waiting for kitchen: orders are still being prepared.');
      return;
    }

    if (selectedMode === 'cash' && isCashInsufficient) {
      toast.error('Cash received is less than the total payable amount.');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await payTable({
        table_id: table.id,
        mode: selectedMode,
      });

      if (!res.ok) {
        toast.error('Payment Settlement Rejected', { description: res.error });
        setIsProcessing(false);
        return;
      }

      toast.success(
        `Table ${table.label} settled via ${selectedMode.toUpperCase()}!`
      );

      // Navigate to thermal receipt page on success
      if (res.receiptId) {
        router.push(`/cashier/receipt/${res.receiptId}`);
      } else {
        router.push('/cashier');
      }
      router.refresh();
    } catch {
      toast.error('Unexpected error processing transaction.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Button
        variant="ghost"
        onClick={() => router.push('/cashier')}
        className="h-11 px-3 gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Cashier Overview</span>
      </Button>

      <Card className="border-border shadow-md">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-black text-foreground">
                Table {table.label} Settlement
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Consolidated bill for {orders.length} {orders.length === 1 ? 'round' : 'rounds'}
              </CardDescription>
            </div>
            <Badge variant="outline" className="h-7 px-3 text-xs font-bold text-primary">
              {table.seats} Seats
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Kitchen Status Warning */}
          {hasUnfinishedKitchenOrders && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Waiting for kitchen:</span> Some rounds are still
                marked as New, Preparing, or Ready. You can only settle after all orders are
                served.
              </div>
            </div>
          )}

          {/* List of Every Round with its non-voided items */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              <span>Rounds Breakdown</span>
            </h4>

            {orders.map((ord, idx) => {
              const activeItems = (ord.order_items || []).filter((item) => !item.voided_at);
              const roundTotal = activeItems.reduce(
                (sum, item) => sum + Number(item.unit_price) * item.quantity,
                0
              );
              const isCancellable = canCancelOrder(ord.status);

              return (
                <div key={ord.id} className="rounded-xl border border-border bg-card/60 p-3.5">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="text-xs font-bold text-primary">Round {idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(ord.created_at)}
                      </span>
                      <Badge
                        variant={
                          ord.status === 'served'
                            ? 'success'
                            : ord.status === 'ready'
                            ? 'warning'
                            : 'info'
                        }
                        className="text-[10px]"
                      >
                        {ord.status}
                      </Badge>
                      {isCancellable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDialogState({
                              open: true,
                              type: 'cancel_order',
                              id: ord.id,
                              title: `Cancel Round ${idx + 1}`,
                              description:
                                'Are you sure you want to cancel this entire order round? This will be logged.',
                            })
                          }
                          className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 gap-1 ml-1"
                        >
                          <Ban className="h-3 w-3" />
                          <span>Cancel</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 divide-y divide-border/40 text-xs">
                    {activeItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-1.5 text-muted-foreground"
                      >
                        <div className="flex items-center gap-2">
                          {isCancellable && (
                            <button
                              type="button"
                              onClick={() =>
                                setDialogState({
                                  open: true,
                                  type: 'void_item',
                                  id: item.id,
                                  title: `Remove ${item.menu_item?.name || 'Item'}`,
                                  description: `Are you sure you want to remove this item from Round ${idx + 1}?`,
                                })
                              }
                              className="h-6 w-6 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors"
                              title="Remove item"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <span className="text-foreground">
                            {item.quantity}x {item.menu_item?.name}
                          </span>
                        </div>
                        <span className="font-semibold text-foreground">
                          {formatMoney(Number(item.unit_price) * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 border-t border-border/40 pt-1.5 flex justify-between text-xs font-bold">
                    <span className="text-muted-foreground">Round Subtotal:</span>
                    <span className="text-foreground">{formatMoney(roundTotal)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Financial Breakdown (Item Subtotal + 5% GST) */}
          <div className="space-y-2 border-t border-border pt-4 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Item Subtotal:</span>
              <span className="font-semibold text-foreground">{formatMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>CGST (2.5%):</span>
              <span className="font-semibold text-foreground">{formatMoney(cgst)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>SGST (2.5%):</span>
              <span className="font-semibold text-foreground">{formatMoney(sgst)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground border-t border-border/40 pt-1.5 font-medium">
              <span>Total GST (5%):</span>
              <span className="font-bold text-foreground">{formatMoney(totalGst)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2.5">
              <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Grand Total (Incl. Taxes):
              </span>
              <span className="text-2xl md:text-3xl font-black text-emerald-500">
                {formatMoney(grandTotal)}
              </span>
            </div>
          </div>

          {/* Payment Tender Buttons */}
          <div className="space-y-4 pt-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Select Payment Mode
            </label>

            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={selectedMode === 'upi' ? 'default' : 'outline'}
                disabled={hasUnfinishedKitchenOrders}
                onClick={() => setSelectedMode('upi')}
                className={`h-14 flex flex-col items-center justify-center p-2 ${
                  selectedMode === 'upi'
                    ? 'ring-2 ring-primary border-primary'
                    : ''
                }`}
              >
                <QrCode className="h-5 w-5 mb-1" />
                <span className="text-xs font-bold">UPI / QR</span>
              </Button>

              <Button
                type="button"
                variant={selectedMode === 'cash' ? 'default' : 'outline'}
                disabled={hasUnfinishedKitchenOrders}
                onClick={() => setSelectedMode('cash')}
                className={`h-14 flex flex-col items-center justify-center p-2 ${
                  selectedMode === 'cash'
                    ? 'ring-2 ring-primary border-primary'
                    : ''
                }`}
              >
                <Banknote className="h-5 w-5 mb-1" />
                <span className="text-xs font-bold">Cash</span>
              </Button>

              <Button
                type="button"
                variant={selectedMode === 'card' ? 'default' : 'outline'}
                disabled={hasUnfinishedKitchenOrders}
                onClick={() => setSelectedMode('card')}
                className={`h-14 flex flex-col items-center justify-center p-2 ${
                  selectedMode === 'card'
                    ? 'ring-2 ring-primary border-primary'
                    : ''
                }`}
              >
                <CreditCard className="h-5 w-5 mb-1" />
                <span className="text-xs font-bold">Card</span>
              </Button>
            </div>

            {/* Cash Tender Calculation Field */}
            {selectedMode === 'cash' && !hasUnfinishedKitchenOrders && (
              <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
                <label className="text-xs font-semibold text-muted-foreground">
                  Cash Received
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 500"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="h-11 text-base md:text-sm font-semibold"
                />

                {cashReceived !== '' && (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-muted-foreground">Change to Return:</span>
                    <span
                      className={`text-base font-bold ${
                        changeToReturn >= 0 ? 'text-emerald-500' : 'text-destructive'
                      }`}
                    >
                      {changeToReturn >= 0
                        ? formatMoney(changeToReturn)
                        : `Short by ${formatMoney(Math.abs(changeToReturn))}`}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Final Settlement Submit Button */}
            <Button
              onClick={handleSettleTable}
              disabled={isProcessing || hasUnfinishedKitchenOrders || isCashInsufficient}
              className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl gap-2 mt-4 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Settling Table...</span>
                </>
              ) : hasUnfinishedKitchenOrders ? (
                <span>Waiting for kitchen</span>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  <span>Settle Table {table.label} ({formatMoney(grandTotal)})</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cancellation and Item Removal Modal */}
      <CancelReasonDialog
        open={dialogState.open}
        onOpenChange={(open) => setDialogState((prev) => ({ ...prev, open }))}
        title={dialogState.title}
        description={dialogState.description}
        confirmLabel={dialogState.type === 'cancel_order' ? 'Cancel Order' : 'Remove Item'}
        onConfirm={async (reason) => {
          if (dialogState.type === 'cancel_order') {
            return await cancelOrder({ order_id: dialogState.id, reason });
          } else {
            return await voidOrderItem({ item_id: dialogState.id, reason });
          }
        }}
        onSuccess={loadTableAndOrders}
      />
    </div>
  );
}
