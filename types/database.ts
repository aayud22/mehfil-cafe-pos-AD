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

export interface ModifierOption {
  id: string;
  group_id: string;
  name: string;
  price_delta: number;
  is_available: boolean;
  sort_order: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  selection_type: 'single' | 'multiple';
  is_required: boolean;
  max_select: number | null;
  options?: ModifierOption[];
}

export interface OrderItemModifierSnapshot {
  group: string;
  option: string;
  price_delta: number;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  price: number;
  is_available: boolean;
  created_at: string;
  category?: MenuCategory;
  modifier_groups?: Array<{ group_id: string; sort_order: number; group?: ModifierGroup }>;
}

export type TableStatus = 'free' | 'occupied';

export interface CafeTable {
  id: string;
  label: string;
  seats: number;
  status: TableStatus;
  bill_requested_at?: string | null;
}

export type OrderStatus = 'new' | 'preparing' | 'ready' | 'served' | 'billed' | 'cancelled';
export type OrderType = 'dine_in' | 'takeaway' | 'delivery';

export interface Order {
  id: string;
  table_id: string | null;
  waiter_id: string | null;
  status: OrderStatus;
  order_type?: OrderType;
  token_number?: number | null;
  customer_name?: string | null;
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
  modifiers?: OrderItemModifierSnapshot[];
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
  gst_collected_today?: number;
  discounts_today?: number;
  net_sales_today?: number;
  today_expenses: number;
  today_profit: number;
  orders_count: number;
  orders_by_type?: {
    dine_in: number;
    takeaway: number;
    delivery: number;
  };
  mode_breakdown: {
    cash: number;
    upi: number;
    card: number;
  };
}

export interface BillRow {
  receipt_id: string;
  table_label: string;
  order_type?: OrderType;
  paid_at: string;
  mode: string;
  total: number;
  orders_count: number;
  cashier_name: string;
  discount_amount?: number;
  total_rows: number | string;
  grand_total: number | string;
}

export interface AppSettings {
  id: number;
  cafe_name: string;
  cafe_address: string | null;
  gstin: string | null;
  gst_enabled: boolean;
  gst_rate: number;
  cashier_max_discount_percent: number;
  manager_max_discount_percent: number;
  upi_id?: string | null;
  upi_payee_name?: string | null;
}

export interface Bill {
  id: string;
  table_id: string | null;
  subtotal: number;
  discount_type: 'none' | 'percent' | 'flat';
  discount_value: number;
  discount_amount: number;
  discount_reason: string | null;
  tax_rate: number;
  tax_amount: number;
  round_off: number;
  total: number;
  created_by: string | null;
  created_at: string;
}

export interface BillPreview {
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  round_off: number;
  total: number;
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

export type ShiftType = 'morning' | 'evening' | 'full_day';
export type AttendanceStatus = 'present' | 'half_day' | 'absent' | 'leave';

export interface StaffMember {
  id: string;
  profile_id: string | null;
  full_name: string;
  role_title: string;
  phone: string | null;
  monthly_salary: number;
  shift_type: ShiftType;
  joined_date: string;
  is_active: boolean;
  created_at: string;
}

export interface StaffAttendance {
  id: string;
  staff_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  shift: ShiftType;
  clock_in: string | null;
  clock_out: string | null;
  notes: string | null;
  marked_by: string | null;
  created_at: string;
}

export interface StaffSalaryPayment {
  id: string;
  staff_id: string;
  payment_month: string;
  amount: number;
  payment_type: 'salary' | 'advance' | 'bonus';
  mode: 'cash' | 'upi' | 'bank_transfer';
  paid_at: string;
  notes: string | null;
  created_by: string | null;
}

export interface MonthlyDailyBreakdown {
  date: string;
  label: string;
  day: number;
  sales: number;
  expenses: number;
}

export interface MonthlyBusinessReport {
  month: string;
  start_date: string;
  end_date: string;
  total_sales: number;
  cash_sales: number;
  upi_sales: number;
  card_sales: number;
  orders_count: number;
  cancelled_count: number;
  operating_expenses: number;
  salary_expenses: number;
  total_expenses: number;
  net_profit: number;
  vendor_dues_pending: number;
  daily_breakdown: MonthlyDailyBreakdown[];
}
