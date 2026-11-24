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
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancel_reason?: string | null;
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
  voided_at?: string | null;
  voided_by?: string | null;
  void_reason?: string | null;
  menu_item?: MenuItem;
}

export type PaymentMode = 'cash' | 'upi' | 'card';

export interface Payment {
  id: string;
  order_id: string;
  mode: PaymentMode;
  amount: number;
  received_by: string | null;
  receipt_id?: string | null;
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

export interface BillRow {
  receipt_id: string;
  table_label: string;
  paid_at: string;
  mode: PaymentMode;
  total: number;
  orders_count: number;
  cashier_name: string;
  total_rows: number | string;
  grand_total: number | string;
}

export interface CancelledOrderRow {
  order_id: string;
  table_label: string;
  cancelled_at: string;
  cancelled_by_name: string;
  cancel_reason: string;
  items_summary: string;
  total_amount: number;
  total_rows: number | string;
  grand_total: number | string;
}

export interface Vendor {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  current_stock: number;
  unit: string;
  min_threshold: number;
  cost_per_unit: number;
  vendor_id: string | null;
  created_at: string;
  updated_at: string;
  vendor?: Vendor;
}

export interface VendorInvoice {
  id: string;
  vendor_id: string;
  invoice_number: string | null;
  invoice_date: string;
  total_amount: number;
  paid_amount: number;
  status: 'pending' | 'partial' | 'paid';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  vendor?: Vendor;
}

export interface VendorPayment {
  id: string;
  invoice_id: string;
  vendor_id: string;
  amount: number;
  mode: 'cash' | 'upi' | 'bank_transfer' | 'cheque';
  paid_at: string;
  notes: string | null;
  created_by: string | null;
}

export interface InventoryLog {
  id: string;
  item_id: string;
  type: 'restock' | 'usage' | 'waste' | 'adjustment';
  quantity: number;
  unit_cost: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}
