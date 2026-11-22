'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CafeTable } from '@/types/database';
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Floor Tables (Waiter POS)</h1>
        <p className="text-xs text-slate-400">Select a table to start a new dining session or add items to an existing order</p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading floor plan...</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {tables.map((table) => (
            <Link
              key={table.id}
              href={`/waiter/orders/${table.id}`}
              className={`flex flex-col justify-between rounded-xl border p-5 shadow-lg transition hover:scale-[1.02] ${
                table.status === 'occupied'
                  ? 'border-amber-600/50 bg-amber-950/20 hover:border-amber-500'
                  : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl font-black text-white">{table.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    table.status === 'occupied'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {table.status}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
                <Users className="h-4 w-4" />
                <span>{table.seats} Seats</span>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs font-semibold text-amber-400">
                <span className="flex items-center gap-1">
                  <Utensils className="h-3.5 w-3.5" />
                  Take Order
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
