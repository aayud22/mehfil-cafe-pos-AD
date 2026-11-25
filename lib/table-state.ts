import { CafeTable, Order } from '@/types/database';

export type ComputedTableState = 'free' | 'cooking' | 'bill_pending' | 'bill_requested';

export function getTableState(
  table: Pick<CafeTable, 'status' | 'bill_requested_at'>,
  orders: Array<Pick<Order, 'status'>>
): ComputedTableState {
  const activeOrders = orders.filter((o) =>
    ['new', 'preparing', 'ready', 'served'].includes(o.status)
  );

  if (activeOrders.length === 0 && table.status === 'free') {
    return 'free';
  }

  if (table.bill_requested_at) {
    return 'bill_requested';
  }

  if (activeOrders.some((o) => o.status === 'new' || o.status === 'preparing' || o.status === 'ready')) {
    return 'cooking';
  }

  if (activeOrders.some((o) => o.status === 'served')) {
    return 'bill_pending';
  }

  return table.status === 'occupied' ? 'cooking' : 'free';
}

export const TABLE_STATE_META: Record<
  ComputedTableState,
  { label: string; badgeClass: string }
> = {
  free: {
    label: 'Free',
    badgeClass: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
  },
  cooking: {
    label: 'Cooking',
    badgeClass: 'border-amber-500/30 bg-amber-500/15 text-amber-400',
  },
  bill_pending: {
    label: 'Bill Pending',
    badgeClass: 'border-sky-500/30 bg-sky-500/15 text-sky-400',
  },
  bill_requested: {
    label: 'Bill Requested',
    badgeClass: 'border-rose-500/40 bg-rose-500/20 text-rose-400 animate-pulse',
  },
};
