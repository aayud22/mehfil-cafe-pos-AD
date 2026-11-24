'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { DashboardStats } from '@/types/database';

export const TODAY_STATS_QUERY_KEY = ['today_dashboard_stats'];

export function useTodayStatsQuery() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const query = useQuery({
    queryKey: TODAY_STATS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_today_dashboard_stats');
      if (error) throw error;
      return data as DashboardStats;
    },
    staleTime: 30 * 1000,
  });

  // Listen to realtime changes on payments and expenses to invalidate cache
  useEffect(() => {
    const channel = supabase
      .channel('realtime-query-invalidation-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        () => {
          queryClient.invalidateQueries({ queryKey: TODAY_STATS_QUERY_KEY });
          queryClient.invalidateQueries({ queryKey: ['bills'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        () => {
          queryClient.invalidateQueries({ queryKey: TODAY_STATS_QUERY_KEY });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['cancelled_orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);

  return {
    stats: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch,
  };
}
