'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CafeTable, Order } from '@/types/database';
import { formatMoney } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Receipt, CheckCircle, Clock, ArrowRight, ChefHat, Layers } from 'lucide-react';

interface TableBillingData {
  table: CafeTable;
  orders: Order[];
  grandTotal: number;
  hasActiveKitchenOrders: boolean; // new, preparing, or ready
}

export default function CashierPage() {
  const [tableData, setTableData] = useState<TableBillingData[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadOccupiedTables() {
      setLoading(true);

      // Fetch all tables with unbilled orders
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          *,
          table:cafe_tables(*),
          order_items(*, menu_item:menu_items(*))
        `)
        .in('status', ['new', 'preparing', 'ready', 'served'])
        .order('created_at', { ascending: true });

      if (!error && orders) {
        // Group orders by table_id
        const groups: Record<string, { table: CafeTable; orders: Order[] }> = {};

        orders.forEach((o) => {
          if (!o.table) return;
          if (!groups[o.table_id]) {
            groups[o.table_id] = { table: o.table as CafeTable, orders: [] };
          }
          groups[o.table_id].orders.push(o as Order);
        });

        const billingList: TableBillingData[] = Object.values(groups).map((group) => {
          const subtotal = group.orders.reduce((sum, order) => {
            const orderSum = (order.order_items || [])
              .filter((item) => !item.voided_at)
              .reduce(
                (s, item) => s + Number(item.unit_price) * item.quantity,
                0
              );
            return sum + orderSum;
          }, 0);

          const cgst = Math.round(subtotal * 0.025);
          const sgst = Math.round(subtotal * 0.025);
          const grandTotal = subtotal + cgst + sgst;

          const hasActiveKitchenOrders = group.orders.some(
            (o) => o.status === 'new' || o.status === 'preparing' || o.status === 'ready'
          );

          return {
            table: group.table,
            orders: group.orders,
            grandTotal,
            hasActiveKitchenOrders,
          };
        });

        // Sort by table label
        billingList.sort((a, b) => a.table.label.localeCompare(b.table.label));
        setTableData(billingList);
      }

      setLoading(false);
    }

    loadOccupiedTables();

    // Subscribe to realtime changes on orders, order_items, tables & payments
    const channel = supabase
      .channel('cashier-tables-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadOccupiedTables();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        loadOccupiedTables();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cafe_tables' }, () => {
        loadOccupiedTables();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        loadOccupiedTables();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
          Cashier & POS Checkout
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          Occupied dining tables with active customer rounds
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading occupied dining tables...</p>
      ) : tableData.length === 0 ? (
        <Card className="flex flex-col items-center justify-center border-dashed py-16 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-500" />
          <h3 className="mt-4 text-base font-semibold text-foreground">
            All tables are settled
          </h3>
          <p className="mt-1 text-xs md:text-sm text-muted-foreground">
            No occupied tables pending payment right now.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tableData.map(({ table, orders, grandTotal, hasActiveKitchenOrders }) => (
            <Card
              key={table.id}
              className={`flex flex-col justify-between p-5 shadow-lg transition hover:border-primary/60 ${
                hasActiveKitchenOrders ? 'bg-card' : 'border-primary/40 bg-primary/5'
              }`}
            >
              <div>
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl md:text-2xl font-black text-primary">
                      Table {table.label}
                    </span>
                    <Badge variant="secondary" className="text-xs font-bold gap-1">
                      <Layers className="h-3 w-3" />
                      <span>{orders.length} {orders.length === 1 ? 'Round' : 'Rounds'}</span>
                    </Badge>
                  </div>

                  {hasActiveKitchenOrders ? (
                    <Badge variant="warning" className="text-[11px] font-semibold gap-1">
                      <ChefHat className="h-3 w-3" />
                      <span>Waiting for kitchen</span>
                    </Badge>
                  ) : (
                    <Badge variant="success" className="text-[11px] font-bold">
                      Ready for Billing
                    </Badge>
                  )}
                </div>

                {/* Summary of rounds */}
                <div className="mt-3 space-y-2 text-xs">
                  {orders.map((ord, idx) => {
                    const activeItems = (ord.order_items || []).filter((i) => !i.voided_at);
                    const roundSum = activeItems.reduce(
                      (s, i) => s + Number(i.unit_price) * i.quantity,
                      0
                    );
                    return (
                      <div
                        key={ord.id}
                        className="flex items-center justify-between py-1 border-b border-border/40 last:border-none text-muted-foreground"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground">
                            Round {idx + 1}:
                          </span>
                          <span>
                            {activeItems.length} items
                          </span>
                          <span className="capitalize">({ord.status})</span>
                        </div>
                        <span className="font-semibold text-foreground">
                          {formatMoney(roundSum)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 border-t border-border pt-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                      Total Payable:
                    </span>
                    <span className="text-[10px] text-muted-foreground/80">
                      Incl. 5% GST (CGST + SGST)
                    </span>
                  </div>
                  <span className="text-2xl md:text-3xl font-black text-emerald-500">
                    {formatMoney(grandTotal)}
                  </span>
                </div>

                <Link href={`/cashier/table/${table.id}`} className="block">
                  <Button className="w-full h-11 text-base font-semibold justify-between shadow-lg">
                    <span className="flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      <span>Open Table Bill</span>
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
