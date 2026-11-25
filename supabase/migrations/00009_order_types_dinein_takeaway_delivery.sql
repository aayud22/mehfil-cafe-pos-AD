-- ==============================================================================
-- Migration 00009: Release 4 Feature 2 — Order Types (Dine-in, Takeaway, Delivery)
-- ==============================================================================

-- 1. Orders table updates
alter table public.orders
  add column if not exists order_type text not null default 'dine_in'
    check (order_type in ('dine_in', 'takeaway', 'delivery')),
  add column if not exists token_number int,
  add column if not exists customer_name text
    check (customer_name is null or length(customer_name) <= 60);

alter table public.orders alter column table_id drop not null;

alter table public.orders drop constraint if exists orders_table_type_check;
alter table public.orders add constraint orders_table_type_check check (
  (order_type = 'dine_in' and table_id is not null)
  or (order_type in ('takeaway', 'delivery') and table_id is null)
);

-- 2. Bills table updates
alter table public.bills
  add column if not exists order_type text not null default 'dine_in'
    check (order_type in ('dine_in', 'takeaway', 'delivery'));

-- 3. Daily Order Tokens table (RLS enabled, no policies -> only create_order touches it)
create table if not exists public.order_tokens (
  day date primary key,
  last_token int not null
);
alter table public.order_tokens enable row level security;

