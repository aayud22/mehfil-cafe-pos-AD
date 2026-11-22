-- ==============================================================================
-- Mehfil Cafe Management System - Migration 00002
-- 1. Table-level payment settlement function: pay_table
-- 2. Privilege escalation fix on handle_new_user (reads from raw_app_meta_data)
-- 3. Timezone conversion to Asia/Kolkata for expenses & dashboard metrics
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Remove old pay_order function if it exists
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.pay_order(uuid, text);
DROP FUNCTION IF EXISTS public.pay_order(uuid);
DROP FUNCTION IF EXISTS public.pay_order;

-- ------------------------------------------------------------------------------
-- 2. Add pay_table function (SECURITY INVOKER, search_path = public)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_table(p_table_id UUID, p_mode TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_order_total NUMERIC(10, 2);
  v_grand_total NUMERIC(10, 2) := 0;
  v_billed_count INT := 0;
BEGIN
  -- Reject modes other than cash/upi/card
  IF p_mode NOT IN ('cash', 'upi', 'card') THEN
    RAISE EXCEPTION 'Invalid payment mode: %. Mode must be cash, upi, or card.', p_mode;
  END IF;

  -- Raise exception if the table has any order with status new, preparing or ready
  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE table_id = p_table_id AND status IN ('new', 'preparing', 'ready')
  ) THEN
    RAISE EXCEPTION 'Cannot settle table: there are active orders with status new, preparing, or ready.';
  END IF;

  -- Loop over all orders of that table with status 'served' (FOR UPDATE)
  FOR v_order IN
    SELECT id FROM public.orders
    WHERE table_id = p_table_id AND status = 'served'
    FOR UPDATE
  LOOP
    -- Compute the amount as sum(quantity * unit_price) from order_items
    SELECT COALESCE(SUM(quantity * unit_price), 0)
    INTO v_order_total
    FROM public.order_items
    WHERE order_id = v_order.id;

    -- Insert payments row
    INSERT INTO public.payments (order_id, mode, amount, received_by, paid_at)
    VALUES (v_order.id, p_mode, v_order_total, auth.uid(), timezone('utc', now()));

    -- Set the order status to 'billed'
    UPDATE public.orders
    SET status = 'billed'
    WHERE id = v_order.id;

    v_grand_total := v_grand_total + v_order_total;
    v_billed_count := v_billed_count + 1;
  END LOOP;

  -- Raise an exception if nothing was found to bill
  IF v_billed_count = 0 THEN
    RAISE EXCEPTION 'No served orders found to bill for table %.', p_table_id;
  END IF;

  -- Finally set cafe_tables.status = 'free'
  UPDATE public.cafe_tables
  SET status = 'free'
  WHERE id = p_table_id;

  RETURN v_grand_total;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. Fix privilege escalation on handle_new_user
--    Role is read strictly from new.raw_app_meta_data->>'role' (default 'waiter')
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Cafe Staff'),
    COALESCE(NEW.raw_app_meta_data->>'role', 'waiter')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. Fix timezone to Asia/Kolkata
--    - Set expenses.expense_date default
--    - Update get_today_dashboard_stats to use Asia/Kolkata
-- ------------------------------------------------------------------------------
ALTER TABLE public.expenses
  ALTER COLUMN expense_date SET DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date);

CREATE OR REPLACE FUNCTION public.get_today_dashboard_stats(
  p_date DATE DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date)
)
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

  -- 1. Sales: compare (paid_at at time zone 'Asia/Kolkata')::date to p_date
  SELECT
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(CASE WHEN mode = 'cash' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN mode = 'upi' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN mode = 'card' THEN amount ELSE 0 END), 0)
  INTO v_today_sales, v_cash_sales, v_upi_sales, v_card_sales
  FROM public.payments
  WHERE (paid_at AT TIME ZONE 'Asia/Kolkata')::date = p_date;

  -- 2. Expenses
  SELECT COALESCE(SUM(amount), 0)
  INTO v_today_expenses
  FROM public.expenses
  WHERE expense_date = p_date;

  -- 3. Orders Count: compare (created_at at time zone 'Asia/Kolkata')::date to p_date
  SELECT COUNT(*)
  INTO v_orders_count
  FROM public.orders
  WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = p_date;

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
