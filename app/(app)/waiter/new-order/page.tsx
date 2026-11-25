'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MenuItem, MenuCategory, ModifierGroup, ModifierOption } from '@/types/database';
import { orderSchema, OrderInput } from '@/schemas/order';
import { createOrderAction } from '@/app/actions/orders';
import { formatMoney } from '@/lib/format';
import { ModifierDrawer } from '@/components/orders/ModifierDrawer';
import { ItemNoteEditor } from '@/components/orders/ItemNoteEditor';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  ArrowLeft,
  Plus,
  Minus,
  Send,
  ShoppingBag,
  Truck,
  Loader2,
  User,
} from 'lucide-react';

interface CartItem {
  key: string;
  menuItem: MenuItem;
  quantity: number;
  selectedOptions: ModifierOption[];
  note?: string;
}

export default function NewOffPremiseOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawType = searchParams.get('type');
  const orderType: 'takeaway' | 'delivery' = rawType === 'delivery' ? 'delivery' : 'takeaway';

  const supabase = createClient();

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [customerName, setCustomerName] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modDrawerItem, setModDrawerItem] = useState<MenuItem | null>(null);

  useEffect(() => {
    async function loadMenu() {
      setLoading(true);
      const [catRes, itemRes] = await Promise.all([
        supabase.from('menu_categories').select('*').order('sort_order', { ascending: true }),
        supabase
          .from('menu_items')
          .select('*, category:menu_categories(*), modifier_groups:menu_item_modifier_groups(sort_order, group:modifier_groups(*, options:modifier_options(*)))')
          .eq('is_available', true)
          .order('name', { ascending: true }),
      ]);
      if (catRes.data) setCategories(catRes.data as MenuCategory[]);
      if (itemRes.data) setMenuItems(itemRes.data as MenuItem[]);
      setLoading(false);
    }
    loadMenu();
  }, [supabase]);

  const getSortedGroups = (item: MenuItem): ModifierGroup[] => {
    const raw = item.modifier_groups || [];
    return [...raw]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => m.group)
      .filter((g): g is ModifierGroup => Boolean(g));
  };

  const handleMenuItemTap = (item: MenuItem) => {
    const groups = getSortedGroups(item);
    if (groups.length > 0) {
      setModDrawerItem(item);
    } else {
      addToCart(item, [], '');
    }
  };

  const addToCart = (item: MenuItem, selectedOptions: ModifierOption[] = [], note = '') => {
    const optIds = selectedOptions.map((o) => o.id).sort();
    const cartKey = `${item.id}__${optIds.join(',')}__${note.trim()}`;
    setCart((prev) => {
      const existing = prev[cartKey];
      return {
        ...prev,
        [cartKey]: {
          key: cartKey,
          menuItem: item,
          quantity: existing ? existing.quantity + 1 : 1,
          selectedOptions,
          note: note.trim() || undefined,
        },
      };
    });
  };

  const incrementCartKey = (cartKey: string) => {
    setCart((prev) => {
      const existing = prev[cartKey];
      if (!existing) return prev;
      return { ...prev, [cartKey]: { ...existing, quantity: existing.quantity + 1 } };
    });
  };

  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);

  const updateCartItemNote = (cartKey: string, nextNote: string) => {
    setCart((prev) => {
      const existing = prev[cartKey];
      if (!existing) return prev;
      return { ...prev, [cartKey]: { ...existing, note: nextNote || undefined } };
    });
  };

  const removeFromCart = (cartKey: string) => {
    setCart((prev) => {
      const existing = prev[cartKey];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const copy = { ...prev };
        delete copy[cartKey];
        return copy;
      }
      return { ...prev, [cartKey]: { ...existing, quantity: existing.quantity - 1 } };
    });
  };

  const getCartItemUnitPrice = (c: CartItem) =>
    Number(c.menuItem.price) +
    c.selectedOptions.reduce((sum, o) => sum + Number(o.price_delta), 0);

  const cartList = Object.values(cart);
  const cartCount = cartList.reduce((acc, c) => acc + c.quantity, 0);
  const cartTotal = cartList.reduce(
    (acc, c) => acc + getCartItemUnitPrice(c) * c.quantity,
    0
  );

  const handleSendOrder = async () => {
    if (cartList.length === 0) return;

    const rawPayload: OrderInput = {
      order_type: orderType,
      table_id: null,
      customer_name: customerName.trim() || null,
      note: orderNote.trim() || undefined,
      items: cartList.map((c) => ({
        menu_item_id: c.menuItem.id,
        quantity: c.quantity,
        unit_price: getCartItemUnitPrice(c),
        note: c.note || undefined,
        modifier_option_ids: c.selectedOptions.map((o) => o.id),
      })),
    };

    const parsed = orderSchema.safeParse(rawPayload);
    if (!parsed.success) {
      toast.error('Validation error', {
        description: parsed.error.errors[0]?.message,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createOrderAction(parsed.data);
      if (res?.error) {
        toast.error('Failed to dispatch order', { description: res.error });
      } else {
        toast.success(
          orderType === 'takeaway'
            ? 'Takeaway order sent to Kitchen!'
            : 'Delivery order sent to Kitchen!'
        );
        router.push('/waiter');
        router.refresh();
      }
    } catch {
      toast.error('Unexpected error while placing order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems =
    selectedCategory === 'all'
      ? menuItems
      : menuItems.filter((item) => item.category_id === selectedCategory);

  const CartPanel = (
    <div className="space-y-4">
      {cartList.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          No items selected yet. Tap items from the menu.
        </p>
      ) : (
        <div className="space-y-2.5 max-h-[34vh] overflow-y-auto divide-y divide-border">
          {cartList.map((entry) => {
            const unitPrice = getCartItemUnitPrice(entry);
            const isEditingNote = editingNoteKey === entry.key;
            return (
              <div key={entry.key} className="pt-2 text-xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{entry.menuItem.name}</p>
                    {entry.selectedOptions.length > 0 && (
                      <p className="text-[11px] text-primary/90 leading-snug">
                        {entry.selectedOptions.map((o) => o.name).join(', ')}
                      </p>
                    )}
                    {entry.note && (
                      <p className="text-[11px] font-semibold text-amber-400">
                        Note: {entry.note}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-muted-foreground text-[11px]">
                        {entry.quantity} × {formatMoney(unitPrice)}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingNoteKey(isEditingNote ? null : entry.key)
                        }
                        className="text-[11px] font-semibold text-amber-400 hover:underline min-h-[28px] px-1"
                      >
                        {isEditingNote
                          ? 'Done'
                          : entry.note
                          ? 'Edit note'
                          : '+ Note'}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-foreground">
                      {formatMoney(unitPrice * entry.quantity)}
                    </span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => removeFromCart(entry.key)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="default"
                      className="h-8 w-8"
                      onClick={() => incrementCartKey(entry.key)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {isEditingNote && (
                  <div className="rounded-lg border border-border bg-muted/20 p-2.5">
                    <ItemNoteEditor
                      value={entry.note || ''}
                      onChange={(nextNote) => updateCartItemNote(entry.key, nextNote)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
          <User className="h-3.5 w-3.5" />
          <span>Customer Name (Optional, max 60 chars)</span>
        </label>
        <Input
          placeholder="e.g. Rahul Mehta"
          maxLength={60}
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="h-11 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">
          Kitchen Note (Optional)
        </label>
        <Textarea
          placeholder="e.g. Pack cutlery separately..."
          value={orderNote}
          onChange={(e) => setOrderNote(e.target.value)}
          className="min-h-[60px] text-sm"
          maxLength={200}
        />
      </div>

      <Button
        onClick={handleSendOrder}
        disabled={isSubmitting || cartList.length === 0}
        className="w-full h-11 text-base font-bold shadow-lg gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Sending...</span>
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            <span>
              Send {orderType === 'takeaway' ? 'Takeaway' : 'Delivery'} ({formatMoney(cartTotal)})
            </span>
          </>
        )}
      </Button>
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-8">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push('/waiter')}
          className="h-11 w-11 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            {orderType === 'takeaway' ? (
              <ShoppingBag className="h-5 w-5 text-primary" />
            ) : (
              <Truck className="h-5 w-5 text-primary" />
            )}
            <span className="capitalize">New {orderType} Order</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Token number will be assigned automatically upon dispatch
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            <Button
              size="sm"
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('all')}
              className="h-10 rounded-full px-4 text-xs font-semibold shrink-0"
            >
              All Items
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                size="sm"
                variant={selectedCategory === cat.id ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(cat.id)}
                className="h-10 rounded-full px-4 text-xs font-semibold shrink-0"
              >
                {cat.name}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filteredItems.map((item) => {
              const qty = cartList
                .filter((c) => c.menuItem.id === item.id)
                .reduce((s, c) => s + c.quantity, 0);
              const hasMods = getSortedGroups(item).length > 0;

              return (
                <Card
                  key={item.id}
                  onClick={() => handleMenuItemTap(item)}
                  className={`flex items-center justify-between p-4 cursor-pointer transition active:scale-[0.98] ${
                    qty > 0 ? 'border-primary/80 bg-primary/5' : 'hover:border-primary/40'
                  }`}
                >
                  <div>
                    <h4 className="font-bold text-sm text-foreground">{item.name}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs font-semibold text-primary">
                        {formatMoney(Number(item.price))}
                      </p>
                      {hasMods && (
                        <span className="text-[10px] text-muted-foreground">Customizable</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {qty > 0 ? (
                      <Badge className="h-8 px-3 text-xs font-bold">{qty}×</Badge>
                    ) : (
                      <Button size="icon" variant="secondary" className="h-9 w-9 rounded-full">
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="hidden lg:block">
          <Card className="sticky top-6 border-border shadow-md">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <span>Order Cart ({cartCount})</span>
              </CardTitle>
              <CardDescription className="text-xs capitalize">
                {orderType} ticket
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">{CartPanel}</CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile Floating Cart Bar */}
      <div className="fixed bottom-4 inset-x-4 z-40 lg:hidden">
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger asChild>
            <Button className="w-full h-12 text-sm font-bold shadow-2xl justify-between px-5 rounded-2xl">
              <span className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                <span>View Cart ({cartCount} items)</span>
              </span>
              <span>{formatMoney(cartTotal)}</span>
            </Button>
          </DrawerTrigger>
          <DrawerContent className="p-4">
            <DrawerHeader>
              <DrawerTitle className="capitalize">{orderType} Order Cart</DrawerTitle>
              <DrawerDescription>Review items before sending to kitchen</DrawerDescription>
            </DrawerHeader>
            <div className="p-2">{CartPanel}</div>
          </DrawerContent>
        </Drawer>
      </div>

      <ModifierDrawer
        open={Boolean(modDrawerItem)}
        onOpenChange={(open) => !open && setModDrawerItem(null)}
        menuItem={modDrawerItem}
        groups={modDrawerItem ? getSortedGroups(modDrawerItem) : []}
        onConfirm={(selectedOptions, note) => {
          if (modDrawerItem) addToCart(modDrawerItem, selectedOptions, note);
        }}
      />
    </div>
  );
}
