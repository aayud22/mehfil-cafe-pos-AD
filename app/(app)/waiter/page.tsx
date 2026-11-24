'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CafeTable } from '@/types/database';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Utensils, ArrowRight, Bell, CheckCircle2 } from 'lucide-react';

export default function WaiterFloorPage() {
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [readyTableIds, setReadyTableIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadData = useCallback(async () => {
    // 1. Fetch tables
    const { data: tableData } = await supabase
      .from('cafe_tables')
      .select('*')
      .order('label', { ascending: true });

    if (tableData) {
      setTables(tableData as CafeTable[]);
    }

    // 2. Fetch tables that have orders in 'ready' status
    const { data: readyOrders } = await supabase
      .from('orders')
      .select('table_id')
      .eq('status', 'ready');

    if (readyOrders) {
      const ids = new Set<string>(readyOrders.map((o) => o.table_id));
      setReadyTableIds(ids);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();

    // Subscribe to realtime changes on cafe_tables and orders
    const channel = supabase
      .channel('waiter-floor-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cafe_tables' },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadData]);

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
          <span>Floor Tables (Waiter POS)</span>
          {readyTableIds.size > 0 && (
            <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs px-2.5 py-0.5 animate-pulse gap-1">
              <Bell className="h-3 w-3" />
              <span>{readyTableIds.size} Ready for Pickup</span>
            </Badge>
          )}
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
          Tap a table to take a mobile customer order, or deliver prepared food
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading tables layout...</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {tables.map((table) => {
            const isReady = readyTableIds.has(table.id);
            return (
              <Link key={table.id} href={`/waiter/orders/${table.id}`} className="block">
                <Card
                  className={`flex flex-col justify-between p-4 min-h-[150px] transition active:scale-[0.98] ${
                    isReady
                      ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/10'
                      : table.status === 'occupied'
                      ? 'border-primary/60 bg-primary/10 hover:border-primary'
                      : 'bg-card hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl md:text-2xl font-black text-foreground">
                      {table.label}
                    </span>
                    {isReady ? (
                      <Badge className="bg-emerald-500 text-white text-[10px] uppercase font-bold animate-pulse gap-1 px-1.5 py-0.5">
                        <Bell className="h-3 w-3" />
                        Ready!
                      </Badge>
                    ) : (
                      <Badge
                        variant={table.status === 'occupied' ? 'warning' : 'success'}
                        className="text-[10px] uppercase font-bold"
                      >
                        {table.status}
                      </Badge>
                    )}
                  </div>

                  <div className="my-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{table.seats} Seats</span>
                  </div>

                  <Button
                    variant={isReady ? 'default' : 'default'}
                    className={`w-full h-11 text-xs font-semibold justify-between mt-auto ${
                      isReady ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : ''
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {isReady ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Deliver Order
                        </>
                      ) : (
                        <>
                          <Utensils className="h-4 w-4" />
                          Take Order
                        </>
                      )}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
