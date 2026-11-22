'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Order } from '@/types/database';
import { Receipt, CheckCircle, Clock } from 'lucide-react';

export default function CashierPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadBillableOrders() {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          table:cafe_tables(*),
          order_items(*, menu_item:menu_items(*))
        `)
        .in('status', ['served', 'ready', 'preparing'])
        .order('created_at', { ascending: false });

      if (!error && data) {
        setOrders(data as Order[]);
      }
      setLoading(false);
    }

    loadBillableOrders();
  }, [supabase]);

  const calculateTotal = (order: Order) => {
    return (order.order_items || []).reduce(
      (sum, item) => sum + Number(item.unit_price) * item.quantity,
      0
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Cashier & POS Checkout</h1>
          <p className="text-xs text-slate-400">Generate bills, apply payment tender, and close dining tabs</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading active dining sessions...</p>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 py-16 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-500/60" />
          <h3 className="mt-4 text-base font-semibold text-slate-300">All tables are settled</h3>
          <p className="mt-1 text-sm text-slate-500">No pending unpaid orders at this moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => {
            const total = calculateTotal(order);
            return (
              <div
                key={order.id}
                className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-lg font-bold text-amber-400">Table {order.table?.label}</span>
                    <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider text-slate-300">
                      {order.status}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Ordered at {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <div className="mt-4 divide-y divide-slate-800 text-sm">
                    {order.order_items?.map((item) => (
                      <div key={item.id} className="flex justify-between py-1.5 text-slate-300">
                        <span>{item.quantity}x {item.menu_item?.name}</span>
                        <span className="font-medium text-white">₹{Number(item.unit_price) * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-800 pt-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-400">Total Payable:</span>
                    <span className="text-2xl font-black text-emerald-400">₹{total.toLocaleString('en-IN')}</span>
                  </div>

                  <Link
                    href={`/cashier/bill/${order.id}`}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 font-medium text-white shadow-lg transition hover:bg-amber-500"
                  >
                    <Receipt className="h-4 w-4" />
                    <span>Collect Payment & Bill</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
