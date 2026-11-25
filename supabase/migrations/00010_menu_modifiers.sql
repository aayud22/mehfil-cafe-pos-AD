-- ==============================================================================
-- Migration 00010: Release 4 Feature 3 — Modifiers with Extra Charges
-- ==============================================================================

-- 1. Modifier Groups
create table if not exists public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  selection_type text not null default 'single' check (selection_type in ('single', 'multiple')),
  is_required boolean not null default false,
  max_select int null check (max_select is null or max_select >= 1)
);

-- 2. Modifier Options
create table if not exists public.modifier_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.modifier_groups(id) on delete cascade,
  name text not null,
  price_delta numeric(10,2) not null default 0 check (price_delta between 0 and 500),
  is_available boolean not null default true,
  sort_order int not null default 0
);
create index if not exists idx_modifier_options_group on public.modifier_options(group_id);

-- 3. Menu Item <-> Modifier Group mapping
create table if not exists public.menu_item_modifier_groups (
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  group_id uuid not null references public.modifier_groups(id) on delete cascade,
  sort_order int not null default 0,
  primary key (menu_item_id, group_id)
);

-- 4. Order Items snapshot column
alter table public.order_items
  add column if not exists modifiers jsonb not null default '[]'::jsonb;

-- 5. Row Level Security
alter table public.modifier_groups enable row level security;
alter table public.modifier_options enable row level security;
alter table public.menu_item_modifier_groups enable row level security;

drop policy if exists "Modifier groups readable by staff" on public.modifier_groups;
create policy "Modifier groups readable by staff"
  on public.modifier_groups for select to authenticated using (true);

drop policy if exists "Modifier groups editable by owner and manager" on public.modifier_groups;
create policy "Modifier groups editable by owner and manager"
  on public.modifier_groups for all to authenticated
  using (public.current_user_role() in ('owner', 'manager'))
  with check (public.current_user_role() in ('owner', 'manager'));

drop policy if exists "Modifier options readable by staff" on public.modifier_options;
create policy "Modifier options readable by staff"
  on public.modifier_options for select to authenticated using (true);

drop policy if exists "Modifier options editable by owner and manager" on public.modifier_options;
create policy "Modifier options editable by owner and manager"
  on public.modifier_options for all to authenticated
  using (public.current_user_role() in ('owner', 'manager'))
  with check (public.current_user_role() in ('owner', 'manager'));

drop policy if exists "Menu item modifier groups readable by staff" on public.menu_item_modifier_groups;
create policy "Menu item modifier groups readable by staff"
  on public.menu_item_modifier_groups for select to authenticated using (true);

drop policy if exists "Menu item modifier groups editable by owner and manager" on public.menu_item_modifier_groups;
create policy "Menu item modifier groups editable by owner and manager"
  on public.menu_item_modifier_groups for all to authenticated
  using (public.current_user_role() in ('owner', 'manager'))
  with check (public.current_user_role() in ('owner', 'manager'));

-- 6. Extend create_order to validate modifier_option_ids and compute unit_price + snapshot
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
  v_base_price numeric(10,2);
  v_avail boolean;
  v_opt_ids uuid[];
  v_raw_opt jsonb;
  v_opt_id uuid;
  v_deltas numeric(10,2);
  v_modifiers_json jsonb;
  v_group_rec record;
  v_selected_in_group int;
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

    select price, is_available into v_base_price, v_avail
    from public.menu_items
    where id = v_menu_id;

    if v_base_price is null then
      raise exception 'Menu item not found';
    end if;
    if not v_avail then
      raise exception 'One or more selected items are currently unavailable';
    end if;

    -- Parse modifier_option_ids array
    v_opt_ids := '{}'::uuid[];
    if jsonb_typeof(v_item->'modifier_option_ids') = 'array' then
      for v_raw_opt in select * from jsonb_array_elements(v_item->'modifier_option_ids') loop
        v_opt_id := (v_raw_opt #>> '{}')::uuid;
        if v_opt_id = any(v_opt_ids) then
          raise exception 'Duplicate modifier option selected';
        end if;
        v_opt_ids := array_append(v_opt_ids, v_opt_id);
      end loop;
    end if;

    -- Verify every chosen option exists, is available, and belongs to a group attached to this menu item
    if cardinality(v_opt_ids) > 0 then
      if (
        select count(*)
        from public.modifier_options mo
        join public.menu_item_modifier_groups mimg on mimg.group_id = mo.group_id
        where mo.id = any(v_opt_ids)
          and mo.is_available = true
          and mimg.menu_item_id = v_menu_id
      ) <> cardinality(v_opt_ids) then
        raise exception 'Invalid or unavailable modifier option for this item';
      end if;
    end if;

    -- Validate group constraints (is_required, selection_type, max_select)
    for v_group_rec in
      select mg.id, mg.name, mg.selection_type, mg.is_required, mg.max_select
      from public.modifier_groups mg
      join public.menu_item_modifier_groups mimg on mimg.group_id = mg.id
      where mimg.menu_item_id = v_menu_id
    loop
      select count(*) into v_selected_in_group
      from public.modifier_options mo
      where mo.group_id = v_group_rec.id
        and mo.id = any(v_opt_ids);

      if v_group_rec.selection_type = 'single' and v_selected_in_group > 1 then
        raise exception 'Only one option can be selected for %', v_group_rec.name;
      end if;

      if v_group_rec.is_required then
        if v_group_rec.selection_type = 'single' and v_selected_in_group <> 1 then
          raise exception 'Please select an option for %', v_group_rec.name;
        elsif v_group_rec.selection_type = 'multiple' and v_selected_in_group < 1 then
          raise exception 'Please select at least one option for %', v_group_rec.name;
        end if;
      end if;

      if v_group_rec.max_select is not null and v_selected_in_group > v_group_rec.max_select then
        raise exception 'Too many options selected for %', v_group_rec.name;
      end if;
    end loop;

    -- Compute price delta and build JSON snapshot strictly from database
    select
      coalesce(sum(mo.price_delta), 0),
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'group', mg.name,
            'option', mo.name,
            'price_delta', mo.price_delta
          )
          order by mimg.sort_order, mo.sort_order, mo.name
        ),
        '[]'::jsonb
      )
    into v_deltas, v_modifiers_json
    from public.modifier_options mo
    join public.modifier_groups mg on mg.id = mo.group_id
    join public.menu_item_modifier_groups mimg on mimg.group_id = mg.id and mimg.menu_item_id = v_menu_id
    where mo.id = any(v_opt_ids);

    insert into public.order_items (order_id, menu_item_id, quantity, unit_price, note, modifiers)
    values (
      v_order_id,
      v_menu_id,
      v_qty,
      v_base_price + coalesce(v_deltas, 0),
      nullif(trim(coalesce(v_item->>'note', '')), ''),
      coalesce(v_modifiers_json, '[]'::jsonb)
    );
  end loop;

  if p_order_type = 'dine_in' and p_table_id is not null then
    update public.cafe_tables set status = 'occupied' where id = p_table_id;
  end if;

  return v_order_id;
