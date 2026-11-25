-- ==============================================================================
-- Migration 00011: Release 4 Feature 4 — Table Transfer, Request Bill & States
-- ==============================================================================

-- 1. Add bill_requested_at to cafe_tables
alter table public.cafe_tables
  add column if not exists bill_requested_at timestamptz null;

-- 2. transfer_table(p_from, p_to): deadlock-safe table transfer
create or replace function public.transfer_table(p_from uuid, p_to uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active boolean;
  v_from_exists boolean;
  v_to_status text;
  v_source_orders int;
  v_dest_orders int;
  v_first uuid;
  v_second uuid;
begin
  select role, is_active into v_role, v_active from public.profiles where id = auth.uid();
  if v_role is null or not v_active or v_role not in ('owner', 'manager', 'waiter', 'cashier') then
    raise exception 'Not allowed';
  end if;

  if p_from is null or p_to is null then
    raise exception 'Both source and destination tables are required';
  end if;
  if p_from = p_to then
    raise exception 'Source and destination tables cannot be the same';
  end if;

  -- Lock both rows in deterministic id order to avoid deadlocks
  if p_from < p_to then
    v_first := p_from;
    v_second := p_to;
  else
    v_first := p_to;
    v_second := p_from;
  end if;

  perform 1 from public.cafe_tables where id = v_first for update;
  perform 1 from public.cafe_tables where id = v_second for update;

  select exists(select 1 from public.cafe_tables where id = p_from) into v_from_exists;
  select status into v_to_status from public.cafe_tables where id = p_to;

  if not v_from_exists or v_to_status is null then
    raise exception 'Table not found';
  end if;

  select count(*) into v_dest_orders
  from public.orders
  where table_id = p_to and status in ('new', 'preparing', 'ready', 'served');

  if v_to_status <> 'free' or v_dest_orders > 0 then
    raise exception 'Destination table is not free';
  end if;

  select count(*) into v_source_orders
  from public.orders
  where table_id = p_from and status in ('new', 'preparing', 'ready', 'served');

  if v_source_orders = 0 then
    raise exception 'Source table has no active orders to transfer';
  end if;

  -- Move active orders to destination table
  update public.orders
  set table_id = p_to, updated_at = now()
  where table_id = p_from and status in ('new', 'preparing', 'ready', 'served');

  -- Update table statuses and clear bill_requested_at on both
  update public.cafe_tables
  set status = 'occupied', bill_requested_at = null
  where id = p_to;

  update public.cafe_tables
  set status = 'free', bill_requested_at = null
  where id = p_from;
end;
$$;

-- 3. request_bill(p_table_id)
create or replace function public.request_bill(p_table_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active boolean;
  v_status text;
  v_active_orders int;
begin
  select role, is_active into v_role, v_active from public.profiles where id = auth.uid();
  if v_role is null or not v_active or v_role not in ('owner', 'manager', 'waiter', 'cashier') then
    raise exception 'Not allowed';
  end if;

  if p_table_id is null then
    raise exception 'Table ID is required';
  end if;

  select status into v_status from public.cafe_tables where id = p_table_id for update;
  if v_status is null then
    raise exception 'Table not found';
  end if;

  select count(*) into v_active_orders
  from public.orders
  where table_id = p_table_id and status in ('new', 'preparing', 'ready', 'served');

  if v_status <> 'occupied' and v_active_orders = 0 then
    raise exception 'Only occupied tables can request a bill';
  end if;

  update public.cafe_tables
  set bill_requested_at = now()
  where id = p_table_id;
end;
$$;

-- 4. Update pay_table: also clear bill_requested_at = null when freeing a table
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
    update public.cafe_tables set status = 'free', bill_requested_at = null where id = p_table_id;
  end if;

  return v_bill;
end;
$$;

revoke execute on function public.transfer_table(uuid, uuid) from public, anon;
revoke execute on function public.request_bill(uuid) from public, anon;
revoke execute on function public.pay_table(uuid, jsonb, uuid, uuid[], text, numeric, text) from public, anon;

grant execute on function public.transfer_table(uuid, uuid) to authenticated;
grant execute on function public.request_bill(uuid) to authenticated;
grant execute on function public.pay_table(uuid, jsonb, uuid, uuid[], text, numeric, text) to authenticated;
