'use client';

import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { updateOrderStatusAction } from '@/app/actions/orders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChefHat, Clock, CheckCircle2, Flame, Utensils, Loader2 } from 'lucide-react';
import { OrderStatus } from '@/types/database';
import { toast } from 'sonner';
import { useState } from 'react';

export default function KitchenPage() {
  const { orders } = useRealtimeOrders();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      const res = await updateOrderStatusAction(orderId, nextStatus);
      if (res?.error) {
        toast.error('Failed to advance order status', { description: res.error });
      } else {
        toast.success(`Order ticket advanced to "${nextStatus.toUpperCase()}"!`);
      }
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
            New Ticket
          </Badge>
        );
      case 'preparing':
        return (
          <Badge variant="info" className="text-xs font-bold">
            Preparing
          </Badge>
        );
      case 'ready':
        return (
          <Badge variant="success" className="text-xs font-bold">
            Ready for Service
          </Badge>
        );
      case 'served':
        return (
          <Badge variant="secondary" className="text-xs font-bold">
            Served
          </Badge>
        );
      default:
        return null;
    }
  };

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
              Kitchen Display System (KDS)
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Real-time WebSocket feed of open dining tickets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Realtime Connected
          </span>
        </div>
      </div>

      {/* Orders Grid */}
      {orders.length === 0 ? (
        <Card className="flex flex-col items-center justify-center border-dashed py-16 text-center">
          <Utensils className="h-12 w-12 text-muted-foreground/60" />
          <h3 className="mt-4 text-base font-semibold text-foreground">
            Kitchen queue is empty
          </h3>
          <p className="mt-1 text-xs md:text-sm text-muted-foreground">
            New orders dispatched by waiters will pop up here instantly.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {orders.map((order) => {
            const isProcessing = updatingId === order.id;
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
                    <span className="text-xl font-black text-primary">
                      Table {order.table?.label || 'T-?'}
                    </span>
                    {getStatusBadge(order.status)}
                  </div>

                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {new Date(order.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {order.note && (
                    <div className="mt-2.5 rounded-lg border border-primary/40 bg-primary/10 p-2 text-xs text-foreground">
                      <span className="font-semibold text-primary">Note:</span> {order.note}
                    </div>
                  )}

                  {/* Items list */}
                  <div className="mt-4 space-y-2">
                    {order.order_items?.map((item) => (
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
                      <span>Start Cooking</span>
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
                      <span>Mark Ready for Pickup</span>
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
