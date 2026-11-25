'use client';

import { use, useEffect, useState, useCallback, useMemo } from 'react';
import {
  Order,
  UserRole,
  PaymentMode,
  AppSettings,
  BillPreview,
} from '@/types/database';
import {
  Select,
  SelectItem,
  SelectValue,
  SelectContent,
  SelectTrigger,
} from '@/components/ui/select';
import {
  X,
  Ban,
  Plus,
  User,
  Check,
  Clock,
  Trash2,
  Loader2,
  Percent,
  ArrowLeft,
  IndianRupee,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { payTable } from '@/app/actions/payments';
import { createClient } from '@/lib/supabase/client';
import { DISCOUNT_REASONS } from '@/schemas/payment';
import { formatMoney, formatTime } from '@/lib/format';
import { getOrderDisplayLabel } from '@/lib/order-label';
import { cancelOrder, voidOrderItem } from '@/app/actions/cancel';
import { CancelReasonDialog } from '@/components/orders/CancelReasonDialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';


interface PaymentLineState {
  id: string;
  mode: PaymentMode;
  amount: string;
}

export default function CashierOrderBillPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [order, setOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('cashier');
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [discountType, setDiscountType] = useState<'none' | 'percent' | 'flat'>('none');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [discountReasonSelect, setDiscountReasonSelect] = useState<string>('');
  const [discountCustomReason, setDiscountCustomReason] = useState<string>('');

  const [preview, setPreview] = useState<BillPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [paymentLines, setPaymentLines] = useState<PaymentLineState[]>([
    { id: 'line-1', mode: 'cash', amount: '' },
  ]);
  const [userEditedPayments, setUserEditedPayments] = useState(false);

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

  const loadOrder = useCallback(async () => {
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

    const [orderRes, settingsRes] = await Promise.all([
      supabase
        .from('orders')
        .select(`*, order_items(*, menu_item:menu_items(*))`)
        .eq('id', resolvedParams.orderId)
        .single(),
      supabase.from('app_settings').select('*').eq('id', 1).single(),
    ]);

    if (orderRes.data) setOrder(orderRes.data as Order);
    if (settingsRes.data) setSettings(settingsRes.data as AppSettings);
    setLoading(false);
  }, [supabase, resolvedParams.orderId]);

  useEffect(() => {
    loadOrder();

    const channel = supabase
      .channel(`cashier-order-${resolvedParams.orderId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${resolvedParams.orderId}` },
        () => loadOrder()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () =>
        loadOrder()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, resolvedParams.orderId, loadOrder]);

  useEffect(() => {
    if (loading || !order) return;

    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      const numVal = discountType === 'none' ? 0 : Math.max(0, parseFloat(discountValue) || 0);

      const { data, error } = await supabase.rpc('get_bill_preview', {
        p_table_id: null,
        p_order_id: order.id,
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

        if (!userEditedPayments) {
          setPaymentLines([{ id: 'line-1', mode: 'cash', amount: String(nextPreview.total) }]);
        }
      }
      setPreviewLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [loading, order, discountType, discountValue, supabase, userEditedPayments]);

  const maxDiscountPercent = useMemo(() => {
    if (userRole === 'owner') return 100;
    if (userRole === 'manager') return Number(settings?.manager_max_discount_percent ?? 25);
    return Number(settings?.cashier_max_discount_percent ?? 10);
  }, [userRole, settings]);

  const finalDiscountReason =
    discountReasonSelect === 'Other' ? discountCustomReason.trim() : discountReasonSelect;

  const totalPaise = Math.round((preview?.total ?? 0) * 100);
  const paidPaise = paymentLines.reduce((sum, line) => {
    const val = parseFloat(line.amount);
    return sum + (isNaN(val) || val < 0 ? 0 : Math.round(val * 100));
  }, 0);
  const remainingPaise = totalPaise - paidPaise;
  const remainingRupees = remainingPaise / 100;

  const handleSettleOrder = async () => {
    if (!order || !preview) return;
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
        table_id: null,
        order_id: order.id,
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

      toast.success(`${getOrderDisplayLabel(order)} settled!`);
      router.push(`/cashier/receipt/${res.billId}`);
      router.refresh();
    } catch {
      toast.error('Unexpected error during settlement.');
      setIsProcessing(false);
    }
  };

  if (loading || !order) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        Loading order bill...
      </div>
    );
  }

  const label = getOrderDisplayLabel(order);
  const isUnfinished = order.status !== 'served';
  const activeItems = (order.order_items || []).filter((i) => !i.voided_at && !(i as any).bill_id);
  const canCancel =
    userRole === 'owner' ||
    userRole === 'manager' ||
    ((userRole === 'cashier' || userRole === 'waiter') && order.status === 'new');

  const taxHalfRate = (preview?.tax_rate ?? 0) / 2;
  const cgstAmount = (preview?.tax_amount ?? 0) / 2;
  const sgstAmount = (preview?.tax_amount ?? 0) - cgstAmount;
  const isPayDisabled =
    isProcessing ||
    previewLoading ||
    !preview ||
    preview.total <= 0 ||
    isUnfinished ||
    remainingPaise !== 0 ||
    (discountType !== 'none' && !finalDiscountReason);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
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
            <h1 className="text-2xl font-extrabold text-foreground">Settle {label}</h1>
            <Badge variant="secondary" className="text-xs uppercase font-bold">
              {order.status}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {formatTime(order.created_at)}
            </span>
            {order.customer_name && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" /> {order.customer_name}
              </span>
            )}
          </div>
        </div>
      </div>

      {isUnfinished && (
        <Card className="border-amber-500/60 bg-amber-500/10 p-4 text-amber-400">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-sm">Order still in progress</p>
              <p className="text-amber-300/90 mt-0.5">
                Order must be marked as &quot;served&quot; before billing.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="border-border shadow-md">
        <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Items</CardTitle>
            <CardDescription className="text-xs">{label}</CardDescription>
          </div>
          {canCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setDialogState({
                  open: true,
                  type: 'cancel_order',
                  id: order.id,
                  title: `Cancel ${label}`,
                  description: 'Cancel this entire order? This will be logged.',
                })
              }
              className="h-9 px-3 text-xs text-destructive hover:bg-destructive/10 gap-1"
            >
              <Ban className="h-3.5 w-3.5" />
              <span>Cancel Order</span>
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-4 divide-y divide-border/50 text-xs">
          {activeItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                {canCancel && (
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
                <span className="font-medium text-foreground">
                  {item.quantity} × {item.menu_item?.name || 'Item'}
                </span>
              </div>
              <span className="font-semibold text-foreground">
                {formatMoney(Number(item.unit_price) * item.quantity)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="border-border shadow-md">
          <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-base">Discount & Tax Summary</CardTitle>
            <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">
              Your limit: {maxDiscountPercent}%
            </Badge>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
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

            {discountType !== 'none' && (
              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
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

            {previewError ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
                {previewError}
              </div>
            ) : (
              <div className="space-y-2 border-t border-border pt-3 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-semibold text-foreground">{formatMoney(preview?.subtotal ?? 0)}</span>
                </div>
                {(preview?.discount_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Discount</span>
                    <span>-{formatMoney(preview?.discount_amount ?? 0)}</span>
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
                    <span>{(preview?.round_off ?? 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border pt-2.5">
                  <span className="text-sm font-bold uppercase text-muted-foreground">Total</span>
                  <span className="text-2xl font-black text-emerald-500">
                    {formatMoney(preview?.total ?? 0)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-md flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-base">Payment Lines</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setUserEditedPayments(true);
                const fill = remainingPaise > 0 ? (remainingPaise / 100).toFixed(2).replace(/\.00$/, '') : '';
                setPaymentLines((prev) => [...prev, { id: `line-${Date.now()}`, mode: 'upi', amount: fill }]);
              }}
              disabled={isUnfinished}
              className="h-9 text-xs font-bold gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add payment</span>
            </Button>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              {paymentLines.map((line) => (
                <div key={line.id} className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 p-2.5">
                  <Select
                    value={line.mode}
                    onValueChange={(val) => {
                      setUserEditedPayments(true);
                      setPaymentLines((prev) =>
                        prev.map((l) => (l.id === line.id ? { ...l, mode: val as PaymentMode } : l))
                      );
                    }}
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
                    value={line.amount}
                    onChange={(e) => {
                      setUserEditedPayments(true);
                      setPaymentLines((prev) =>
                        prev.map((l) => (l.id === line.id ? { ...l, amount: e.target.value } : l))
                      );
                    }}
                    className="h-11 text-sm font-bold flex-1"
                  />
                  {paymentLines.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setUserEditedPayments(true);
                        setPaymentLines((prev) => prev.filter((l) => l.id !== line.id));
                      }}
                      className="h-11 w-10 text-destructive shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs">
                <span className="text-muted-foreground font-semibold">Remaining:</span>
                <span className={`font-black ${remainingPaise === 0 ? 'text-emerald-500' : 'text-amber-400'}`}>
                  {formatMoney(remainingRupees)}
                </span>
              </div>
            </div>

            <Button
              onClick={handleSettleOrder}
              disabled={isPayDisabled}
              className="w-full h-11 text-base font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
            >
              {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
              <span>Pay {formatMoney(preview?.total ?? 0)}</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      <CancelReasonDialog
        open={dialogState.open}
        onOpenChange={(open) => setDialogState((prev) => ({ ...prev, open }))}
        title={dialogState.title}
        description={dialogState.description}
        confirmLabel={dialogState.type === 'cancel_order' ? 'Cancel Order' : 'Remove Item'}
        onConfirm={async (reason) => {
          if (dialogState.type === 'cancel_order') {
            return await cancelOrder({ order_id: dialogState.id, reason });
          }
          return await voidOrderItem({ item_id: dialogState.id, reason });
        }}
        onSuccess={() => {
          if (dialogState.type === 'cancel_order') {
            router.push('/cashier');
          } else {
            loadOrder();
          }
        }}
      />
    </div>
  );
}
