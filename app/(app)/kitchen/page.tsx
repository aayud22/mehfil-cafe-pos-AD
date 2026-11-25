'use client';

import { useMemo, useState } from 'react';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { updateOrderStatusAction } from '@/app/actions/orders';
import { formatTime } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChefHat, Clock, CheckCircle2, Flame, Utensils, Loader2 } from 'lucide-react';
import { OrderStatus } from '@/types/database';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { toast } from 'sonner';

export default function KitchenPage() {
  const { orders, subscriptionStatus } = useRealtimeOrders();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { t } = useLanguage();

  // Group all table orders by created_at ascending to calculate Round N
  const tableOrderPositions = useMemo(() => {
    const map: Record<string, { round: number; totalRounds: number }> = {};
    const ordersByTable: Record<string, typeof orders> = {};

    orders.forEach((o) => {
      if (!ordersByTable[o.table_id]) {
        ordersByTable[o.table_id] = [];
      }
      ordersByTable[o.table_id].push(o);
    });

    Object.values(ordersByTable).forEach((tableOrders) => {
      // Sort table orders chronologically ascending
      tableOrders.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const totalRounds = tableOrders.length;
      tableOrders.forEach((o, index) => {
        map[o.id] = { round: index + 1, totalRounds };
      });
    });

    return map;
  }, [orders]);

  // Hide tickets with status 'served'. Sort by created_at ascending.
  const openKitchenOrders = useMemo(() => {
    return orders
      .filter((o) => o.status === 'new' || o.status === 'preparing' || o.status === 'ready')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [orders]);

  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      const res = await updateOrderStatusAction(orderId, nextStatus);
      if (res?.error) {
        toast.error('Failed to advance order status', { description: res.error });
      }
      // Success toast removed as instructed
    } catch {
      toast.error('Error advancing status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'new':
        return (
          <Badge variant="warning" className="animate-pulse text-xs font-bold">
            {t('kds_status_new')}
          </Badge>
        );
      case 'preparing':
        return (
          <Badge variant="info" className="text-xs font-bold">
            {t('kds_status_preparing')}
          </Badge>
        );
      case 'ready':
        return (
          <Badge variant="success" className="text-xs font-bold">
            {t('kds_status_ready')}
          </Badge>
        );
      default:
        return null;
    }
  };

  const isSubscribed = subscriptionStatus === 'SUBSCRIBED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <ChefHat className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
              {t('kds_title')}
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              {t('kds_subtitle')}
            </p>
          </div>
        </div>

        {/* Realtime Subscription Status Indicator */}
        <div className="flex items-center gap-2">
          <span className="flex h-3 w-3 relative">
            {isSubscribed && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                isSubscribed ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            ></span>
          </span>
          <span
            className={`text-xs font-bold uppercase tracking-wider ${
              isSubscribed ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {isSubscribed ? t('kds_live') : t('kds_connecting')}
          </span>
        </div>
      </div>

      {/* Orders Grid */}
      {openKitchenOrders.length === 0 ? (
        <Card className="flex flex-col items-center justify-center border-dashed py-16 text-center">
          <Utensils className="h-12 w-12 text-muted-foreground/60" />
          <h3 className="mt-4 text-base font-semibold text-foreground">
            {t('kds_all_caught_up')}
          </h3>
          <p className="mt-1 text-xs md:text-sm text-muted-foreground">
            {t('kds_no_pending')}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {openKitchenOrders.map((order) => {
            const isProcessing = updatingId === order.id;
            const pos = tableOrderPositions[order.id];

            return (
              <Card
                key={order.id}
                className={`flex flex-col justify-between p-5 shadow-lg transition ${
                  order.status === 'new'
                    ? 'border-primary/80 bg-primary/10'
                    : order.status === 'preparing'
                    ? 'border-blue-500/50 bg-card'
                    : 'bg-card'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-primary">
                        Table {order.table?.label || 'T-?'}
                      </span>
                      {pos && pos.totalRounds > 1 && (
                        <Badge
                          variant="secondary"
                          className="text-[11px] font-bold border border-primary/30 text-primary"
                        >
                          Round {pos.round}
                        </Badge>
                      )}
                    </div>
                    {getStatusBadge(order.status)}
                  </div>

                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatTime(order.created_at)}</span>
                  </div>

                  {order.note && (
                    <div className="mt-2.5 rounded-lg border border-primary/40 bg-primary/10 p-2 text-xs text-foreground">
                      <span className="font-semibold text-primary">Note:</span> {order.note}
                    </div>
                  )}

                  {/* Items list (excluding voided items) */}
                  <div className="mt-4 space-y-2">
                    {order.order_items
                      ?.filter((item) => !item.voided_at)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between text-sm py-1 border-b border-border/40 last:border-none"
                        >
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-xs font-bold text-primary">
                            {item.quantity}x
                          </span>
                          <span className="font-semibold text-foreground">
                            {item.menu_item?.name || 'Item'}
                          </span>
                        </div>
                        {item.note && (
                          <span className="text-xs text-muted-foreground italic">
                            {item.note}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Advancement Buttons */}
                <div className="mt-6 border-t border-border pt-4">
                  {order.status === 'new' && (
                    <Button
                      onClick={() => handleUpdateStatus(order.id, 'preparing')}
                      disabled={isProcessing}
                      className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold gap-2 shadow"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Flame className="h-4 w-4" />
                      )}
                      <span>{t('kds_start_preparing')}</span>
                    </Button>
                  )}

                  {order.status === 'preparing' && (
                    <Button
                      onClick={() => handleUpdateStatus(order.id, 'ready')}
                      disabled={isProcessing}
                      className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-2 shadow"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      <span>{t('kds_mark_ready')}</span>
                    </Button>
                  )}

                  {order.status === 'ready' && (
                    <Button
                      onClick={() => handleUpdateStatus(order.id, 'served')}
                      disabled={isProcessing}
                      variant="secondary"
                      className="w-full h-11 font-semibold"
                    >
                      <span>Hand Over to Waiter</span>
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
