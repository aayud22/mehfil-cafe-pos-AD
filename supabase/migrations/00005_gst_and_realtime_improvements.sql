-- ==============================================================================
-- Migration 00005: 5% GST (2.5% CGST + 2.5% SGST) Calculation in pay_table
-- ==============================================================================

create or replace function public.pay_table(p_table_id uuid, p_mode text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active boolean;
  v_receipt uuid := gen_random_uuid();
  v_found boolean := false;
  v_subtotal numeric;
  v_amount numeric;
  r record;
begin
  select role, is_active into v_role, v_active from profiles where id = auth.uid();
  if v_role is null or not v_active or v_role not in ('owner', 'manager', 'cashier') then
    raise exception 'Not allowed';
  end if;

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

    select coalesce(sum(quantity * unit_price), 0) into v_subtotal
    from order_items where order_id = r.id and voided_at is null;

    -- Add 5% GST (2.5% CGST + 2.5% SGST) rounded to nearest rupee
    v_amount := round(v_subtotal * 1.05);

    insert into payments (order_id, mode, amount, received_by, receipt_id)
    values (r.id, p_mode, v_amount, auth.uid(), v_receipt);

    update orders set status = 'billed' where id = r.id;
  end loop;

  if not v_found then raise exception 'Nothing to bill for this table'; end if;

  update cafe_tables set status = 'free' where id = p_table_id;
  return v_receipt;
end;
$$;
