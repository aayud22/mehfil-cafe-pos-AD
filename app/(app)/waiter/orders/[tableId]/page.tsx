'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MenuItem, MenuCategory, CafeTable } from '@/types/database';
import { ArrowLeft, Plus, Minus, Send, ShoppingBag } from 'lucide-react';

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  note?: string;
}

export default function WaiterOrderPage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [table, setTable] = useState<CafeTable | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [orderNote, setOrderNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      // 1. Table info
      const { data: tableData } = await supabase
        .from('cafe_tables')
        .select('*')
        .eq('id', resolvedParams.tableId)
        .single();
      if (tableData) setTable(tableData as CafeTable);

      // 2. Categories
      const { data: catData } = await supabase
        .from('menu_categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (catData) setCategories(catData as MenuCategory[]);

      // 3. Menu items
      const { data: itemsData } = await supabase
        .from('menu_items')
        .select('*')
        .eq('is_available', true);
      if (itemsData) setMenuItems(itemsData as MenuItem[]);
    }

    loadData();
  }, [resolvedParams.tableId, supabase]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev[item.id];
      if (existing) {
        return {
          ...prev,
          [item.id]: { ...existing, quantity: existing.quantity + 1 },
        };
      }
      return {
        ...prev,
        [item.id]: { menuItem: item, quantity: 1 },
      };
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return {
        ...prev,
        [itemId]: { ...existing, quantity: existing.quantity - 1 },
      };
    });
  };

  const cartList = Object.values(cart);
  const cartTotal = cartList.reduce(
    (sum, c) => sum + Number(c.menuItem.price) * c.quantity,
    0
  );

  const handleSubmitOrder = async () => {
    if (cartList.length === 0) return;
    setIsSubmitting(true);

    try {
      // Get current logged-in user profile
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Create order row
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .insert({
          table_id: resolvedParams.tableId,
          waiter_id: user?.id || null,
          status: 'new',
          note: orderNote || null,
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      // 2. Insert order items
      const itemsPayload = cartList.map((c) => ({
        order_id: orderData.id,
        menu_item_id: c.menuItem.id,
        quantity: c.quantity,
        unit_price: c.menuItem.price,
        note: c.note || null,
      }));

      const { error: itemsErr } = await supabase.from('order_items').insert(itemsPayload);
      if (itemsErr) throw itemsErr;

      // 3. Mark table occupied
      await supabase
        .from('cafe_tables')
        .update({ status: 'occupied' })
        .eq('id', resolvedParams.tableId);

      router.push('/waiter');
    } catch (err) {
      console.error(err);
      alert('Failed to send order to kitchen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = selectedCategory === 'all'
    ? menuItems
    : menuItems.filter((i) => i.category_id === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Floor</span>
        </button>
        <div className="text-right">
          <span className="text-sm font-semibold text-amber-400">
            Table: {table?.label || '...'}
          </span>
          <span className="block text-xs text-slate-400">Mobile Ordering</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Menu Items (2 cols) */}
        <div className="space-y-4 lg:col-span-2">
          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === 'all'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All Items
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat.id
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Items Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filteredItems.map((item) => {
              const qty = cart[item.id]?.quantity || 0;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm"
                >
                  <div>
                    <h4 className="text-sm font-semibold text-white">{item.name}</h4>
                    <p className="text-xs font-bold text-amber-400">₹{item.price}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {qty > 0 && (
                      <>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-bold text-white">{qty}</span>
                      </>
                    )}
                    <button
                      onClick={() => addToCart(item)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-600 text-white hover:bg-amber-500"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Cart (1 col) */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <ShoppingBag className="h-5 w-5 text-amber-400" />
              <h3 className="font-bold text-white">Current Order Cart</h3>
            </div>

            {cartList.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">Cart is empty. Tap items to add.</p>
            ) : (
              <div className="mt-4 space-y-3 divide-y divide-slate-800">
                {cartList.map(({ menuItem, quantity }) => (
                  <div key={menuItem.id} className="flex items-center justify-between pt-2 text-xs">
                    <div>
                      <span className="font-medium text-slate-200">{menuItem.name}</span>
                      <span className="block text-[11px] text-slate-400">
                        {quantity} × ₹{menuItem.price}
                      </span>
                    </div>
                    <span className="font-bold text-white">₹{Number(menuItem.price) * quantity}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-400">Chef Note / Special Instructions</label>
              <textarea
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                placeholder="e.g. Extra hot, less spicy..."
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-800 p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="mt-6 border-t border-slate-800 pt-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs text-slate-400">Subtotal:</span>
              <span className="text-xl font-black text-amber-400">₹{cartTotal}</span>
            </div>

            <button
              onClick={handleSubmitOrder}
              disabled={isSubmitting || cartList.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 font-semibold text-white shadow-lg transition hover:bg-amber-500 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span>{isSubmitting ? 'Dispatching...' : 'Dispatch to Kitchen (KDS)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
