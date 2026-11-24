-- Give old payments a receipt id so they can be opened too
update public.payments set receipt_id = gen_random_uuid() where receipt_id is null;

-- Paged list of bills (one row per receipt)
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

  v_from := coalesce(p_from, v_today);
  v_to := coalesce(p_to, v_today);
  if v_to < v_from then raise exception 'Invalid date range'; end if;

  -- a cashier can only see today's bills
  if v_role = 'cashier' then
    v_from := v_today;
    v_to := v_today;
  end if;

  p_limit := least(greatest(p_limit, 1), 100);
  p_offset := greatest(p_offset, 0);

  return query
  with grouped as (
    select
      p.receipt_id as g_receipt,
      min(ct.label) as g_table,
      max(p.paid_at) as g_paid,
      min(p.mode) as g_mode,
      sum(p.amount) as g_total,
      count(*)::int as g_orders,
      min(pr.full_name) as g_cashier
    from payments p
    join orders o on o.id = p.order_id
    join cafe_tables ct on ct.id = o.table_id
    left join profiles pr on pr.id = p.received_by
    where (p.paid_at at time zone 'Asia/Kolkata')::date between v_from and v_to
      and (p_mode is null or p.mode = p_mode)
    group by p.receipt_id
  )
  select
    g.g_receipt, g.g_table, g.g_paid, g.g_mode, g.g_total, g.g_orders, g.g_cashier,
    count(*) over (),
    sum(g.g_total) over ()
  from grouped g
  order by g.g_paid desc
  limit p_limit offset p_offset;
end;
$$;

-- Paged list of cancelled orders (owner and manager only)
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
    ct.label,
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
  join cafe_tables ct on ct.id = o.table_id
  left join profiles pr on pr.id = o.cancelled_by
  where o.status = 'cancelled'
    and (o.cancelled_at at time zone 'Asia/Kolkata')::date between v_from and v_to
  order by o.cancelled_at desc
  limit p_limit offset p_offset;
end;
$$;
