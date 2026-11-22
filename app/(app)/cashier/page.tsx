'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Order } from '@/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Receipt, CheckCircle, Clock, ArrowRight } from 'lucide-react';

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
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
          Cashier & POS Checkout
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          Generate tax invoices, collect payments (Cash, UPI, Card), and settle tabs
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading active dining sessions...</p>
      ) : orders.length === 0 ? (
        <Card className="flex flex-col items-center justify-center border-dashed py-16 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-500" />
          <h3 className="mt-4 text-base font-semibold text-foreground">
            All tables are settled
          </h3>
          <p className="mt-1 text-xs md:text-sm text-muted-foreground">
            No unpaid dining orders pending payment right now.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => {
            const total = calculateTotal(order);
            return (
              <Card
                key={order.id}
                className="flex flex-col justify-between p-5 shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <span className="text-xl font-bold text-primary">
                      Table {order.table?.label}
                    </span>
                    <Badge variant="outline" className="text-xs uppercase">
                      {order.status}
                    </Badge>
                  </div>

                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      Ordered at{' '}
                      {new Date(order.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Card List of Order Items on mobile */}
                  <div className="mt-4 divide-y divide-border text-sm">
                    {order.order_items?.map((item) => (
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
                </div>

                <div className="mt-6 border-t border-border pt-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-semibold">
                      Total Payable:
                    </span>
                    <span className="text-2xl font-black text-emerald-500">
                      ₹{total.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <Link href={`/cashier/bill/${order.id}`} className="block">
                    <Button className="w-full h-11 text-base font-semibold justify-between shadow-lg">
                      <span className="flex items-center gap-2">
                        <Receipt className="h-4 w-4" />
                        <span>Settle Bill & Print</span>
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
