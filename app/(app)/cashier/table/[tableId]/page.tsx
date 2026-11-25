'use client';

import { use, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  CafeTable,
  Order,
  PaymentMode,
  UserRole,
  OrderStatus,
  AppSettings,
  BillPreview,
} from '@/types/database';
import { DISCOUNT_REASONS } from '@/schemas/payment';
import { payTable } from '@/app/actions/payments';
import { cancelOrder, voidOrderItem } from '@/app/actions/cancel';
import { formatMoney, formatTime } from '@/lib/format';
import { CancelReasonDialog } from '@/components/orders/CancelReasonDialog';
import { UpiQrCard } from '@/components/cashier/UpiQrCard';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Check,
  Loader2,
  AlertTriangle,
  Clock,
  Layers,
  X,
  Ban,
  Plus,
  Trash2,
  Percent,
  IndianRupee,
} from 'lucide-react';

interface PaymentLineState {
  id: string;
  mode: PaymentMode;
  amount: string;
  confirmed?: boolean;
}

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
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('cashier');
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Discount state
  const [discountType, setDiscountType] = useState<'none' | 'percent' | 'flat'>('none');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [discountReasonSelect, setDiscountReasonSelect] = useState<string>('');
  const [discountCustomReason, setDiscountCustomReason] = useState<string>('');

  // Live preview from RPC
  const [preview, setPreview] = useState<BillPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Payment lines state
  const [paymentLines, setPaymentLines] = useState<PaymentLineState[]>([
    { id: 'line-1', mode: 'cash', amount: '' },
  ]);
  const [userEditedPayments, setUserEditedPayments] = useState(false);

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

  const loadTableAndOrders = useCallback(async () => {
    setLoading(true);

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

    const [tableRes, ordersRes, settingsRes] = await Promise.all([
      supabase.from('cafe_tables').select('*').eq('id', resolvedParams.tableId).single(),
      supabase
        .from('orders')
        .select(`*, order_items(*, menu_item:menu_items(*))`)
        .eq('table_id', resolvedParams.tableId)
        .in('status', ['new', 'preparing', 'ready', 'served'])
        .order('created_at', { ascending: true }),
      supabase.from('app_settings').select('*').eq('id', 1).single(),
    ]);

    if (tableRes.data) setTable(tableRes.data as CafeTable);
    if (ordersRes.data) setOrders(ordersRes.data as Order[]);
    if (settingsRes.data) setSettings(settingsRes.data as AppSettings);

    setLoading(false);
  }, [supabase, resolvedParams.tableId]);

  useEffect(() => {
    loadTableAndOrders();

    const channel = supabase
      .channel(`cashier-table-${resolvedParams.tableId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `table_id=eq.${resolvedParams.tableId}` },
        () => loadTableAndOrders()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () =>
        loadTableAndOrders()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cafe_tables', filter: `id=eq.${resolvedParams.tableId}` },
        () => loadTableAndOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, resolvedParams.tableId, loadTableAndOrders]);

  // Debounced 300ms call to get_bill_preview RPC
  useEffect(() => {
    if (loading) return;

    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      const numVal = discountType === 'none' ? 0 : Math.max(0, parseFloat(discountValue) || 0);

      const { data, error } = await supabase.rpc('get_bill_preview', {
        p_table_id: resolvedParams.tableId,
        p_order_id: null,
        p_item_ids: null,
        p_discount_type: discountType,
        p_discount_value: numVal,
      });

      if (error) {
        setPreviewError(error.message);
        setPreview(null);
      } else if (data && Array.isArray(data) && data.length > 0) {
        const row = data[0];
        const nextPreview: BillPreview = {
          subtotal: Number(row.subtotal),
          discount_amount: Number(row.discount_amount),
          tax_rate: Number(row.tax_rate),
          tax_amount: Number(row.tax_amount),
          round_off: Number(row.round_off),
          total: Number(row.total),
        };
        setPreview(nextPreview);

        // Auto-fill initial Cash line if user hasn't manually edited lines
        if (!userEditedPayments) {
          setPaymentLines([{ id: 'line-1', mode: 'cash', amount: String(nextPreview.total) }]);
        }
      }
      setPreviewLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [loading, orders, discountType, discountValue, resolvedParams.tableId, supabase, userEditedPayments]);

  const hasUnfinishedKitchenOrders = useMemo(
    () => orders.some((o) => o.status === 'new' || o.status === 'preparing' || o.status === 'ready'),
    [orders]
  );

  const maxDiscountPercent = useMemo(() => {
    if (userRole === 'owner') return 100;
    if (userRole === 'manager') return Number(settings?.manager_max_discount_percent ?? 25);
    return Number(settings?.cashier_max_discount_percent ?? 10);
  }, [userRole, settings]);

  const finalDiscountReason =
    discountReasonSelect === 'Other' ? discountCustomReason.trim() : discountReasonSelect;

  // Paise-based comparison to avoid floating-point errors
  const totalPaise = Math.round((preview?.total ?? 0) * 100);
  const paidPaise = paymentLines.reduce((sum, line) => {
    const val = parseFloat(line.amount);
    return sum + (isNaN(val) || val < 0 ? 0 : Math.round(val * 100));
  }, 0);
  const remainingPaise = totalPaise - paidPaise;
  const remainingRupees = remainingPaise / 100;

  const canCancelOrder = (status: OrderStatus) => {
    if (userRole === 'owner' || userRole === 'manager') {
      return ['new', 'preparing', 'ready', 'served'].includes(status);
    }
    if (userRole === 'cashier' || userRole === 'waiter') {
      return status === 'new';
    }
    return false;
  };

  const handleAddPaymentLine = () => {
    setUserEditedPayments(true);
    const fillAmount = remainingPaise > 0 ? (remainingPaise / 100).toFixed(2).replace(/\.00$/, '') : '';
    setPaymentLines((prev) => [
      ...prev,
      { id: `line-${Date.now()}`, mode: 'upi', amount: fillAmount, confirmed: false },
    ]);
  };

  const handleRemovePaymentLine = (id: string) => {
    setUserEditedPayments(true);
    setPaymentLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleUpdateLine = (id: string, field: 'mode' | 'amount', val: string) => {
    setUserEditedPayments(true);
    setPaymentLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: val, confirmed: false } : l))
    );
  };

  const handleToggleUpiConfirmed = (id: string, checked: boolean) => {
    setPaymentLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, confirmed: checked } : l))
    );
  };

  const handleFillRemainingOnLast = (id: string) => {
    setUserEditedPayments(true);
    const otherPaise = paymentLines
      .filter((l) => l.id !== id)
      .reduce((sum, l) => sum + Math.round((parseFloat(l.amount) || 0) * 100), 0);
    const rem = Math.max(0, totalPaise - otherPaise) / 100;
    setPaymentLines((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, amount: rem.toFixed(2).replace(/\.00$/, ''), confirmed: false } : l
      )
    );
  };

  const handleSettleTable = async () => {
    if (!table || !preview) return;

    if (discountType !== 'none' && !finalDiscountReason) {
      toast.error('Please select or enter a discount reason');
      return;
    }

    if (remainingPaise !== 0) {
      toast.error('Payment lines must equal the bill total');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await payTable({
        table_id: table.id,
        payments: paymentLines.map((l) => ({
          mode: l.mode,
          amount: parseFloat(l.amount) || 0,
        })),
        discount_type: discountType,
        discount_value: discountType === 'none' ? 0 : parseFloat(discountValue) || 0,
        discount_reason: discountType === 'none' ? null : finalDiscountReason,
      });

      if (!res.ok) {
        toast.error('Settlement Failed', { description: res.error });
        setIsProcessing(false);
        return;
      }

      toast.success(`Table ${table.label} settled successfully!`);
      router.push(`/cashier/receipt/${res.billId}`);
      router.refresh();
    } catch {
      toast.error('An unexpected error occurred during settlement.');
      setIsProcessing(false);
    }
  };

  if (loading || !table) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        Loading table bill and orders...
      </div>
    );
  }

  const taxHalfRate = (preview?.tax_rate ?? 0) / 2;
  const cgstAmount = (preview?.tax_amount ?? 0) / 2;
  const sgstAmount = (preview?.tax_amount ?? 0) - cgstAmount;
  const hasUnconfirmedUpi = paymentLines.some(
    (l) => l.mode === 'upi' && (parseFloat(l.amount) || 0) > 0 && !l.confirmed
  );
  const isPayDisabled =
    isProcessing ||
    previewLoading ||
    !preview ||
    preview.total <= 0 ||
    hasUnfinishedKitchenOrders ||
    remainingPaise !== 0 ||
    hasUnconfirmedUpi ||
    (discountType !== 'none' && !finalDiscountReason);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      {/* Top Header */}
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push('/cashier')}
          className="h-11 w-11 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-foreground">
              Settle Table {table.label}
            </h1>
            <Badge variant="secondary" className="text-xs font-bold gap-1">
              <Layers className="h-3 w-3" />
              <span>{orders.length} {orders.length === 1 ? 'Round' : 'Rounds'}</span>
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Apply discounts, split payments, and print GST tax receipt
          </p>
        </div>
      </div>

      {/* Kitchen Warning */}
      {hasUnfinishedKitchenOrders && (
        <Card className="border-amber-500/60 bg-amber-500/10 p-4 text-amber-400">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-sm">Kitchen orders still in progress</p>
              <p className="text-amber-300/90 mt-0.5">
                All rounds must be marked as &quot;served&quot; before the table can be closed.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Unbilled Rounds & Items */}
      <Card className="border-border shadow-md">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base md:text-lg">Unbilled Items Breakdown</CardTitle>
          <CardDescription className="text-xs">
            Served items awaiting billing for Table {table.label}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No active unbilled orders for this table.
            </p>
          ) : (
            orders.map((ord, idx) => {
              const activeItems = (ord.order_items || []).filter(
                (i) => !i.voided_at && !(i as any).bill_id
              );
              if (activeItems.length === 0) return null;
              const isCancellable = canCancelOrder(ord.status);

              return (
                <div key={ord.id} className="rounded-xl border border-border bg-muted/20 p-3.5">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-bold text-primary">
                        Round {idx + 1}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(ord.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={ord.status === 'served' ? 'secondary' : 'warning'}
                        className="text-[10px] uppercase font-bold"
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
                              description: 'Are you sure you want to cancel this entire round?',
                            })
                          }
                          className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 gap-1"
                        >
                          <Ban className="h-3 w-3" />
                          <span>Cancel</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-border/50 text-xs">
                    {activeItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-1.5">
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
                                  description: `Remove ${item.quantity}x ${item.menu_item?.name || 'Item'}?`,
                                })
                              }
                              className="h-6 w-6 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/15"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <div>
                            <span className="font-medium text-foreground block">
                              {item.quantity} × {item.menu_item?.name || 'Item'}
                            </span>
                            {Array.isArray(item.modifiers) && item.modifiers.length > 0 && (
                              <span className="text-[11px] text-muted-foreground block">
                                {item.modifiers.map((m) => m.option).join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="font-semibold text-foreground">
                          {formatMoney(Number(item.unit_price) * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Discount + Live RPC Summary + Payment Lines */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left: Discount & Summary */}
        <Card className="border-border shadow-md">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Discount & Tax Summary</CardTitle>
              <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">
                Your limit: {maxDiscountPercent}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Discount Type Toggle */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Discount Type
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {(['none', 'percent', 'flat'] as const).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    size="sm"
                    variant={discountType === type ? 'default' : 'outline'}
                    onClick={() => {
                      setDiscountType(type);
                      if (type === 'none') {
                        setDiscountValue('');
                        setDiscountReasonSelect('');
                        setDiscountCustomReason('');
                      }
                      setUserEditedPayments(false);
                    }}
                    className="h-11 text-xs font-bold capitalize gap-1"
                  >
                    {type === 'percent' && <Percent className="h-3.5 w-3.5" />}
                    {type === 'flat' && <IndianRupee className="h-3.5 w-3.5" />}
                    <span>{type === 'none' ? 'None' : type === 'percent' ? 'Percent %' : 'Flat ₹'}</span>
                  </Button>
                ))}
              </div>
            </div>

            {discountType !== 'none' && (
              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {discountType === 'percent' ? 'Discount (%)' : 'Flat Discount (₹)'}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder={discountType === 'percent' ? 'e.g. 10' : 'e.g. 50'}
                    value={discountValue}
                    onChange={(e) => {
                      setDiscountValue(e.target.value);
                      setUserEditedPayments(false);
                    }}
                    className="h-11 text-sm font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Reason (Required)</Label>
                  <Select value={discountReasonSelect} onValueChange={setDiscountReasonSelect}>
                    <SelectTrigger className="h-11 text-xs">
                      <SelectValue placeholder="Select discount reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {DISCOUNT_REASONS.map((r) => (
                        <SelectItem key={r} value={r} className="text-xs">
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {discountReasonSelect === 'Other' && (
                  <Input
                    placeholder="Specify reason..."
                    maxLength={120}
                    value={discountCustomReason}
                    onChange={(e) => setDiscountCustomReason(e.target.value)}
                    className="h-11 text-xs"
                  />
                )}
              </div>
            )}

            {/* Live Server-Computed Summary */}
            {previewError ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive font-medium">
                {previewError}
              </div>
            ) : (
              <div className="space-y-2 border-t border-border pt-3 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-semibold text-foreground">
                    {formatMoney(preview?.subtotal ?? 0)}
                  </span>
                </div>

                {(preview?.discount_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Discount</span>
                    <span className="font-semibold">
                      -{formatMoney(preview?.discount_amount ?? 0)}
                    </span>
                  </div>
                )}

                {(preview?.tax_rate ?? 0) > 0 && (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>CGST ({taxHalfRate}%)</span>
                      <span>{formatMoney(cgstAmount)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>SGST ({taxHalfRate}%)</span>
                      <span>{formatMoney(sgstAmount)}</span>
                    </div>
                  </>
                )}

                {Math.abs(preview?.round_off ?? 0) > 0.001 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Round off</span>
                    <span>
                      {(preview?.round_off ?? 0) > 0 ? '+' : ''}
                      {(preview?.round_off ?? 0).toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border pt-2.5">
                  <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Total
                  </span>
                  <span className="text-2xl font-black text-emerald-500 flex items-center gap-1.5">
                    {previewLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {formatMoney(preview?.total ?? 0)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Payment Lines */}
        <Card className="border-border shadow-md flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Payment Lines</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddPaymentLine}
                disabled={hasUnfinishedKitchenOrders}
                className="h-9 text-xs font-bold gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add payment</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              {paymentLines.map((line, index) => {
                const lineAmt = parseFloat(line.amount) || 0;
                return (
                <div key={line.id} className="space-y-2">
                <div
                  className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 p-2.5"
                >
                  <Select
                    value={line.mode}
                    onValueChange={(val) => handleUpdateLine(line.id, 'mode', val)}
                  >
                    <SelectTrigger className="h-11 w-28 text-xs font-bold shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash" className="text-xs">Cash</SelectItem>
                      <SelectItem value="upi" className="text-xs">UPI</SelectItem>
                      <SelectItem value="card" className="text-xs">Card</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Amount"
                    value={line.amount}
                    onChange={(e) => handleUpdateLine(line.id, 'amount', e.target.value)}
                    className="h-11 text-sm font-bold flex-1"
                  />

                  {index === paymentLines.length - 1 && remainingPaise !== 0 && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleFillRemainingOnLast(line.id)}
                      className="h-11 px-2.5 text-[11px] font-bold shrink-0"
                    >
                      Fill
                    </Button>
                  )}

                  {paymentLines.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemovePaymentLine(line.id)}
                      className="h-11 w-10 text-destructive hover:bg-destructive/10 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {line.mode === 'upi' && lineAmt > 0 && (
                  <UpiQrCard
                    upiId={settings?.upi_id}
                    payeeName={settings?.upi_payee_name || settings?.cafe_name}
                    amount={lineAmt}
                    noteLabel={`Bill Table ${table.label}`}
                    confirmed={Boolean(line.confirmed)}
                    onConfirmedChange={(checked) => handleToggleUpiConfirmed(line.id, checked)}
                  />
                )}
                </div>
                );
              })}

              {/* Remaining Indicator */}
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs">
                <span className="text-muted-foreground font-semibold">Remaining:</span>
                <span
                  className={`font-black ${
                    remainingPaise === 0
                      ? 'text-emerald-500'
                      : remainingPaise > 0
                      ? 'text-amber-400'
                      : 'text-destructive'
                  }`}
                >
                  {formatMoney(remainingRupees)}
                </span>
              </div>
            </div>

            <Button
              onClick={handleSettleTable}
              disabled={isPayDisabled}
              className="w-full h-11 text-base font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg gap-2 mt-4"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  <span>Pay {formatMoney(preview?.total ?? 0)}</span>
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Cancellation / Void AlertDialog */}
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