-- 4. create_order RPC (reads prices from menu_items, validates availability, assigns daily token)
create or replace function public.create_order(
  p_table_id uuid,
  p_note text,
  p_items jsonb,
  p_order_type text default 'dine_in',
  p_customer_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active boolean;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_token int := null;
  v_order_id uuid;
  v_item jsonb;
  v_menu_id uuid;
  v_qty int;
  v_price numeric(10,2);
  v_avail boolean;
begin
  select role, is_active into v_role, v_active from public.profiles where id = auth.uid();
  if v_role is null or not v_active or v_role not in ('waiter', 'cashier', 'manager', 'owner') then
    raise exception 'Not allowed';
  end if;

  if p_order_type not in ('dine_in', 'takeaway', 'delivery') then
    raise exception 'Invalid order type';
  end if;

  if p_customer_name is not null and length(trim(p_customer_name)) > 60 then
    raise exception 'Customer name must be 60 characters or less';
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one item is required';
  end if;

  if p_order_type = 'dine_in' then
    if p_table_id is null then raise exception 'Table is required for dine-in orders'; end if;
    if not exists (select 1 from public.cafe_tables where id = p_table_id) then
      raise exception 'Table not found';
    end if;
  else
    if p_table_id is not null then raise exception 'Takeaway and delivery orders cannot have a table'; end if;
    insert into public.order_tokens (day, last_token)
    values (v_today, 1)
    on conflict (day) do update set last_token = order_tokens.last_token + 1
    returning last_token into v_token;
  end if;

  insert into public.orders (table_id, waiter_id, status, note, order_type, token_number, customer_name)
  values (
    p_table_id,
    auth.uid(),
    'new',
    nullif(trim(coalesce(p_note, '')), ''),
    p_order_type,
    v_token,
    nullif(trim(coalesce(p_customer_name, '')), '')
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_menu_id := (v_item->>'menu_item_id')::uuid;
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty < 1 then
      raise exception 'Invalid item quantity';
    end if;

    select price, is_available into v_price, v_avail
    from public.menu_items
    where id = v_menu_id;

    if v_price is null then
      raise exception 'Menu item not found';
    end if;
    if not v_avail then
      raise exception 'One or more selected items are currently unavailable';
    end if;

    insert into public.order_items (order_id, menu_item_id, quantity, unit_price, note)
    values (
      v_order_id,
      v_menu_id,
      v_qty,
      v_price,
      nullif(trim(coalesce(v_item->>'note', '')), '')
    );
  end loop;

  if p_order_type = 'dine_in' and p_table_id is not null then
    update public.cafe_tables set status = 'occupied' where id = p_table_id;
  end if;

  return v_order_id;
end;
$$;

-- 5. Update cancel_order: free a table only when v_table is not null
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

  if v_table is not null and not exists (
    select 1 from orders
    where table_id = v_table and status in ('new', 'preparing', 'ready', 'served')
  ) then
    update cafe_tables set status = 'free' where id = v_table;
  end if;
end;
$$;

-- 6. Update void_order_item: free a table only when v_table is not null
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

    if v_table is not null and not exists (
      select 1 from orders
      where table_id = v_table and status in ('new', 'preparing', 'ready', 'served')
    ) then
      update cafe_tables set status = 'free' where id = v_table;
    end if;
  end if;
end;
$$;

-- 7. Update pay_table: set bills.order_type from order when p_order_id is given, otherwise 'dine_in'
create or replace function public.pay_table(
  p_table_id uuid,
  p_payments jsonb,
  p_order_id uuid default null,
  p_item_ids uuid[] default null,
  p_discount_type text default 'none',
  p_discount_value numeric default 0,
  p_discount_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active boolean;
  s public.app_settings%rowtype;
  v_sub numeric(10,2);
  v_count int;
  v_pct numeric;
  v_max numeric;
  c record;
  v_bill uuid;
  v_line jsonb;
  v_amt numeric(10,2);
  v_paid numeric(10,2) := 0;
  v_order_type text := 'dine_in';
begin
  select role, is_active into v_role, v_active from public.profiles where id = auth.uid();
  if v_role is null or not v_active or v_role not in ('owner', 'manager', 'cashier') then
    raise exception 'Not allowed';
  end if;
  if p_table_id is null and p_order_id is null then raise exception 'Table or order required'; end if;
  if jsonb_typeof(coalesce(p_payments, '[]'::jsonb)) <> 'array' then raise exception 'Invalid payments'; end if;

  if p_order_id is not null then
    select order_type into v_order_type from public.orders where id = p_order_id;
    v_order_type := coalesce(v_order_type, 'dine_in');
  end if;

  if p_item_ids is null and exists (
    select 1 from public.orders o
    where o.status in ('new', 'preparing', 'ready')
      and ((p_order_id is not null and o.id = p_order_id) or (p_order_id is null and o.table_id = p_table_id))
  ) then
    raise exception 'Some orders are still being prepared';
  end if;

  select coalesce(sum(x.quantity * x.unit_price), 0), count(*) into v_sub, v_count
  from (
    select oi.quantity, oi.unit_price
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.status = 'served' and oi.voided_at is null and oi.bill_id is null
      and ((p_order_id is not null and o.id = p_order_id) or (p_order_id is null and o.table_id = p_table_id))
      and (p_item_ids is null or oi.id = any(p_item_ids))
    for update of oi
  ) x;

  if v_count = 0 then raise exception 'Nothing to bill'; end if;
  if p_item_ids is not null and v_count <> cardinality(p_item_ids) then
    raise exception 'Some selected items cannot be billed';
  end if;

  if p_discount_type <> 'none' then
    if coalesce(trim(p_discount_reason), '') = '' then raise exception 'A reason is required for a discount'; end if;
    select * into s from public.app_settings where id = 1;
    v_pct := case
      when p_discount_type = 'percent' then p_discount_value
      when v_sub > 0 then p_discount_value * 100 / v_sub
      else 0 end;
    v_max := case v_role
      when 'owner' then 100
      when 'manager' then s.manager_max_discount_percent
      else s.cashier_max_discount_percent end;
    if v_pct > v_max then raise exception 'This discount is above your limit'; end if;
  end if;

  select * into c from public.compute_bill(v_sub, p_discount_type, p_discount_value);

  for v_line in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    if coalesce(v_line->>'mode', '') not in ('cash', 'upi', 'card') then raise exception 'Invalid payment mode'; end if;
    v_amt := (v_line->>'amount')::numeric;
    if v_amt is null or v_amt <= 0 then raise exception 'Invalid payment amount'; end if;
    v_paid := v_paid + v_amt;
  end loop;
  if abs(v_paid - c.total) > 0.009 then raise exception 'Payments must add up to the bill total'; end if;

  insert into public.bills (
    table_id, order_type, subtotal, discount_type, discount_value, discount_amount, discount_reason,
    tax_rate, tax_amount, round_off, total, created_by
  )
  values (
    p_table_id, v_order_type, v_sub, p_discount_type, p_discount_value, c.discount_amount, nullif(trim(p_discount_reason), ''),
    c.tax_rate, c.tax_amount, c.round_off, c.total, auth.uid()
  )
  returning id into v_bill;

  update public.order_items oi set bill_id = v_bill
  from public.orders o
  where o.id = oi.order_id and o.status = 'served' and oi.voided_at is null and oi.bill_id is null
    and ((p_order_id is not null and o.id = p_order_id) or (p_order_id is null and o.table_id = p_table_id))
    and (p_item_ids is null or oi.id = any(p_item_ids));

  for v_line in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    insert into public.payments (bill_id, receipt_id, order_id, mode, amount, received_by)
    values (v_bill, v_bill, null, v_line->>'mode', (v_line->>'amount')::numeric, auth.uid());
  end loop;

  update public.orders o set status = 'billed'
  where o.status = 'served'
    and ((p_order_id is not null and o.id = p_order_id) or (p_order_id is null and o.table_id = p_table_id))
    and not exists (
      select 1 from public.order_items oi
      where oi.order_id = o.id and oi.voided_at is null and oi.bill_id is null
    );

  if p_table_id is not null and not exists (
    select 1 from public.orders where table_id = p_table_id and status in ('new', 'preparing', 'ready', 'served')
  ) then
    update public.cafe_tables set status = 'free' where id = p_table_id;
  end if;

  return v_bill;
end;
$$;

-- 8. Update get_bills: add order_type filter and return order_type + Takeaway/Delivery #token label
drop function if exists public.get_bills(date, date, text, int, int);

create or replace function public.get_bills(
  p_from date default null,
  p_to date default null,
  p_mode text default null,
  p_limit int default 20,
  p_offset int default 0,
  p_order_type text default null
)
returns table (
  receipt_id uuid,
  table_label text,
  order_type text,
  paid_at timestamptz,
  mode text,
  total numeric,
  orders_count int,
  cashier_name text,
  discount_amount numeric,
  total_rows bigint,
  grand_total numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active boolean;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_from date;
  v_to date;
begin
  select role, is_active into v_role, v_active from profiles where id = auth.uid();
  if v_role is null or not v_active or v_role not in ('owner', 'manager', 'cashier') then
    raise exception 'Not allowed';
  end if;
  if p_mode is not null and p_mode not in ('cash', 'upi', 'card') then
    raise exception 'Invalid payment mode';
  end if;
  if p_order_type is not null and p_order_type not in ('dine_in', 'takeaway', 'delivery') then
    raise exception 'Invalid order type';
  end if;

  v_from := coalesce(p_from, v_today);
  v_to := coalesce(p_to, v_today);
  if v_to < v_from then raise exception 'Invalid date range'; end if;

  if v_role = 'cashier' then
    v_from := v_today;
    v_to := v_today;
  end if;

  p_limit := least(greatest(p_limit, 1), 100);
  p_offset := greatest(p_offset, 0);

  return query
  with filtered_bills as (
    select
      b.id as g_receipt,
      case
        when b.order_type = 'takeaway' then
          'Takeaway #' || coalesce(
            (select min(o.token_number)::text from public.order_items oi join public.orders o on o.id = oi.order_id where oi.bill_id = b.id),
            '?'
          )
        when b.order_type = 'delivery' then
          'Delivery #' || coalesce(
            (select min(o.token_number)::text from public.order_items oi join public.orders o on o.id = oi.order_id where oi.bill_id = b.id),
            '?'
          )
        else 'Table ' || coalesce(ct.label, '?')
      end as g_table,
      b.order_type as g_order_type,
      b.created_at as g_paid,
      coalesce(
        (
          select string_agg(distinct upper(p.mode), ' + ' order by upper(p.mode))
          from public.payments p
          where p.bill_id = b.id
        ),
        'CASH'
      ) as g_mode,
      b.total as g_total,
      coalesce(
        (
          select count(distinct oi.order_id)::int
          from public.order_items oi
          where oi.bill_id = b.id and oi.voided_at is null
        ),
        1
      ) as g_orders,
      pr.full_name as g_cashier,
      b.discount_amount as g_discount
    from public.bills b
    left join public.cafe_tables ct on ct.id = b.table_id
    left join public.profiles pr on pr.id = b.created_by
    where (b.created_at at time zone 'Asia/Kolkata')::date between v_from and v_to
      and (p_order_type is null or b.order_type = p_order_type)
      and (
        p_mode is null
        or exists (
          select 1 from public.payments p
          where p.bill_id = b.id and p.mode = p_mode
        )
      )
  )
  select
    fb.g_receipt,
    fb.g_table,
    fb.g_order_type,
    fb.g_paid,
    fb.g_mode,
    fb.g_total,
    fb.g_orders,
    fb.g_cashier,
    fb.g_discount,
    count(*) over (),
    sum(fb.g_total) over ()
  from filtered_bills fb
  order by fb.g_paid desc
  limit p_limit offset p_offset;
end;
$$;

-- 9. Update get_cancelled_orders: left join cafe_tables and label Takeaway / Delivery #token
create or replace function public.get_cancelled_orders(
  p_from date default null,
  p_to date default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  order_id uuid,
  table_label text,
  created_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  cancelled_by_name text,
  items_summary text,
  total_rows bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active boolean;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_from date;
  v_to date;
begin
  select role, is_active into v_role, v_active from profiles where id = auth.uid();
  if v_role is null or not v_active or v_role not in ('owner', 'manager') then
    raise exception 'Not allowed';
  end if;

  v_from := coalesce(p_from, v_today);
  v_to := coalesce(p_to, v_today);
  if v_to < v_from then raise exception 'Invalid date range'; end if;

  p_limit := least(greatest(p_limit, 1), 100);
  p_offset := greatest(p_offset, 0);

  return query
  select
    o.id,
    case
      when o.order_type = 'takeaway' then 'Takeaway #' || coalesce(o.token_number::text, '?')
      when o.order_type = 'delivery' then 'Delivery #' || coalesce(o.token_number::text, '?')
      else 'Table ' || coalesce(ct.label, '?')
    end,
    o.created_at,
    o.cancelled_at,
    o.cancel_reason,
    pr.full_name,
    (select string_agg(oi.quantity::text || 'x ' || mi.name, ', ' order by mi.name)
     from order_items oi
     join menu_items mi on mi.id = oi.menu_item_id
     where oi.order_id = o.id),
    count(*) over ()
  from orders o
  left join cafe_tables ct on ct.id = o.table_id
  left join profiles pr on pr.id = o.cancelled_by
  where o.status = 'cancelled'
    and (o.cancelled_at at time zone 'Asia/Kolkata')::date between v_from and v_to
  order by o.cancelled_at desc
  limit p_limit offset p_offset;
end;
$$;

-- 10. Update get_today_dashboard_stats: add orders_by_type breakdown
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
  v_gst_collected_today numeric(10,2) := 0;
  v_discounts_today numeric(10,2) := 0;
  v_net_sales_today numeric(10,2) := 0;
  v_today_expenses numeric(10,2) := 0;
  v_today_profit numeric(10,2) := 0;
  v_cash_sales numeric(10,2) := 0;
  v_upi_sales numeric(10,2) := 0;
  v_card_sales numeric(10,2) := 0;
  v_orders_count int := 0;
  v_dine_in_count int := 0;
  v_takeaway_count int := 0;
  v_delivery_count int := 0;
  v_result json;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role not in ('owner', 'manager') then
    raise exception 'Access denied. Owner or Manager role required.';
  end if;

  select
    coalesce(sum(amount), 0),
    coalesce(sum(case when mode = 'cash' then amount else 0 end), 0),
    coalesce(sum(case when mode = 'upi' then amount else 0 end), 0),
    coalesce(sum(case when mode = 'card' then amount else 0 end), 0)
  into v_today_sales, v_cash_sales, v_upi_sales, v_card_sales
  from public.payments
  where (paid_at at time zone 'Asia/Kolkata')::date = p_date;

  select
    coalesce(sum(tax_amount), 0),
    coalesce(sum(discount_amount), 0)
  into v_gst_collected_today, v_discounts_today
  from public.bills
  where (created_at at time zone 'Asia/Kolkata')::date = p_date;

  v_net_sales_today := v_today_sales - v_gst_collected_today;

  select coalesce(sum(amount), 0)
  into v_today_expenses
  from public.expenses
  where expense_date = p_date;

  select
    count(*),
    count(*) filter (where order_type = 'dine_in'),
    count(*) filter (where order_type = 'takeaway'),
    count(*) filter (where order_type = 'delivery')
  into v_orders_count, v_dine_in_count, v_takeaway_count, v_delivery_count
  from public.orders
  where (created_at at time zone 'Asia/Kolkata')::date = p_date
    and status != 'cancelled';

  v_today_profit := v_net_sales_today - v_today_expenses;

  select json_build_object(
    'date', p_date,
    'today_sales', v_today_sales,
    'gst_collected_today', v_gst_collected_today,
    'discounts_today', v_discounts_today,
    'net_sales_today', v_net_sales_today,
    'today_expenses', v_today_expenses,
    'today_profit', v_today_profit,
    'orders_count', v_orders_count,
    'orders_by_type', json_build_object(
      'dine_in', v_dine_in_count,
      'takeaway', v_takeaway_count,
      'delivery', v_delivery_count
    ),
    'mode_breakdown', json_build_object(
      'cash', v_cash_sales,
      'upi', v_upi_sales,
      'card', v_card_sales
    )
  ) into v_result;

  return v_result;
end;
$$;

-- Function permissions hardening
revoke execute on function public.create_order(uuid, text, jsonb, text, text) from public, anon;
revoke execute on function public.pay_table(uuid, jsonb, uuid, uuid[], text, numeric, text) from public, anon;
revoke execute on function public.get_bills(date, date, text, int, int, text) from public, anon;
revoke execute on function public.get_cancelled_orders(date, date, int, int) from public, anon;
revoke execute on function public.get_today_dashboard_stats(date) from public, anon;

grant execute on function public.create_order(uuid, text, jsonb, text, text) to authenticated;
grant execute on function public.pay_table(uuid, jsonb, uuid, uuid[], text, numeric, text) to authenticated;
grant execute on function public.get_bills(date, date, text, int, int, text) to authenticated;
grant execute on function public.get_cancelled_orders(date, date, int, int) to authenticated;
grant execute on function public.get_today_dashboard_stats(date) to authenticated;
