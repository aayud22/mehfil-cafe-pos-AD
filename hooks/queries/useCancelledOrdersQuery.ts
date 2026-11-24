'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { CancelledOrderRow } from '@/types/database';

export interface CancelledOrdersQueryParams {
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export function useCancelledOrdersQuery(params: CancelledOrdersQueryParams, enabled = true) {
  const supabase = createClient();
  const page = params.page || 1;
  const limit = params.limit || 20;
  const from = params.from;
  const to = params.to;

  return useQuery({
    queryKey: ['cancelled_orders', { from, to, page, limit }],
    queryFn: async () => {
      const offset = (page - 1) * limit;
      const { data, error } = await supabase.rpc('get_cancelled_orders', {
        p_from: from || null,
        p_to: to || null,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        throw error;
      }

      return (data || []) as CancelledOrderRow[];
    },
    placeholderData: (prev) => prev,
    staleTime: 60 * 1000,
    enabled,
  });
}
