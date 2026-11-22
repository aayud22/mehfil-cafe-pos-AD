'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CafeTable, Order, PaymentMode } from '@/types/database';
import { payTable } from '@/app/actions/payments';
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
  const [selectedMode, setSelectedMode] = useState<PaymentMode>('upi');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTableAndOrders() {
      setLoading(true);

      // 1. Table info
      const { data: tableData } = await supabase
        .from('cafe_tables')
        .select('*')
        .eq('id', resolvedParams.tableId)
        .single();
      if (tableData) setTable(tableData as CafeTable);

      // 2. Orders for this table
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
    }

    loadTableAndOrders();
  }, [resolvedParams.tableId, supabase]);

  if (loading || !table) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        Loading table bill and orders...
      </div>
    );
  }

  // Calculate grand total across all rounds
  const grandTotal = orders.reduce((sum, order) => {
    const orderSum = (order.order_items || []).reduce(
      (s, item) => s + Number(item.unit_price) * item.quantity,
      0
    );
    return sum + orderSum;
  }, 0);

  // Check if any order is still new, preparing, or ready
  const hasUnfinishedKitchenOrders = orders.some(
    (o) => o.status === 'new' || o.status === 'preparing' || o.status === 'ready'
  );

  // Cash calculations
  const cashReceivedNum = parseFloat(cashReceived) || 0;
  const changeToReturn = cashReceivedNum - grandTotal;
  const isCashInsufficient = selectedMode === 'cash' && cashReceivedNum < grandTotal;

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
      // Calls server action payTable which executes pay_table RPC
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
        `Table ${table.label} settled for ₹${res.total.toLocaleString(
          'en-IN'
        )} via ${selectedMode.toUpperCase()}!`
      );
      router.push('/cashier');
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
        <span>Back to Occupied Tables</span>
      </Button>

      {/* Bill Card */}
      <Card className="shadow-2xl border-border/80">
        <CardHeader className="text-center pb-4 border-b border-dashed border-border">
          <Badge
            variant="outline"
            className="mx-auto mb-2 text-xs uppercase text-primary border-primary/30"
          >
            Consolidated Dining Bill
          </Badge>
          <CardTitle className="text-2xl md:text-3xl font-black tracking-wide text-foreground">
            MEHFIL CAFE
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Table: {table.label} • {orders.length} {orders.length === 1 ? 'Round' : 'Rounds'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Unfinished kitchen alert */}
          {hasUnfinishedKitchenOrders && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-400">Waiting for kitchen</p>
                <p className="text-muted-foreground mt-0.5">
                  Some rounds for this table are still being prepared. All orders must be
                  marked as 'Served' before the table can be billed.
                </p>
              </div>
            </div>
          )}

          {/* List of Every Round with its items */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              <span>Rounds Breakdown</span>
            </h4>

            {orders.map((ord, idx) => {
              const roundTotal = (ord.order_items || []).reduce(
                (sum, item) => sum + Number(item.unit_price) * item.quantity,
                0
              );
              return (
                <div key={ord.id} className="rounded-xl border border-border bg-card/60 p-3.5">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="text-xs font-bold text-primary">Round {idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(ord.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
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
                    </div>
                  </div>

                  <div className="mt-2 divide-y divide-border/40 text-xs">
                    {ord.order_items?.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between py-1.5 text-muted-foreground"
                      >
                        <span className="text-foreground">
                          {item.quantity}x {item.menu_item?.name}
                        </span>
                        <span className="font-semibold text-foreground">
                          ₹{Number(item.unit_price) * item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 border-t border-border/40 pt-1.5 flex justify-between text-xs font-bold">
                    <span className="text-muted-foreground">Round Subtotal:</span>
                    <span className="text-foreground">₹{roundTotal}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Grand Total */}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Grand Total:
            </span>
            <span className="text-2xl md:text-3xl font-black text-emerald-500">
              ₹{grandTotal.toLocaleString('en-IN')}
            </span>
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
                  Cash Received (₹)
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
                        ? `₹${changeToReturn.toLocaleString('en-IN')}`
                        : `Short by ₹${Math.abs(changeToReturn).toLocaleString('en-IN')}`}
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
                  <span>Settle Table {table.label} (₹{grandTotal})</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
