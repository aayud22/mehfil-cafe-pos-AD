-- ==============================================================================
-- Mehfil Cafe Management System - Version 1 Initial Schema
-- ==============================================================================

-- 1. Helper Function: Get user role from profiles
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 2. Profiles Table (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'cashier', 'kitchen', 'waiter')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 3. Menu Categories
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

-- 4. Menu Items
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 5. Cafe Tables
CREATE TABLE IF NOT EXISTS public.cafe_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  seats INT NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'occupied'))
);

-- 6. Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.cafe_tables(id) ON DELETE RESTRICT,
  waiter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'preparing', 'ready', 'served', 'billed', 'cancelled')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 7. Order Items (Unit price copied to preserve historic transaction value)
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  note TEXT
);

-- 8. Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  mode TEXT NOT NULL CHECK (mode IN ('cash', 'upi', 'card')),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  received_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 9. Expenses (Minimal Version 1)
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  note TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- ==============================================================================
-- Indexes for Performance
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON public.orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON public.orders (table_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments (paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments (order_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON public.expenses (expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON public.menu_items (category_id);

-- ==============================================================================
-- Auto-update updated_at Trigger on orders
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_orders_updated_at ON public.orders;
CREATE TRIGGER set_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto create profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Cafe Staff'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'waiter')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- Row Level Security (RLS)
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Profiles: Authenticated users can view profiles; only owners/managers can edit them
CREATE POLICY "Profiles readable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Profiles editable by owners"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'owner');

-- Menu Categories & Menu Items:
-- Everyone (all authenticated roles) can view menu items
CREATE POLICY "Menu readable by all staff"
  ON public.menu_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Menu items readable by all staff"
  ON public.menu_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Menu editable by owner and manager"
  ON public.menu_categories FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('owner', 'manager'));

CREATE POLICY "Menu items editable by owner and manager"
  ON public.menu_items FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('owner', 'manager'));

-- Cafe Tables:
-- Readable by all staff, editable by owner and manager, status updatable by waiter/cashier
CREATE POLICY "Tables readable by all staff"
  ON public.cafe_tables FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Tables manageable by owner and manager"
  ON public.cafe_tables FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('owner', 'manager'));

CREATE POLICY "Table status update by waiter and cashier"
  ON public.cafe_tables FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('waiter', 'cashier'));

-- Orders:
-- Owner & Manager: full access
-- Kitchen: can view active/open orders, update status to preparing/ready
-- Cashier: can view orders, update status to billed
-- Waiter: can view and create orders, update status to served
CREATE POLICY "Orders read policy"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() IN ('owner', 'manager', 'cashier')
    OR (public.current_user_role() = 'kitchen' AND status IN ('new', 'preparing', 'ready', 'served'))
    OR (public.current_user_role() = 'waiter')
  );

CREATE POLICY "Orders insert policy"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('owner', 'manager', 'waiter', 'cashier')
  );

CREATE POLICY "Orders update policy"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() IN ('owner', 'manager')
    OR (public.current_user_role() = 'kitchen' AND status IN ('new', 'preparing', 'ready'))
    OR (public.current_user_role() = 'waiter' AND status IN ('new', 'preparing', 'ready', 'served'))
    OR (public.current_user_role() = 'cashier')
  );

-- Order Items:
CREATE POLICY "Order items readable by staff"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Order items insertable by waiter and manager"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('owner', 'manager', 'waiter', 'cashier'));

-- Payments:
-- Readable by owner, manager, cashier
-- Insertable by owner, manager, cashier
CREATE POLICY "Payments read policy"
  ON public.payments FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('owner', 'manager', 'cashier'));

CREATE POLICY "Payments insert policy"
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('owner', 'manager', 'cashier'));

-- Expenses:
-- Readable and manageable by owner and manager
CREATE POLICY "Expenses owner manager access"
  ON public.expenses FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('owner', 'manager'));

-- ==============================================================================
-- Dashboard Metrics Function (Owner & Manager Only)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_today_dashboard_stats(p_date DATE DEFAULT CURRENT_DATE)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_today_sales NUMERIC(10,2) := 0;
  v_today_expenses NUMERIC(10,2) := 0;
  v_today_profit NUMERIC(10,2) := 0;
  v_cash_sales NUMERIC(10,2) := 0;
  v_upi_sales NUMERIC(10,2) := 0;
  v_card_sales NUMERIC(10,2) := 0;
  v_orders_count INT := 0;
  v_result JSON;
BEGIN
  -- Verify permissions
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Access denied. Owner or Manager role required.';
  END IF;

  -- 1. Sales
  SELECT
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(CASE WHEN mode = 'cash' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN mode = 'upi' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN mode = 'card' THEN amount ELSE 0 END), 0)
  INTO v_today_sales, v_cash_sales, v_upi_sales, v_card_sales
  FROM public.payments
  WHERE DATE(paid_at AT TIME ZONE 'UTC') = p_date;

  -- 2. Expenses
  SELECT COALESCE(SUM(amount), 0)
  INTO v_today_expenses
  FROM public.expenses
  WHERE expense_date = p_date;

  -- 3. Orders Count
  SELECT COUNT(*)
  INTO v_orders_count
  FROM public.orders
  WHERE DATE(created_at AT TIME ZONE 'UTC') = p_date;

  -- 4. Profit
  v_today_profit := v_today_sales - v_today_expenses;

  SELECT json_build_object(
    'date', p_date,
    'today_sales', v_today_sales,
    'today_expenses', v_today_expenses,
    'today_profit', v_today_profit,
    'orders_count', v_orders_count,
    'mode_breakdown', json_build_object(
      'cash', v_cash_sales,
      'upi', v_upi_sales,
      'card', v_card_sales
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Enable Realtime on orders, order_items, and cafe_tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cafe_tables;
