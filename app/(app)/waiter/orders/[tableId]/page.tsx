'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MenuItem, MenuCategory, CafeTable, Order, UserRole, OrderStatus } from '@/types/database';
import { orderSchema, OrderInput } from '@/schemas/order';
import { createOrderAction, updateOrderStatusAction } from '@/app/actions/orders';
import { cancelOrder, voidOrderItem } from '@/app/actions/cancel';
import { formatMoney, formatTime } from '@/lib/format';
import { CancelReasonDialog } from '@/components/orders/CancelReasonDialog';
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
  X,
  Ban,
  CheckCircle2,
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
  const [userRole, setUserRole] = useState<UserRole>('waiter');
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [orderNote, setOrderNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isAddingMore, setIsAddingMore] = useState(false);
  const [loading, setLoading] = useState(true);

  // Cancellation dialog state
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    type: 'cancel_order' | 'void_item';
    id: string;
    title: string;
    description: string;
  }>({
    open: false,
    type: 'cancel_order',
    id: '',
    title: '',
    description: '',
  });

  const loadData = async () => {
    setLoading(true);

    // 0. User role
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile?.role) setUserRole(profile.role as UserRole);
    }

    // 1. Fetch table details
    const { data: tableData } = await supabase
      .from('cafe_tables')
      .select('*')
      .eq('id', resolvedParams.tableId)
      .single();
    if (tableData) setTable(tableData as CafeTable);

    // 2. Fetch existing active orders for this table (excluding cancelled)
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
      setIsAddingMore(false);
    } else {
      setExistingOrders([]);
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

    // Subscribe to realtime updates for orders and items
    const channel = supabase
      .channel(`waiter-table-${resolvedParams.tableId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `table_id=eq.${resolvedParams.tableId}` },
        () => loadData()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
  const cartTotal = cartList.reduce(
    (sum, item) => sum + Number(item.menuItem.price) * item.quantity,
    0
  );
  const cartCount = cartList.reduce((sum, item) => sum + item.quantity, 0);

  // Compute total of existing orders, strictly excluding voided items
  const runningTotal = existingOrders.reduce((acc, ord) => {
    const roundSum = (ord.order_items || [])
      .filter((i) => !i.voided_at)
      .reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0);
    return acc + roundSum;
  }, 0);

  // Check cancellation permission
  const canCancelOrder = (status: OrderStatus) => {
    if (userRole === 'owner' || userRole === 'manager') {
      return ['new', 'preparing', 'ready', 'served'].includes(status);
    }
    if (userRole === 'cashier' || userRole === 'waiter') {
      return status === 'new';
    }
    return false;
  };

  const filteredItems =
    selectedCategory === 'all'
      ? menuItems
      : menuItems.filter((i) => i.category_id === selectedCategory);

  const handleSubmitOrder = async () => {
    if (!table || cartList.length === 0) return;

    setIsSubmitting(true);
    try {
      const rawPayload = {
        table_id: table.id,
        note: orderNote.trim() || undefined,
        items: cartList.map((item) => ({
          menu_item_id: item.menuItem.id,
          quantity: item.quantity,
          unit_price: Number(item.menuItem.price),
        })),
      };

      const validation = orderSchema.safeParse(rawPayload);
      if (!validation.success) {
        toast.error('Validation error', {
          description: validation.error.errors[0]?.message || 'Please check order items',
        });
        setIsSubmitting(false);
        return;
      }

      const res = await createOrderAction(rawPayload as OrderInput);
      if (res?.error) {
        toast.error('Failed to dispatch order', { description: res.error });
      } else {
        toast.success(
          existingOrders.length > 0
            ? `Round ${existingOrders.length + 1} sent to Kitchen!`
            : 'Order dispatched to Kitchen!'
        );
        setCart({});
        setOrderNote('');
        setDrawerOpen(false);
        await loadData();
      }
    } catch {
      toast.error('Unexpected error while placing order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkServed = async (orderId: string) => {
    try {
      const res = await updateOrderStatusAction(orderId, 'served');
      if (res?.error) {
        toast.error('Failed to mark as served', { description: res.error });
      } else {
        toast.success('Order delivered & marked as served!');
        await loadData();
      }
    } catch {
      toast.error('Failed to update status.');
    }
  };

  const getOrderStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'new':
        return (
          <Badge variant="warning" className="text-xs">
            New
          </Badge>
        );
      case 'preparing':
        return (
          <Badge variant="info" className="text-xs">
            Preparing
          </Badge>
        );
      case 'ready':
        return (
          <Badge variant="success" className="text-xs">
            Ready
          </Badge>
        );
      case 'served':
        return (
          <Badge variant="secondary" className="text-xs">
            Served
          </Badge>
        );
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
                  {quantity} × {formatMoney(Number(menuItem.price))}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">
                  {formatMoney(Number(menuItem.price) * quantity)}
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
        <span className="text-xl font-black text-primary">{formatMoney(cartTotal)}</span>
      </div>

      <Button
        onClick={handleSubmitOrder}
        disabled={isSubmitting || cartList.length === 0}
        className="w-full h-11 text-base font-semibold shadow-lg gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Sending to Kitchen...</span>
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            <span>
              {existingOrders.length > 0
                ? `Send Round ${existingOrders.length + 1} (${formatMoney(cartTotal)})`
                : `Send Order (${formatMoney(cartTotal)})`}
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

  if (!table) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Table not found.</p>
        <Button onClick={() => router.push('/waiter')} className="mt-4 h-11">
          Back to Floor
        </Button>
      </div>
    );
  }

  const isOccupiedWithOrders = existingOrders.length > 0;

  return (
    <div className="space-y-6 pb-24 lg:pb-8">
      {/* Top Header */}
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/waiter')}
            className="h-11 w-11 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-foreground">
                Table {table.label}
              </h1>
              <Badge
                variant={isOccupiedWithOrders ? 'destructive' : 'outline'}
                className="text-xs font-bold"
              >
                {isOccupiedWithOrders ? 'Occupied' : 'Free Table'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {table.seats} Seats Dining Area
            </p>
          </div>
        </div>

        {/* View Switcher for Occupied Tables */}
        {isOccupiedWithOrders && (
          <div className="flex items-center gap-2">
            <Button
              variant={!isAddingMore ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsAddingMore(false)}
              className="h-11 gap-1 text-xs font-semibold"
            >
              <Layers className="h-4 w-4" />
              <span>Rounds History ({existingOrders.length})</span>
            </Button>
            <Button
              variant={isAddingMore ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsAddingMore(true)}
              className="h-11 gap-1 text-xs font-semibold"
            >
              <Plus className="h-4 w-4" />
              <span>Add More Items</span>
            </Button>
          </div>
        )}
      </div>

      {/* Main Content: Either Occupied Rounds View OR Ordering Menu Catalog */}
      {isOccupiedWithOrders && !isAddingMore ? (
        <div className="space-y-6">
          {/* Running Session Summary Banner */}
          <Card className="border-border bg-gradient-to-r from-card to-card/50 p-6 shadow-md">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Running Session Total
                </span>
                <div className="text-3xl font-black text-primary mt-1">
                  {formatMoney(runningTotal)}
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
                const activeItems = (order.order_items || []).filter((item) => !item.voided_at);
                const roundTotal = activeItems.reduce(
                  (sum, item) => sum + Number(item.unit_price) * item.quantity,
                  0
                );
                const isCancellable = canCancelOrder(order.status);

                return (
                  <Card key={order.id} className="p-4 shadow-sm border-border">
                    <div className="flex items-center justify-between border-b border-border pb-2.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-bold text-primary">
                          Round {index + 1}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(order.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {getOrderStatusBadge(order.status)}
                        {order.status === 'ready' && (
                          <Button
                            size="sm"
                            onClick={() => handleMarkServed(order.id)}
                            className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1 font-semibold shadow-sm ml-1"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Mark Served</span>
                          </Button>
                        )}
                        {isCancellable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDialogState({
                                open: true,
                                type: 'cancel_order',
                                id: order.id,
                                title: `Cancel Round ${index + 1}`,
                                description:
                                  'Are you sure you want to cancel this entire order round? This will be logged.',
                              })
                            }
                            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 gap-1 ml-1"
                          >
                            <Ban className="h-3 w-3" />
                            <span>Cancel</span>
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 divide-y divide-border/60 text-xs">
                      {activeItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between py-1.5 text-muted-foreground"
                        >
                          <div className="flex items-center gap-2">
                            {isCancellable && (
                              <button
                                type="button"
                                onClick={() =>
                                  setDialogState({
                                    open: true,
                                    type: 'void_item',
                                    id: item.id,
                                    title: `Remove ${item.menu_item?.name || 'Item'}`,
                                    description: `Are you sure you want to remove this item from Round ${index + 1}?`,
                                  })
                                }
                                className="h-6 w-6 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors"
                                title="Remove item"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <span className="text-foreground">
                              {item.quantity}x {item.menu_item?.name}
                            </span>
                          </div>
                          <span className="font-semibold text-foreground">
                            {formatMoney(Number(item.unit_price) * item.quantity)}
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
                      <span className="text-foreground">{formatMoney(roundTotal)}</span>
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
                (Running total so far: {formatMoney(runningTotal)})
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAddingMore(false)}
                className="h-8 text-xs font-semibold"
              >
                Back to Rounds
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Catalog Column */}
            <div className="space-y-4 lg:col-span-2">
              {/* Category Pills */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                <Button
                  variant={selectedCategory === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('all')}
                  className="rounded-full h-9 text-xs"
                >
                  All Items
                </Button>
                {categories.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={selectedCategory === cat.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(cat.id)}
                    className="rounded-full h-9 text-xs whitespace-nowrap"
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
                          {formatMoney(item.price)}
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
                  <span className="text-lg font-black">{formatMoney(cartTotal)}</span>
                </Button>
              </DrawerTrigger>
              <DrawerContent className="p-4 max-h-[85vh]">
                <DrawerHeader className="text-left pb-2">
                  <DrawerTitle>
                    {existingOrders.length > 0
                      ? `Round ${existingOrders.length + 1} (Table ${table?.label})`
                      : `Order Cart (Table ${table?.label})`}
                  </DrawerTitle>
                  <DrawerDescription className="text-xs">
                    Review and dispatch to kitchen
                  </DrawerDescription>
                </DrawerHeader>
                <div className="px-4 pb-4">
                  <CartContent />
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </div>
      )}

      {/* Cancellation and Item Removal Modal */}
      <CancelReasonDialog
        open={dialogState.open}
        onOpenChange={(open) => setDialogState((prev) => ({ ...prev, open }))}
        title={dialogState.title}
        description={dialogState.description}
        confirmLabel={dialogState.type === 'cancel_order' ? 'Cancel Order' : 'Remove Item'}
        onConfirm={async (reason) => {
          if (dialogState.type === 'cancel_order') {
            return await cancelOrder({ order_id: dialogState.id, reason });
          } else {
            return await voidOrderItem({ item_id: dialogState.id, reason });
          }
        }}
        onSuccess={loadData}
      />
    </div>
  );
}
