'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Order, PaymentMode } from '@/types/database';
import { ArrowLeft, Check, QrCode, Banknote, CreditCard } from 'lucide-react';

export default function CashierBillPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [order, setOrder] = useState<Order | null>(null);
  const [selectedMode, setSelectedMode] = useState<PaymentMode>('upi');
  const [isProcessing, setIsProcessing] = useState(false);

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
      }
    }

    loadOrder();
  }, [resolvedParams.orderId, supabase]);

  if (!order) {
    return <div className="p-8 text-center text-slate-400">Loading bill details...</div>;
  }

  const totalAmount = (order.order_items || []).reduce(
    (sum, item) => sum + Number(item.unit_price) * item.quantity,
    0
  );

  const handleSettlePayment = async () => {
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Create payment record
      const { error: payErr } = await supabase.from('payments').insert({
        order_id: order.id,
        mode: selectedMode,
        amount: totalAmount,
        received_by: user?.id || null,
      });

      if (payErr) throw payErr;

      // 2. Mark order as billed
      await supabase
        .from('orders')
        .update({ status: 'billed' })
        .eq('id', order.id);

      // 3. Free the table
      if (order.table_id) {
        await supabase
          .from('cafe_tables')
          .update({ status: 'free' })
          .eq('id', order.table_id);
      }

      router.push('/cashier');
    } catch (err) {
      console.error(err);
      alert('Error processing payment.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Cashier Register</span>
      </button>

      {/* Bill Receipt Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur">
        <div className="border-b border-dashed border-slate-700 pb-4 text-center">
          <h2 className="text-xl font-black tracking-wide text-white">MEHFIL CAFE</h2>
          <p className="text-xs text-slate-400">Tax Invoice / Dining Bill</p>
          <p className="mt-1 text-xs font-semibold text-amber-400">Table: {order.table?.label}</p>
        </div>

        {/* Items Table */}
        <div className="my-6 divide-y divide-slate-800/80 text-sm">
          {order.order_items?.map((item) => (
            <div key={item.id} className="flex justify-between py-2 text-slate-300">
              <div>
                <span>{item.menu_item?.name}</span>
                <span className="block text-xs text-slate-500">
                  {item.quantity} x ₹{item.unit_price}
                </span>
              </div>
              <span className="font-semibold text-white">
                ₹{Number(item.unit_price) * item.quantity}
              </span>
            </div>
          ))}
        </div>

        {/* Grand Total */}
        <div className="border-t border-slate-700 pt-4">
          <div className="flex items-center justify-between text-lg font-black text-white">
            <span>Net Payable Amount:</span>
            <span className="text-2xl text-emerald-400">₹{totalAmount.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Payment Mode Selector */}
        <div className="mt-6 border-t border-slate-800 pt-6">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Select Payment Tender
          </label>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setSelectedMode('upi')}
              className={`flex flex-col items-center justify-center rounded-xl border p-3 transition ${
                selectedMode === 'upi'
                  ? 'border-purple-500 bg-purple-950/40 text-purple-300 ring-1 ring-purple-500'
                  : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <QrCode className="h-6 w-6" />
              <span className="mt-2 text-xs font-bold">UPI / QR</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMode('cash')}
              className={`flex flex-col items-center justify-center rounded-xl border p-3 transition ${
                selectedMode === 'cash'
                  ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 ring-1 ring-emerald-500'
                  : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Banknote className="h-6 w-6" />
              <span className="mt-2 text-xs font-bold">Cash</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMode('card')}
              className={`flex flex-col items-center justify-center rounded-xl border p-3 transition ${
                selectedMode === 'card'
                  ? 'border-blue-500 bg-blue-950/40 text-blue-300 ring-1 ring-blue-500'
                  : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <CreditCard className="h-6 w-6" />
              <span className="mt-2 text-xs font-bold">Card</span>
            </button>
          </div>

          <button
            onClick={handleSettlePayment}
            disabled={isProcessing}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white shadow-lg transition hover:bg-emerald-500 disabled:opacity-50"
          >
            <Check className="h-5 w-5" />
            <span>{isProcessing ? 'Settling Payment...' : `Complete Bill (₹${totalAmount})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
