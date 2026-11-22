export type UserRole = 'owner' | 'manager' | 'cashier' | 'kitchen' | 'waiter';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  price: number;
  is_available: boolean;
  created_at: string;
  category?: MenuCategory;
}

export type TableStatus = 'free' | 'occupied';

export interface CafeTable {
  id: string;
  label: string;
  seats: number;
  status: TableStatus;
}

export type OrderStatus = 'new' | 'preparing' | 'ready' | 'served' | 'billed' | 'cancelled';

export interface Order {
  id: string;
  table_id: string;
  waiter_id: string | null;
  status: OrderStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
  table?: CafeTable;
  waiter?: Profile;
  order_items?: OrderItem[];
  payments?: Payment[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  note: string | null;
  menu_item?: MenuItem;
}

export type PaymentMode = 'cash' | 'upi' | 'card';

export interface Payment {
  id: string;
  order_id: string;
  mode: PaymentMode;
  amount: number;
  received_by: string | null;
  paid_at: string;
}

export interface Expense {
  id: string;
  expense_date: string;
  category: string;
  amount: number;
  note: string | null;
  created_by: string | null;
}

export interface DashboardStats {
  date: string;
  today_sales: number;
  today_expenses: number;
  today_profit: number;
  orders_count: number;
  mode_breakdown: {
    cash: number;
    upi: number;
    card: number;
  };
}
