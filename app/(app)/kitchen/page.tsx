'use client';

import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { ChefHat, Clock, CheckCircle2, Flame, Utensils } from 'lucide-react';
import { OrderStatus } from '@/types/database';

export default function KitchenPage() {
  const { orders, updateOrderStatus } = useRealtimeOrders();

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'new':
        return <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-400 ring-1 ring-amber-500/30 animate-pulse">New Ticket</span>;
      case 'preparing':
        return <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-semibold text-blue-400 ring-1 ring-blue-500/30">Preparing</span>;
      case 'ready':
        return <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30">Ready for Service</span>;
      case 'served':
        return <span className="rounded-full bg-slate-500/20 px-2.5 py-0.5 text-xs font-semibold text-slate-400">Served</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* KDS Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600/20 text-amber-500">
              <ChefHat className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Kitchen Display System (KDS)</h1>
              <p className="text-xs text-slate-400">Real-time WebSocket stream of open customer orders</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Live Realtime</span>
        </div>
      </div>

      {/* Orders Grid */}
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 py-16 text-center">
          <Utensils className="h-12 w-12 text-slate-600" />
          <h3 className="mt-4 text-base font-semibold text-slate-300">Kitchen is all clear!</h3>
          <p className="mt-1 text-sm text-slate-500">New orders dispatched by floor waiters will appear instantly here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className={`flex flex-col justify-between rounded-xl border p-5 shadow-xl transition ${
                order.status === 'new'
                  ? 'border-amber-500/50 bg-amber-950/20'
                  : order.status === 'preparing'
                  ? 'border-blue-500/40 bg-slate-900/90'
                  : 'border-slate-800 bg-slate-900/80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <span className="text-lg font-black text-amber-400">Table {order.table?.label || 'T-?'}</span>
                  {getStatusBadge(order.status)}
                </div>

                <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {order.note && (
                  <div className="mt-2 rounded bg-amber-950/30 p-2 text-xs text-amber-200 border border-amber-900/50">
                    <span className="font-semibold">Note:</span> {order.note}
                  </div>
                )}

                {/* Items List */}
                <div className="mt-4 space-y-2">
                  {order.order_items?.map((item) => (
                    <div key={item.id} className="flex items-start justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded bg-slate-800 text-xs font-bold text-amber-400">
                          {item.quantity}x
                        </span>
                        <span className="font-medium text-slate-200">{item.menu_item?.name || 'Item'}</span>
                      </div>
                      {item.note && <span className="text-xs text-slate-400 italic">{item.note}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Action Buttons */}
              <div className="mt-6 border-t border-slate-800/80 pt-4">
                {order.status === 'new' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'preparing')}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-blue-500 transition"
                  >
                    <Flame className="h-4 w-4" />
                    <span>Start Cooking</span>
                  </button>
                )}

                {order.status === 'preparing' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'ready')}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-500 transition"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Mark as Ready</span>
                  </button>
                )}

                {order.status === 'ready' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'served')}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-600 transition"
                  >
                    <span>Hand Over to Waiter</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
