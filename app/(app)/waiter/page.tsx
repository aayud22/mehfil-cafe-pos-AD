'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CafeTable, Order, OrderType } from '@/types/database';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { formatMoney, formatTime } from '@/lib/format';
import { getOrderDisplayLabel } from '@/lib/order-label';
import { updateOrderStatusAction } from '@/app/actions/orders';
import { cancelOrder } from '@/app/actions/cancel';
import { CancelReasonDialog } from '@/components/orders/CancelReasonDialog';
import { toast } from 'sonner';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  Utensils,
  ArrowRight,
  Bell,
  CheckCircle2,
  ShoppingBag,
  Truck,
  Plus,
  Clock,
  Ban,
  User,
} from 'lucide-react';

export default function WaiterFloorPage() {
  const [activeTab, setActiveTab] = useState<OrderType>('dine_in');
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [readyTableIds, setReadyTableIds] = useState<Set<string>>(new Set());
  const [offPremiseOrders, setOffPremiseOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<{ open: boolean; id: string; title: string }>({
    open: false,
    id: '',
    title: '',
  });

  const supabase = createClient();
  const { t } = useLanguage();

  const loadData = useCallback(async () => {
    const [tableRes, readyRes, offPremiseRes] = await Promise.all([
      supabase.from('cafe_tables').select('*').order('label', { ascending: true }),
      supabase.from('orders').select('table_id').eq('status', 'ready').not('table_id', 'is', null),
      supabase
        .from('orders')
        .select('*, order_items(*, menu_item:menu_items(*))')
        .in('order_type', ['takeaway', 'delivery'])
        .in('status', ['new', 'preparing', 'ready', 'served'])
        .order('created_at', { ascending: false }),
    ]);

    if (tableRes.data) setTables(tableRes.data as CafeTable[]);
    if (readyRes.data) {
      setReadyTableIds(new Set<string>(readyRes.data.map((o) => o.table_id).filter(Boolean)));
    }
    if (offPremiseRes.data) setOffPremiseOrders(offPremiseRes.data as Order[]);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('waiter-floor-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cafe_tables' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadData]);

  const handleMarkServed = async (orderId: string) => {
    const res = await updateOrderStatusAction(orderId, 'served');
    if (res?.error) {
      toast.error('Failed to update status', { description: res.error });
    } else {
      toast.success('Marked as served!');
      loadData();
    }
  };

  const takeawayOrders = offPremiseOrders.filter((o) => o.order_type === 'takeaway');
  const deliveryOrders = offPremiseOrders.filter((o) => o.order_type === 'delivery');
  const displayedOffPremise = activeTab === 'takeaway' ? takeawayOrders : deliveryOrders;

  return (
    <div className="space-y-6">
      {/* Header + Tabs */}
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5 flex-wrap">
            <span>{t('waiter_floor_title')}</span>
            {readyTableIds.size > 0 && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs px-2.5 py-0.5 animate-pulse gap-1">
                <Bell className="h-3 w-3" />
                <span>{readyTableIds.size} {t('ready_pickup')}</span>
              </Badge>
            )}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            {t('waiter_floor_subtitle')}
          </p>
        </div>

        {/* Order Type Tabs */}
        <div className="flex items-center gap-1 bg-card p-1 rounded-xl border border-border self-start sm:self-auto">
          <Button
            size="sm"
            variant={activeTab === 'dine_in' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('dine_in')}
            className="h-10 px-3 text-xs font-bold gap-1.5"
          >
            <Utensils className="h-3.5 w-3.5" />
            <span>Dine-in</span>
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'takeaway' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('takeaway')}
            className="h-10 px-3 text-xs font-bold gap-1.5"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>Takeaway ({takeawayOrders.length})</span>
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'delivery' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('delivery')}
            className="h-10 px-3 text-xs font-bold gap-1.5"
          >
            <Truck className="h-3.5 w-3.5" />
            <span>Delivery ({deliveryOrders.length})</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('loading_tables')}</p>
      ) : activeTab === 'dine_in' ? (
        /* Dine-in Tables Grid */
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
                        {t('ready_badge')}
                      </Badge>
                    ) : (
                      <Badge
                        variant={table.status === 'occupied' ? 'warning' : 'success'}
                        className="text-[10px] uppercase font-bold"
                      >
                        {table.status === 'occupied' ? t('occupied') : t('free')}
                      </Badge>
                    )}
                  </div>

                  <div className="my-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{table.seats} {t('seats')}</span>
                  </div>

                  <Button
                    variant="default"
                    className={`w-full h-11 text-xs font-semibold justify-between mt-auto ${
                      isReady ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : ''
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {isReady ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          {t('deliver_order')}
                        </>
                      ) : (
                        <>
                          <Utensils className="h-4 w-4" />
                          {t('take_order')}
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
      ) : (
        /* Takeaway / Delivery Open Orders + New Order Button */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground capitalize">
              Open {activeTab} Orders ({displayedOffPremise.length})
            </h2>
            <Button asChild className="h-11 font-bold gap-2">
              <Link href={`/waiter/new-order?type=${activeTab}`}>
                <Plus className="h-4 w-4" />
                <span>New {activeTab === 'takeaway' ? 'Takeaway' : 'Delivery'} Order</span>
              </Link>
            </Button>
          </div>

          {displayedOffPremise.length === 0 ? (
            <Card className="flex flex-col items-center justify-center border-dashed py-16 text-center">
              {activeTab === 'takeaway' ? (
                <ShoppingBag className="h-10 w-10 text-muted-foreground/60" />
              ) : (
                <Truck className="h-10 w-10 text-muted-foreground/60" />
              )}
              <h3 className="mt-3 text-base font-semibold text-foreground">
                No open {activeTab} orders
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Tap &quot;New {activeTab === 'takeaway' ? 'Takeaway' : 'Delivery'} Order&quot; above to create one with a token number.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {displayedOffPremise.map((order) => {
                const activeItems = (order.order_items || []).filter((i) => !i.voided_at);
                const orderTotal = activeItems.reduce(
                  (s, i) => s + Number(i.unit_price) * i.quantity,
                  0
                );
                const label = getOrderDisplayLabel(order);

                return (
                  <Card
                    key={order.id}
                    className={`p-4 space-y-3 border-border ${
                      order.status === 'ready'
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'bg-card/60'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                      <div>
                        <span className="text-lg font-black text-foreground">{label}</span>
                        {order.customer_name && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <User className="h-3 w-3" />
                            <span>{order.customer_name}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            order.status === 'ready'
                              ? 'success'
                              : order.status === 'served'
                              ? 'secondary'
                              : 'warning'
                          }
                          className="text-[10px] uppercase font-bold"
                        >
                          {order.status}
                        </Badge>
                        {order.status === 'new' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setCancelTarget({ open: true, id: order.id, title: `Cancel ${label}` })
                            }
                            className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 gap-1"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            <span>Cancel</span>
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      {activeItems.map((item) => (
                        <div key={item.id} className="flex justify-between">
                          <span>
                            {item.quantity} × {item.menu_item?.name || 'Item'}
                          </span>
                          <span className="font-semibold text-foreground">
                            {formatMoney(Number(item.unit_price) * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between border-t border-border/50 pt-2.5 text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(order.created_at)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-primary">
                          {formatMoney(orderTotal)}
                        </span>
                        {order.status === 'ready' && (
                          <Button
                            size="sm"
                            onClick={() => handleMarkServed(order.id)}
                            className="h-9 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Mark Served</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      <CancelReasonDialog
        open={cancelTarget.open}
        onOpenChange={(open) => setCancelTarget((prev) => ({ ...prev, open }))}
        title={cancelTarget.title}
        description="Cancel this order? This action will be logged."
        confirmLabel="Cancel Order"
        onConfirm={async (reason) => {
          return await cancelOrder({ order_id: cancelTarget.id, reason });
        }}
        onSuccess={loadData}
      />
    </div>
  );
}
