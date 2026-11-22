'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MenuItem, MenuCategory } from '@/types/database';
import { Plus, Coffee } from 'lucide-react';

export default function ManagerMenuPage() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadMenu() {
      setLoading(true);
      const { data: catData } = await supabase.from('menu_categories').select('*').order('sort_order');
      if (catData) setCategories(catData as MenuCategory[]);

      const { data: itemsData } = await supabase.from('menu_items').select('*, category:menu_categories(*)').order('name');
      if (itemsData) setItems(itemsData as MenuItem[]);
      setLoading(false);
    }
    loadMenu();
  }, [supabase]);

  const toggleAvailability = async (item: MenuItem) => {
    const nextState = !item.is_available;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_available: nextState } : i)));
    await supabase.from('menu_items').update({ is_available: nextState }).eq('id', item.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Menu Catalog</h1>
          <p className="text-xs text-slate-400">Manage categories, item pricing, and kitchen availability</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading catalog...</p>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => {
            const catItems = items.filter((i) => i.category_id === cat.id);
            return (
              <div key={cat.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                <h3 className="mb-4 text-base font-bold text-amber-400">{cat.name}</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {catItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{item.name}</p>
                        <p className="text-xs text-amber-400 font-medium">₹{item.price}</p>
                      </div>
                      <button
                        onClick={() => toggleAvailability(item)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                          item.is_available
                            ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                            : 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
                        }`}
                      >
                        {item.is_available ? 'Available' : 'Sold Out'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
