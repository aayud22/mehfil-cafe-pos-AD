'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CafeTable } from '@/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Utensils, ArrowRight } from 'lucide-react';

export default function WaiterFloorPage() {
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadTables() {
      setLoading(true);
      const { data, error } = await supabase
        .from('cafe_tables')
        .select('*')
        .order('label', { ascending: true });

      if (!error && data) {
        setTables(data as CafeTable[]);
      }
      setLoading(false);
    }

    loadTables();
  }, [supabase]);

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
          Floor Tables (Waiter POS)
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          Tap a table to take a mobile customer order and dispatch to KDS
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading tables layout...</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {tables.map((table) => (
            <Link key={table.id} href={`/waiter/orders/${table.id}`} className="block">
              <Card
                className={`flex flex-col justify-between p-4 min-h-[140px] transition active:scale-[0.98] hover:border-primary/60 ${
                  table.status === 'occupied'
                    ? 'border-primary/60 bg-primary/10'
                    : 'bg-card'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl md:text-2xl font-black text-foreground">
                    {table.label}
                  </span>
                  <Badge
                    variant={table.status === 'occupied' ? 'warning' : 'success'}
                    className="text-[10px] uppercase font-bold"
                  >
                    {table.status}
                  </Badge>
                </div>

                <div className="my-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{table.seats} Seats</span>
                </div>

                <Button
                  variant="default"
                  className="w-full h-11 text-xs font-semibold justify-between mt-auto"
                >
                  <span className="flex items-center gap-1.5">
                    <Utensils className="h-4 w-4" />
                    Take Order
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
