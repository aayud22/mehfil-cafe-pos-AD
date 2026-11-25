-- ==============================================================================
-- Migration 00008: Release 4 Feature 1 — Discount, GST and the Bills Model
-- ==============================================================================

-- Settings (single row)
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  cafe_name text not null default 'Mehfil Cafe',
  cafe_address text,
  gstin text check (gstin is null or gstin ~ '^[0-9A-Z]{15}$'),
  gst_enabled boolean not null default true,
  gst_rate numeric(5,2) not null default 5 check (gst_rate between 0 and 28),
  cashier_max_discount_percent numeric(5,2) not null default 10 check (cashier_max_discount_percent between 0 and 100),
  manager_max_discount_percent numeric(5,2) not null default 25 check (manager_max_discount_percent between 0 and 100)
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;
alter table public.app_settings enable row level security;

drop policy if exists "Settings readable by staff" on public.app_settings;
create policy "Settings readable by staff" on public.app_settings
  for select to authenticated using (true);

drop policy if exists "Settings editable by owner" on public.app_settings;
create policy "Settings editable by owner" on public.app_settings
  for update to authenticated
  using (public.current_user_role() = 'owner')
  with check (public.current_user_role() = 'owner');

-- Bills
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references public.cafe_tables(id) on delete set null,
  subtotal numeric(10,2) not null check (subtotal >= 0),
  discount_type text not null default 'none' check (discount_type in ('none', 'percent', 'flat')),
  discount_value numeric(10,2) not null default 0 check (discount_value >= 0),
  discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0),
  discount_reason text,
  tax_rate numeric(5,2) not null default 0,
  tax_amount numeric(10,2) not null default 0,
  round_off numeric(10,2) not null default 0,
  total numeric(10,2) not null check (total >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_bills_created_at on public.bills (created_at desc);
alter table public.bills enable row level security;

drop policy if exists "Bills readable by billing staff" on public.bills;
create policy "Bills readable by billing staff" on public.bills
  for select to authenticated
  using (public.current_user_role() in ('owner', 'manager', 'cashier'));

-- Item-level billing and payment lines
alter table public.order_items
  add column if not exists bill_id uuid references public.bills(id) on delete set null;
create index if not exists idx_order_items_bill_id on public.order_items (bill_id);

alter table public.payments
  add column if not exists bill_id uuid references public.bills(id) on delete restrict;
alter table public.payments alter column order_id drop not null;
create index if not exists idx_payments_bill_id on public.payments (bill_id);

-- Backfill old payments into bills
insert into public.bills (id, table_id, subtotal, total, created_by, created_at)
select p.receipt_id,
       (array_agg(o.table_id))[1],
       sum(p.amount),
       sum(p.amount),
       (array_agg(p.received_by))[1],
       min(p.paid_at)
from public.payments p
join public.orders o on o.id = p.order_id
where p.receipt_id is not null
  and not exists (select 1 from public.bills b where b.id = p.receipt_id)
group by p.receipt_id;

update public.payments set bill_id = receipt_id
where bill_id is null and receipt_id is not null;

update public.order_items oi
set bill_id = p.receipt_id
from public.payments p
where p.order_id = oi.order_id and oi.bill_id is null and oi.voided_at is null
  and exists (select 1 from public.bills b where b.id = p.receipt_id);

-- One place for the discount, GST and rounding maths
create or replace function public.compute_bill(p_subtotal numeric, p_type text, p_value numeric)
returns table (discount_amount numeric, tax_rate numeric, tax_amount numeric, round_off numeric, total numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.app_settings%rowtype;
  v_disc numeric(10,2) := 0;
  v_tax numeric(10,2) := 0;
  v_raw numeric(10,2);
begin
  if p_type not in ('none', 'percent', 'flat') then raise exception 'Invalid discount type'; end if;
  if p_value is null or p_value < 0 then raise exception 'Invalid discount value'; end if;
  if p_type = 'percent' and p_value > 100 then raise exception 'Invalid discount value'; end if;

  select * into s from public.app_settings where id = 1;

  if p_type = 'percent' then v_disc := round(p_subtotal * p_value / 100, 2);
  elsif p_type = 'flat' then v_disc := round(p_value, 2);
  end if;
  if v_disc > p_subtotal then raise exception 'Discount cannot be more than the subtotal'; end if;

  if s.gst_enabled then v_tax := round((p_subtotal - v_disc) * s.gst_rate / 100, 2); end if;
  v_raw := (p_subtotal - v_disc) + v_tax;

  discount_amount := v_disc;
  tax_rate := case when s.gst_enabled then s.gst_rate else 0 end;
  tax_amount := v_tax;
  total := round(v_raw);
  round_off := round(v_raw) - v_raw;
  return next;
end;
$$;

-- Live preview for the cashier screen (same maths as the real bill)
create or replace function public.get_bill_preview(
  p_table_id uuid,
  p_order_id uuid default null,
  p_item_ids uuid[] default null,
  p_discount_type text default 'none',
  p_discount_value numeric default 0
)
returns table (subtotal numeric, discount_amount numeric, tax_rate numeric, tax_amount numeric, round_off numeric, total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active boolean;
  v_sub numeric(10,2);
begin
  select role, is_active into v_role, v_active from public.profiles where id = auth.uid();
  if v_role is null or not v_active or v_role not in ('owner', 'manager', 'cashier') then
    raise exception 'Not allowed';
  end if;
  if p_table_id is null and p_order_id is null then raise exception 'Table or order required'; end if;

  select coalesce(sum(oi.quantity * oi.unit_price), 0) into v_sub
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.status = 'served' and oi.voided_at is null and oi.bill_id is null
    and ((p_order_id is not null and o.id = p_order_id) or (p_order_id is null and o.table_id = p_table_id))
    and (p_item_ids is null or oi.id = any(p_item_ids));

  return query
  select v_sub, c.discount_amount, c.tax_rate, c.tax_amount, c.round_off, c.total
  from public.compute_bill(v_sub, p_discount_type, p_discount_value) c;
end;
$$;

-- Pay a table, one order (takeaway), or selected items. Supports split payment lines.
drop function if exists public.pay_table(uuid, text);

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
begin
  select role, is_active into v_role, v_active from public.profiles where id = auth.uid();
  if v_role is null or not v_active or v_role not in ('owner', 'manager', 'cashier') then
    raise exception 'Not allowed';
  end if;
  if p_table_id is null and p_order_id is null then raise exception 'Table or order required'; end if;
  if jsonb_typeof(coalesce(p_payments, '[]'::jsonb)) <> 'array' then raise exception 'Invalid payments'; end if;

  -- do not bill everything while something is still being cooked
  if p_item_ids is null and exists (
    select 1 from public.orders o
    where o.status in ('new', 'preparing', 'ready')
      and ((p_order_id is not null and o.id = p_order_id) or (p_order_id is null and o.table_id = p_table_id))
  ) then
    raise exception 'Some orders are still being prepared';
  end if;

  -- lock and measure the items being billed
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

  -- discount rules by role
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

  -- payment lines must add up to the total
  for v_line in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    if coalesce(v_line->>'mode', '') not in ('cash', 'upi', 'card') then raise exception 'Invalid payment mode'; end if;
    v_amt := (v_line->>'amount')::numeric;
    if v_amt is null or v_amt <= 0 then raise exception 'Invalid payment amount'; end if;
    v_paid := v_paid + v_amt;
  end loop;
  if abs(v_paid - c.total) > 0.009 then raise exception 'Payments must add up to the bill total'; end if;

  insert into public.bills (
    table_id, subtotal, discount_type, discount_value, discount_amount, discount_reason,
    tax_rate, tax_amount, round_off, total, created_by
  )
  values (
    p_table_id, v_sub, p_discount_type, p_discount_value, c.discount_amount, nullif(trim(p_discount_reason), ''),
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

-- Update get_today_dashboard_stats: add gst_collected_today, discounts_today, net_sales_today
-- and update today_profit = net_sales_today - today_expenses (GST is not income)
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
  v_result json;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role not in ('owner', 'manager') then
    raise exception 'Access denied. Owner or Manager role required.';
  end if;

  -- 1. Collected sales by payment mode
  select
    coalesce(sum(amount), 0),
    coalesce(sum(case when mode = 'cash' then amount else 0 end), 0),
    coalesce(sum(case when mode = 'upi' then amount else 0 end), 0),
    coalesce(sum(case when mode = 'card' then amount else 0 end), 0)
  into v_today_sales, v_cash_sales, v_upi_sales, v_card_sales
  from public.payments
  where (paid_at at time zone 'Asia/Kolkata')::date = p_date;

  -- 2. GST and Discounts from bills created on p_date
  select
    coalesce(sum(tax_amount), 0),
    coalesce(sum(discount_amount), 0)
  into v_gst_collected_today, v_discounts_today
  from public.bills
  where (created_at at time zone 'Asia/Kolkata')::date = p_date;

  -- 3. Net sales (excluding GST)
  v_net_sales_today := v_today_sales - v_gst_collected_today;

  -- 4. Expenses
  select coalesce(sum(amount), 0)
  into v_today_expenses
  from public.expenses
  where expense_date = p_date;

  -- 5. Orders Count (excluding cancelled)
  select count(*)
  into v_orders_count
  from public.orders
  where (created_at at time zone 'Asia/Kolkata')::date = p_date
    and status != 'cancelled';

  -- 6. Profit (net sales minus expenses, excluding GST)
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
    'mode_breakdown', json_build_object(
      'cash', v_cash_sales,
      'upi', v_upi_sales,
      'card', v_card_sales
    )
  ) into v_result;

  return v_result;
end;
$$;

-- Recreate get_bills to read from bills + payment lines + discount_amount
drop function if exists public.get_bills(date, date, text, int, int);

create or replace function public.get_bills(
  p_from date default null,
  p_to date default null,
  p_mode text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  receipt_id uuid,
  table_label text,
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
  select role, is_active into v_role, v_active from public.profiles where id = auth.uid();
  if v_role is null or not v_active or v_role not in ('owner', 'manager', 'cashier') then
    raise exception 'Not allowed';
  end if;
  if p_mode is not null and p_mode not in ('cash', 'upi', 'card') then
    raise exception 'Invalid payment mode';
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
      coalesce(ct.label, 'Table') as g_table,
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

-- Update get_top_items_today: count only billed, non-voided items for bills created today
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
  join public.bills b on b.id = oi.bill_id
  join public.menu_items mi on oi.menu_item_id = mi.id
  where (b.created_at at time zone 'Asia/Kolkata')::date = p_date
    and oi.bill_id is not null
    and oi.voided_at is null
  group by mi.id, mi.name
  order by total_quantity desc
  limit p_limit;
end;
$$;

-- Function permissions hardening
revoke execute on function public.compute_bill(numeric, text, numeric) from public, anon, authenticated;
revoke execute on function public.get_bill_preview(uuid, uuid, uuid[], text, numeric) from public, anon;
revoke execute on function public.pay_table(uuid, jsonb, uuid, uuid[], text, numeric, text) from public, anon;
revoke execute on function public.get_today_dashboard_stats(date) from public, anon;
revoke execute on function public.get_bills(date, date, text, int, int) from public, anon;
revoke execute on function public.get_top_items_today(date, int) from public, anon;

grant execute on function public.get_bill_preview(uuid, uuid, uuid[], text, numeric) to authenticated;
grant execute on function public.pay_table(uuid, jsonb, uuid, uuid[], text, numeric, text) to authenticated;
grant execute on function public.get_today_dashboard_stats(date) to authenticated;
grant execute on function public.get_bills(date, date, text, int, int) to authenticated;
grant execute on function public.get_top_items_today(date, int) to authenticated;
