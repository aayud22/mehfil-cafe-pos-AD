-- ==============================================================================
-- Mehfil Cafe POS - Migration 00003
-- Cancellations, Voided Items, Payment Receipt IDs, and Dashboard Fixes
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Columns
-- ------------------------------------------------------------------------------
alter table public.orders
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete set null,
  add column if not exists cancel_reason text;

alter table public.order_items
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.profiles(id) on delete set null,
  add column if not exists void_reason text;

alter table public.payments
  add column if not exists receipt_id uuid;

create index if not exists idx_payments_receipt_id on public.payments (receipt_id);

-- ------------------------------------------------------------------------------
-- 2. Cancel a whole order
-- ------------------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active boolean;
  v_status text;
  v_table uuid;
begin
  select role, is_active into v_role, v_active from profiles where id = auth.uid();
  if v_role is null or not v_active then raise exception 'Not allowed'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required'; end if;

  select status, table_id into v_status, v_table
  from orders where id = p_order_id for update;

  if v_status is null then raise exception 'Order not found'; end if;
  if v_status in ('billed', 'cancelled') then
    raise exception 'This order can no longer be cancelled';
  end if;

  if v_role in ('owner', 'manager') then
    null;
  elsif v_role in ('waiter', 'cashier') and v_status = 'new' then
    null;
  else
    raise exception 'Not allowed to cancel this order';
  end if;

  update orders
  set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
      cancel_reason = trim(p_reason)
  where id = p_order_id;

  if not exists (
    select 1 from orders
    where table_id = v_table and status in ('new', 'preparing', 'ready', 'served')
  ) then
    update cafe_tables set status = 'free' where id = v_table;
  end if;
end;
$$;

-- ------------------------------------------------------------------------------
-- 3. Remove one item from an order (soft delete, history is kept)
-- ------------------------------------------------------------------------------
create or replace function public.void_order_item(p_item_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active boolean;
  v_order uuid;
  v_status text;
  v_table uuid;
  v_left int;
begin
  select role, is_active into v_role, v_active from profiles where id = auth.uid();
  if v_role is null or not v_active then raise exception 'Not allowed'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required'; end if;

  select order_id into v_order
  from order_items where id = p_item_id and voided_at is null;
  if v_order is null then raise exception 'Item not found or already removed'; end if;

  select status, table_id into v_status, v_table
  from orders where id = v_order for update;

  if v_status in ('billed', 'cancelled') then raise exception 'This order is closed'; end if;

  if v_role in ('owner', 'manager') then
    null;
  elsif v_role in ('waiter', 'cashier') and v_status = 'new' then
    null;
  else
    raise exception 'Not allowed to remove items from this order';
  end if;

  update order_items
  set voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason)
  where id = p_item_id;

  select count(*) into v_left
  from order_items where order_id = v_order and voided_at is null;

  if v_left = 0 then
    update orders
    set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
        cancel_reason = 'All items removed'
    where id = v_order;

    if not exists (
      select 1 from orders
      where table_id = v_table and status in ('new', 'preparing', 'ready', 'served')
    ) then
      update cafe_tables set status = 'free' where id = v_table;
    end if;
  end if;
end;
$$;

-- ------------------------------------------------------------------------------
-- 4. Replaces the earlier pay_table: ignores voided items and returns a receipt id
-- ------------------------------------------------------------------------------
drop function if exists public.pay_table(uuid, text);

create function public.pay_table(p_table_id uuid, p_mode text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  r record;
  v_amount numeric(10,2);
  v_found boolean := false;
  v_receipt uuid := gen_random_uuid();
begin
  if p_mode not in ('cash', 'upi', 'card') then
    raise exception 'Invalid payment mode';
  end if;

  if exists (
    select 1 from orders
    where table_id = p_table_id and status in ('new', 'preparing', 'ready')
  ) then
    raise exception 'Some orders for this table are still being prepared';
  end if;

  for r in
    select id from orders
    where table_id = p_table_id and status = 'served'
    for update
  loop
    v_found := true;

    select coalesce(sum(quantity * unit_price), 0) into v_amount
    from order_items where order_id = r.id and voided_at is null;

    insert into payments (order_id, mode, amount, received_by, receipt_id)
    values (r.id, p_mode, v_amount, auth.uid(), v_receipt);

    update orders set status = 'billed' where id = r.id;
  end loop;

  if not v_found then raise exception 'Nothing to bill for this table'; end if;

  update cafe_tables set status = 'free' where id = p_table_id;
  return v_receipt;
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. Update get_today_dashboard_stats: exclude cancelled orders from count
-- ------------------------------------------------------------------------------
create or replace function public.get_today_dashboard_stats(
  p_date date default ((now() at time zone 'Asia/Kolkata')::date)
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_today_sales numeric(10,2) := 0;
  v_today_expenses numeric(10,2) := 0;
  v_today_profit numeric(10,2) := 0;
  v_cash_sales numeric(10,2) := 0;
  v_upi_sales numeric(10,2) := 0;
  v_card_sales numeric(10,2) := 0;
  v_orders_count int := 0;
  v_result json;
begin
  -- Verify permissions
  select role into v_role from public.profiles where id = auth.uid();
  if v_role not in ('owner', 'manager') then
    raise exception 'Access denied. Owner or Manager role required.';
  end if;

  -- 1. Sales: compare (paid_at at time zone 'Asia/Kolkata')::date to p_date
  select
    coalesce(sum(amount), 0),
    coalesce(sum(case when mode = 'cash' then amount else 0 end), 0),
    coalesce(sum(case when mode = 'upi' then amount else 0 end), 0),
    coalesce(sum(case when mode = 'card' then amount else 0 end), 0)
  into v_today_sales, v_cash_sales, v_upi_sales, v_card_sales
  from public.payments
  where (paid_at at time zone 'Asia/Kolkata')::date = p_date;

  -- 2. Expenses
  select coalesce(sum(amount), 0)
  into v_today_expenses
  from public.expenses
  where expense_date = p_date;

  -- 3. Orders Count: compare (created_at at time zone 'Asia/Kolkata')::date to p_date, excluding cancelled
  select count(*)
  into v_orders_count
  from public.orders
  where (created_at at time zone 'Asia/Kolkata')::date = p_date
    and status != 'cancelled';

  -- 4. Profit
  v_today_profit := v_today_sales - v_today_expenses;

  select json_build_object(
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
  ) into v_result;

  return v_result;
end;
$$;

-- ------------------------------------------------------------------------------
-- 6. Function get_top_items_today: only count order_items where voided_at is null
--    and order is not cancelled
-- ------------------------------------------------------------------------------
create or replace function public.get_top_items_today(
  p_date date default ((now() at time zone 'Asia/Kolkata')::date),
  p_limit int default 5
)
returns table (
  menu_item_id uuid,
  name text,
  total_quantity bigint,
  total_revenue numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    mi.id as menu_item_id,
    mi.name,
    coalesce(sum(oi.quantity), 0)::bigint as total_quantity,
    coalesce(sum(oi.quantity * oi.unit_price), 0)::numeric as total_revenue
  from public.order_items oi
  join public.orders o on oi.order_id = o.id
  join public.menu_items mi on oi.menu_item_id = mi.id
  where (o.created_at at time zone 'Asia/Kolkata')::date = p_date
    and oi.voided_at is null
    and o.status != 'cancelled'
  group by mi.id, mi.name
  order by total_quantity desc
  limit p_limit;
end;
$$;
