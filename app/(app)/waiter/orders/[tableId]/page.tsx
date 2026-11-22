'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MenuItem, MenuCategory, CafeTable, Order } from '@/types/database';
import { orderSchema, OrderInput } from '@/schemas/order';
import { createOrderAction } from '@/app/actions/orders';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
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
  Loader2,
  Clock,
  UtensilsCrossed,
  Layers,
} from 'lucide-react';

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
  const [existingOrders, setExistingOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [orderNote, setOrderNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isAddingMore, setIsAddingMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    // 1. Fetch table details
    const { data: tableData } = await supabase
      .from('cafe_tables')
      .select('*')
      .eq('id', resolvedParams.tableId)
      .single();
    if (tableData) setTable(tableData as CafeTable);

    // 2. Fetch existing active orders for this table
    const { data: activeOrders } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(*, menu_item:menu_items(*))
      `)
      .eq('table_id', resolvedParams.tableId)
      .in('status', ['new', 'preparing', 'ready', 'served'])
      .order('created_at', { ascending: true });

    if (activeOrders && activeOrders.length > 0) {
      setExistingOrders(activeOrders as Order[]);
      // If table has existing active orders, start by showing existing rounds
      setIsAddingMore(false);
    } else {
      setExistingOrders([]);
      // Free table goes straight to new order
      setIsAddingMore(true);
    }

    // 3. Fetch menu categories and items
    const { data: catData } = await supabase
      .from('menu_categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (catData) setCategories(catData as MenuCategory[]);

    const { data: itemsData } = await supabase
      .from('menu_items')
      .select('*')
      .eq('is_available', true);
    if (itemsData) setMenuItems(itemsData as MenuItem[]);

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [resolvedParams.tableId]);

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
  const cartCount = cartList.reduce((sum, c) => sum + c.quantity, 0);
  const cartTotal = cartList.reduce(
    (sum, c) => sum + Number(c.menuItem.price) * c.quantity,
    0
  );

  // Compute grand running total across all active existing rounds for this table
  const runningTotal = existingOrders.reduce((grand, o) => {
    const orderSum = (o.order_items || []).reduce(
      (sum, item) => sum + Number(item.unit_price) * item.quantity,
      0
    );
    return grand + orderSum;
  }, 0);

  const handleSubmitOrder = async () => {
    if (cartList.length === 0) {
      toast.error('Cart is empty. Add at least one item.');
      return;
    }

    const payload: OrderInput = {
      table_id: resolvedParams.tableId,
      note: orderNote || undefined,
      items: cartList.map((c) => ({
        menu_item_id: c.menuItem.id,
        quantity: c.quantity,
        unit_price: Number(c.menuItem.price),
        note: c.note || undefined,
      })),
    };

    const parsed = orderSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || 'Invalid order');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createOrderAction(payload);
      if (res?.error) {
        toast.error('Failed to dispatch order', { description: res.error });
        setIsSubmitting(false);
        return;
      }

      toast.success(
        existingOrders.length > 0
          ? `Round ${existingOrders.length + 1} sent to Kitchen!`
          : `Order sent to Kitchen for Table ${table?.label || ''}!`
      );
      setCart({});
      setOrderNote('');
      setDrawerOpen(false);
      // Reload table orders to show the new round
      await loadData();
    } catch {
      toast.error('Unexpected error while sending order.');
      setIsSubmitting(false);
    }
  };

  const filteredItems =
    selectedCategory === 'all'
      ? menuItems
      : menuItems.filter((i) => i.category_id === selectedCategory);

  const getOrderStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'new':
        return <Badge variant="warning">New</Badge>;
      case 'preparing':
        return <Badge variant="info">Preparing</Badge>;
      case 'ready':
        return <Badge variant="success">Ready</Badge>;
      case 'served':
        return <Badge variant="secondary">Served</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const CartContent = () => (
    <div className="space-y-4">
      {cartList.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          No items selected yet. Tap items from the menu.
        </p>
      ) : (
        <div className="space-y-2.5 max-h-[38vh] overflow-y-auto divide-y divide-border">
          {cartList.map(({ menuItem, quantity }) => (
            <div
              key={menuItem.id}
              className="flex items-center justify-between pt-2 text-xs"
            >
              <div>
                <p className="font-semibold text-foreground">{menuItem.name}</p>
                <p className="text-muted-foreground text-[11px]">
                  {quantity} × ₹{menuItem.price}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">
                  ₹{Number(menuItem.price) * quantity}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => removeFromCart(menuItem.id)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="default"
                  className="h-8 w-8"
                  onClick={() => addToCart(menuItem)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="text-xs font-semibold text-muted-foreground">
          Chef Notes / Special Instructions
        </label>
        <Textarea
          value={orderNote}
          onChange={(e) => setOrderNote(e.target.value)}
          placeholder="e.g. Extra hot, less sweet, pack ketchup..."
          rows={2}
          className="mt-1 text-base md:text-sm"
        />
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs font-medium text-muted-foreground">This Round Total:</span>
        <span className="text-xl font-black text-primary">₹{cartTotal}</span>
      </div>

      <Button
        onClick={handleSubmitOrder}
        disabled={isSubmitting || cartList.length === 0}
        className="w-full h-11 text-base font-semibold shadow-lg gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Dispatching Round...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Send to Kitchen Display (KDS)
          </>
        )}
      </Button>
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <Button
          variant="ghost"
          onClick={() => router.push('/waiter')}
          className="h-11 px-3 gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Floor Plan</span>
        </Button>
        <div className="text-right">
          <Badge variant="outline" className="text-sm font-bold text-primary">
            Table: {table?.label || '...'}
          </Badge>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {table?.status === 'occupied' ? 'Occupied Session' : 'New Table Session'}
          </p>
        </div>
      </div>

      {/* When Table is Occupied and has existing orders, Show Table Orders View */}
      {existingOrders.length > 0 && !isAddingMore ? (
        <div className="space-y-6">
          {/* Running Total & Action Card */}
          <Card className="bg-primary/10 border-primary/40 p-5">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Running Session Total
                </span>
                <div className="text-3xl font-black text-primary mt-1">
                  ₹{runningTotal.toLocaleString('en-IN')}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Across {existingOrders.length}{' '}
                  {existingOrders.length === 1 ? 'round' : 'rounds'} of ordering
                </p>
              </div>

              <Button
                onClick={() => setIsAddingMore(true)}
                className="h-11 px-6 text-base font-bold shadow-lg gap-2"
              >
                <Plus className="h-5 w-5" />
                <span>Add More Items (New Round)</span>
              </Button>
            </div>
          </Card>

          {/* List of Existing Rounds */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <span>Ordered Rounds ({existingOrders.length})</span>
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {existingOrders.map((order, index) => {
                const roundTotal = (order.order_items || []).reduce(
                  (sum, item) => sum + Number(item.unit_price) * item.quantity,
                  0
                );
                return (
                  <Card key={order.id} className="p-4 shadow-sm border-border">
                    <div className="flex items-center justify-between border-b border-border pb-2.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-bold text-primary">
                          Round {index + 1}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(order.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {getOrderStatusBadge(order.status)}
                    </div>

                    <div className="mt-3 divide-y divide-border/60 text-xs">
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

                    {order.note && (
                      <div className="mt-2 text-[11px] text-muted-foreground bg-muted/40 p-2 rounded">
                        <span className="font-semibold">Note:</span> {order.note}
                      </div>
                    )}

                    <div className="mt-3 border-t border-border pt-2 flex justify-between text-xs font-bold">
                      <span className="text-muted-foreground">Round Total:</span>
                      <span className="text-foreground">₹{roundTotal}</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Ordering Catalog View (Free table OR Waiter adding more items) */
        <div className="space-y-6">
          {existingOrders.length > 0 && (
            <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border">
              <span className="text-xs text-muted-foreground">
                Adding items as{' '}
                <strong className="text-primary font-bold">
                  Round {existingOrders.length + 1}
                </strong>{' '}
                (Running total so far: ₹{runningTotal})
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-9 text-xs"
                onClick={() => setIsAddingMore(false)}
              >
                View Existing Rounds
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Catalog (2 cols on desktop) */}
            <div className="space-y-4 lg:col-span-2">
              {/* Category Pills */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                <Button
                  size="sm"
                  variant={selectedCategory === 'all' ? 'default' : 'outline'}
                  className="h-11 text-xs shrink-0"
                  onClick={() => setSelectedCategory('all')}
                >
                  All Items
                </Button>
                {categories.map((cat) => (
                  <Button
                    key={cat.id}
                    size="sm"
                    variant={selectedCategory === cat.id ? 'default' : 'outline'}
                    className="h-11 text-xs shrink-0"
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>

              {/* Items Grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {filteredItems.map((item) => {
                  const qty = cart[item.id]?.quantity || 0;
                  return (
                    <Card
                      key={item.id}
                      className="p-4 shadow-sm flex items-center justify-between"
                    >
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">
                          {item.name}
                        </h4>
                        <p className="text-xs font-bold text-primary mt-0.5">
                          ₹{item.price}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {qty > 0 && (
                          <>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-11 w-11"
                              onClick={() => removeFromCart(item.id)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-5 text-center text-sm font-bold">
                              {qty}
                            </span>
                          </>
                        )}
                        <Button
                          size="icon"
                          variant="default"
                          className="h-11 w-11 shadow"
                          onClick={() => addToCart(item)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Desktop Cart Column */}
            <div className="hidden lg:block">
              <Card className="sticky top-20 shadow-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-primary" />
                    <span>
                      {existingOrders.length > 0
                        ? `Round ${existingOrders.length + 1} Cart`
                        : 'Order Cart'}{' '}
                      ({cartCount})
                    </span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Dispatch items straight to KDS
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CartContent />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Mobile Bottom Sticky Cart Bar */}
          <div className="fixed bottom-16 left-0 right-0 p-3 bg-background/95 border-t border-border backdrop-blur lg:hidden z-30">
            <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
              <DrawerTrigger asChild>
                <Button className="w-full h-11 text-base font-semibold shadow-xl flex items-center justify-between px-4">
                  <span className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5" />
                    <span>
                      {existingOrders.length > 0
                        ? `Round ${existingOrders.length + 1} (${cartCount})`
                        : `Cart (${cartCount})`}
                    </span>
                  </span>
                  <span className="text-lg font-black">₹{cartTotal}</span>
                </Button>
              </DrawerTrigger>
              <DrawerContent className="p-4 max-h-[85vh]">
                <DrawerHeader className="text-left pb-2">
                  <DrawerTitle>
                    {existingOrders.length > 0
                      ? `Round ${existingOrders.length + 1} (Table ${table?.label})`
                      : `Order Cart (Table ${table?.label})`}
                  </DrawerTitle>
                  <DrawerDescription>Review order lines before dispatching.</DrawerDescription>
                </DrawerHeader>
                <div className="px-2 py-2">
                  <CartContent />
                </div>
                <DrawerFooter className="pt-2">
                  <DrawerClose asChild>
                    <Button variant="outline" className="h-11">
                      Close Cart
                    </Button>
                  </DrawerClose>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          </div>
        </div>
      )}
    </div>
  );
}
