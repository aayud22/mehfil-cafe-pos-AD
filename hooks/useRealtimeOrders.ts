'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Order } from '@/types/database';

export function useRealtimeOrders(initialOrders: Order[] = []) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [subscriptionStatus, setSubscriptionStatus] = useState<
    'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR' | 'CONNECTING'
  >('CONNECTING');
  const supabase = createClient();

  useEffect(() => {
    async function fetchOrders() {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          table:cafe_tables(*),
          order_items(*, menu_item:menu_items(*))
        `)
        .in('status', ['new', 'preparing', 'ready', 'served'])
        .order('created_at', { ascending: true });

      if (!error && data) {
        const cleanedOrders = (data as Order[])
          .filter((o) => o.status !== 'cancelled')
          .map((o) => ({
            ...o,
            order_items: (o.order_items || []).filter((item) => !item.voided_at),
          }))
          .filter((o) => o.order_items.length > 0);
        setOrders(cleanedOrders);
      }
    }

    fetchOrders();

    // Subscribe to realtime orders & order items
    const channel = supabase
      .channel('kitchen-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchOrders();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          fetchOrders();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cafe_tables' },
        () => {
          fetchOrders();
        }
      )
      .subscribe((status) => {
        setSubscriptionStatus(status as any);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const updateOrderStatus = async (orderId: string, nextStatus: Order['status']) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: nextStatus })
      .eq('id', orderId);

    if (error) {
      console.error('Failed to update order status:', error.message);
      throw error;
    }
  };

  return { orders, subscriptionStatus, updateOrderStatus };
}
