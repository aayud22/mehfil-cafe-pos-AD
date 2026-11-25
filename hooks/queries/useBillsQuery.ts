'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { BillRow } from '@/types/database';

export interface BillsQueryParams {
  from?: string;
  to?: string;
  mode?: 'cash' | 'upi' | 'card' | null;
  order_type?: 'dine_in' | 'takeaway' | 'delivery' | null;
  page?: number;
  limit?: number;
}

export function useBillsQuery(params: BillsQueryParams, enabled = true) {
  const supabase = createClient();
  const page = params.page || 1;
  const limit = params.limit || 20;
  const from = params.from;
  const to = params.to;
  const mode = params.mode || null;
  const orderType = params.order_type || null;

  return useQuery({
    queryKey: ['bills', { from, to, mode, orderType, page, limit }],
    queryFn: async () => {
      const offset = (page - 1) * limit;
      const { data, error } = await supabase.rpc('get_bills', {
        p_from: from || null,
        p_to: to || null,
        p_mode: mode,
        p_limit: limit,
        p_offset: offset,
        p_order_type: orderType,
      });

      if (error) {
        throw error;
      }

      return (data || []) as BillRow[];
    },
    placeholderData: (prev) => prev,
    staleTime: 60 * 1000,
    enabled,
  });
}