end;
$$;

revoke execute on function public.create_order(uuid, text, jsonb, text, text) from public, anon;
grant execute on function public.create_order(uuid, text, jsonb, text, text) to authenticated;

-- 7. Seed Default Coffee Modifiers (Valid Hex UUIDs)
insert into public.modifier_groups (id, name, selection_type, is_required, max_select) values
  ('aa111111-1111-1111-1111-111111111111', 'Size', 'single', true, 1),
  ('aa111111-1111-1111-1111-111111111112', 'Milk', 'single', false, 1),
  ('aa111111-1111-1111-1111-111111111113', 'Extra shot', 'multiple', false, 3),
  ('aa111111-1111-1111-1111-111111111114', 'Sugar', 'single', false, 1)
on conflict (id) do nothing;

insert into public.modifier_options (id, group_id, name, price_delta, is_available, sort_order) values
  ('bb111111-1111-1111-1111-111111111101', 'aa111111-1111-1111-1111-111111111111', 'Regular', 0, true, 1),
  ('bb111111-1111-1111-1111-111111111102', 'aa111111-1111-1111-1111-111111111111', 'Large', 40, true, 2),

  ('bb111111-1111-1111-1111-111111111201', 'aa111111-1111-1111-1111-111111111112', 'Regular', 0, true, 1),
  ('bb111111-1111-1111-1111-111111111202', 'aa111111-1111-1111-1111-111111111112', 'Almond', 50, true, 2),
  ('bb111111-1111-1111-1111-111111111203', 'aa111111-1111-1111-1111-111111111112', 'Oat', 50, true, 3),

  ('bb111111-1111-1111-1111-111111111301', 'aa111111-1111-1111-1111-111111111113', 'Extra Espresso Shot', 40, true, 1),

  ('bb111111-1111-1111-1111-111111111401', 'aa111111-1111-1111-1111-111111111114', 'No sugar', 0, true, 1),
  ('bb111111-1111-1111-1111-111111111402', 'aa111111-1111-1111-1111-111111111114', 'Less', 0, true, 2),
  ('bb111111-1111-1111-1111-111111111403', 'aa111111-1111-1111-1111-111111111114', 'Regular', 0, true, 3)
on conflict (id) do nothing;

-- Attach Size, Milk, Extra shot, Sugar to all items in Hot Coffee & Cold Coffee & Shakes categories
insert into public.menu_item_modifier_groups (menu_item_id, group_id, sort_order)
select mi.id, g.id, g.sort_order
from public.menu_items mi
join public.menu_categories mc on mc.id = mi.category_id
cross join (
  values
    ('aa111111-1111-1111-1111-111111111111'::uuid, 1),
    ('aa111111-1111-1111-1111-111111111112'::uuid, 2),
    ('aa111111-1111-1111-1111-111111111113'::uuid, 3),
    ('aa111111-1111-1111-1111-111111111114'::uuid, 4)
) as g(id, sort_order)
where mc.name in ('Hot Coffee', 'Cold Coffee & Shakes')
on conflict (menu_item_id, group_id) do nothing;
