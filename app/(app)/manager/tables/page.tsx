'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CafeTable } from '@/types/database';
import { Grid, Users } from 'lucide-react';

export default function ManagerTablesPage() {
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadTables() {
      setLoading(true);
      const { data } = await supabase.from('cafe_tables').select('*').order('label');
      if (data) setTables(data as CafeTable[]);
      setLoading(false);
    }
    loadTables();
  }, [supabase]);

  const toggleStatus = async (table: CafeTable) => {
    const nextStatus = table.status === 'free' ? 'occupied' : 'free';
    setTables((prev) => prev.map((t) => (t.id === table.id ? { ...t, status: nextStatus } : t)));
    await supabase.from('cafe_tables').update({ status: nextStatus }).eq('id', table.id);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-white">Table Layout & Seating</h1>
        <p className="text-xs text-slate-400">Overview of dining tables, capacity, and current floor occupancy</p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading tables...</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {tables.map((table) => (
            <div
              key={table.id}
              className={`rounded-xl border p-5 shadow-lg ${
                table.status === 'occupied'
                  ? 'border-amber-600/50 bg-amber-950/20'
                  : 'border-slate-800 bg-slate-900/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl font-black text-white">{table.label}</span>
                <button
                  onClick={() => toggleStatus(table)}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    table.status === 'occupied'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {table.status}
                </button>
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
                <Users className="h-4 w-4" />
                <span>{table.seats} Seats</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
