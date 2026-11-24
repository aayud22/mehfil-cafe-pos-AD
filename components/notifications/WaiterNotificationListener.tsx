'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { playReadyChime } from '@/lib/audio';
import { toast } from 'sonner';

interface WaiterNotificationListenerProps {
  role: string;
}

export function WaiterNotificationListener({ role }: WaiterNotificationListenerProps) {
  const router = useRouter();
  const supabase = createClient();
  const tablesCacheRef = useRef<Record<string, string>>({});

  // Only active for waiter, manager, and owner roles
  const shouldListen = role === 'waiter' || role === 'owner' || role === 'manager';

  useEffect(() => {
    if (!shouldListen) return;

    // Pre-populate table labels cache
    async function loadTableLabels() {
      const { data } = await supabase.from('cafe_tables').select('id, label');
      if (data) {
        const cache: Record<string, string> = {};
        data.forEach((t) => {
          cache[t.id] = t.label;
        });
        tablesCacheRef.current = cache;
      }
    }
    loadTableLabels();

    // Subscribe to realtime orders updates
    const channel = supabase
      .channel('waiter-ready-alerts-channel')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        async (payload: any) => {
          const newStatus = payload?.new?.status;
          const oldStatus = payload?.old?.status;
          const tableId = payload?.new?.table_id;

          // Trigger alert specifically when order transitions to 'ready'
          if (newStatus === 'ready' && oldStatus !== 'ready' && tableId) {
            let label = tablesCacheRef.current[tableId];
            if (!label) {
              const { data } = await supabase
                .from('cafe_tables')
                .select('label')
                .eq('id', tableId)
                .single();
              if (data) {
                label = data.label;
                tablesCacheRef.current[tableId] = label;
              }
            }

            const tableDisplay = label ? `Table ${label}` : 'Dining Table';

            // Play the two-tone bell chime
            playReadyChime();

            // Display interactive toast with instant action button
            toast.success(`🔔 Order Ready for ${tableDisplay}!`, {
              description: 'Food is plated and ready for immediate table service.',
              duration: 9000,
              action: {
                label: 'View Table',
                onClick: () => {
                  router.push(`/waiter/orders/${tableId}`);
                },
              },
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, router, shouldListen]);

  return null;
}
