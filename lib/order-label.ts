import { OrderType } from '@/types/database';

export function getOrderDisplayLabel(order: {
  order_type?: OrderType | string | null;
  token_number?: number | null;
  table?: { label?: string | null } | null;
}): string {
  if (order.order_type === 'takeaway') {
    return `Takeaway #${order.token_number ?? '?'}`;
  }
  if (order.order_type === 'delivery') {
    return `Delivery #${order.token_number ?? '?'}`;
  }
  const tbl = Array.isArray(order.table) ? order.table[0] : order.table;
  return `Table ${tbl?.label ?? '?'}`;
}
