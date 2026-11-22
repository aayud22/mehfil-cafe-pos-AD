'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClient } from '@/lib/supabase/client';
import { Order, PaymentMode } from '@/types/database';
import { paymentSchema, PaymentInput } from '@/schemas/payment';
import { processPaymentAction } from '@/app/actions/payments';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, Check, QrCode, Banknote, CreditCard, Loader2 } from 'lucide-react';

export default function CashierBillPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [order, setOrder] = useState<Order | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const form = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      order_id: resolvedParams.orderId,
      mode: 'upi',
      amount: 0,
    },
  });

  useEffect(() => {
    async function loadOrder() {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          table:cafe_tables(*),
          order_items(*, menu_item:menu_items(*))
        `)
        .eq('id', resolvedParams.orderId)
        .single();

      if (!error && data) {
        setOrder(data as Order);
        const computedTotal = (data.order_items || []).reduce(
          (sum: number, item: any) => sum + Number(item.unit_price) * item.quantity,
          0
        );
        form.setValue('amount', computedTotal);
        form.setValue('order_id', data.id);
      }
    }

    loadOrder();
  }, [resolvedParams.orderId, supabase, form]);

  if (!order) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        Loading dining invoice details...
      </div>
    );
  }

  const totalAmount = (order.order_items || []).reduce(
    (sum, item) => sum + Number(item.unit_price) * item.quantity,
    0
  );

  const onSubmit = async (values: PaymentInput) => {
    setIsProcessing(true);
    try {
      // Calls server action which independently recomputes order items from DB
      // and strictly rejects if client amount does not match!
      const res = await processPaymentAction(values);
      if (res?.error) {
        toast.error('Payment Settlement Rejected', { description: res.error });
        setIsProcessing(false);
        return;
      }

      toast.success(
        `Payment of ₹${totalAmount} recorded successfully via ${values.mode.toUpperCase()}!`
      );
      router.push('/cashier');
      router.refresh();
    } catch {
      toast.error('Unexpected error processing transaction.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="h-11 px-3 gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Register</span>
      </Button>

      {/* Invoice Card */}
      <Card className="shadow-2xl border-border/80">
        <CardHeader className="text-center pb-4 border-b border-dashed border-border">
          <Badge variant="outline" className="mx-auto mb-2 text-xs uppercase text-primary border-primary/30">
            Official Dining Receipt
          </Badge>
          <CardTitle className="text-2xl font-black tracking-wide text-foreground">
            MEHFIL CAFE
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Table: {order.table?.label || 'T-?'} • Order #{order.id.slice(0, 8)}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Card Item List */}
          <div className="divide-y divide-border text-sm">
            {order.order_items?.map((item) => (
              <div key={item.id} className="flex justify-between py-2 text-sm">
                <div>
                  <p className="font-semibold text-foreground">{item.menu_item?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} × ₹{item.unit_price}
                  </p>
                </div>
                <span className="font-bold text-foreground">
                  ₹{Number(item.unit_price) * item.quantity}
                </span>
              </div>
            ))}
          </div>

          {/* Grand Total */}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Grand Total:
            </span>
            <span className="text-2xl md:text-3xl font-black text-emerald-500">
              ₹{totalAmount.toLocaleString('en-IN')}
            </span>
          </div>

          {/* Payment Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
              <FormField
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Select Payment Mode
                    </FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid grid-cols-3 gap-2"
                      >
                        <FormItem>
                          <FormControl>
                            <div
                              onClick={() => field.onChange('upi')}
                              className={`flex flex-col items-center justify-center rounded-xl border p-3 cursor-pointer transition min-h-[70px] ${
                                field.value === 'upi'
                                  ? 'border-purple-500 bg-purple-500/10 text-purple-400 ring-2 ring-purple-500'
                                  : 'border-border bg-card hover:bg-muted/40 text-muted-foreground'
                              }`}
                            >
                              <QrCode className="h-6 w-6" />
                              <span className="mt-1 text-xs font-bold">UPI / QR</span>
                            </div>
                          </FormControl>
                        </FormItem>

                        <FormItem>
                          <FormControl>
                            <div
                              onClick={() => field.onChange('cash')}
                              className={`flex flex-col items-center justify-center rounded-xl border p-3 cursor-pointer transition min-h-[70px] ${
                                field.value === 'cash'
                                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 ring-2 ring-emerald-500'
                                  : 'border-border bg-card hover:bg-muted/40 text-muted-foreground'
                              }`}
                            >
                              <Banknote className="h-6 w-6" />
                              <span className="mt-1 text-xs font-bold">Cash</span>
                            </div>
                          </FormControl>
                        </FormItem>

                        <FormItem>
                          <FormControl>
                            <div
                              onClick={() => field.onChange('card')}
                              className={`flex flex-col items-center justify-center rounded-xl border p-3 cursor-pointer transition min-h-[70px] ${
                                field.value === 'card'
                                  ? 'border-blue-500 bg-blue-500/10 text-blue-400 ring-2 ring-blue-500'
                                  : 'border-border bg-card hover:bg-muted/40 text-muted-foreground'
                              }`}
                            >
                              <CreditCard className="h-6 w-6" />
                              <span className="mt-1 text-xs font-bold">Card</span>
                            </div>
                          </FormControl>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={isProcessing}
                className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl gap-2 mt-4"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Validating & Settling Bill...
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    Complete Settlement (₹{totalAmount})
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
