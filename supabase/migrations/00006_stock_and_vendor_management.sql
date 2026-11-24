-- ==============================================================================
-- Migration 00006: Version 2 — Stock Management & Vendor Dues
-- ==============================================================================

-- 1. Vendors Directory
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  phone text,
  category text not null, -- 'Dairy & Milk', 'Coffee Roaster', 'Bakery', 'Vegetables & Produce', 'Packaging', 'Other'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Inventory / Raw Materials Items
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null, -- 'Dairy', 'Coffee', 'Bakery', 'Syrups', 'Produce', 'Packaging', 'Other'
  current_stock numeric(10, 2) not null default 0,
  unit text not null default 'kg', -- 'kg', 'L', 'packs', 'pcs', 'cans', 'boxes'
  min_threshold numeric(10, 2) not null default 5, -- Low stock alert threshold
  cost_per_unit numeric(10, 2) not null default 0,
  vendor_id uuid references public.vendors(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Vendor Invoices / Bills (Purchase Orders & Dues)
create table if not exists public.vendor_invoices (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  invoice_number text,
  invoice_date date not null default ((now() at time zone 'Asia/Kolkata')::date),
  total_amount numeric(10, 2) not null,
  paid_amount numeric(10, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'partial', 'paid')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 4. Vendor Payments (Payments made toward clearing invoice dues)
create table if not exists public.vendor_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.vendor_invoices(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  mode text not null default 'upi' check (mode in ('cash', 'upi', 'bank_transfer', 'cheque')),
  paid_at timestamptz not null default now(),
  notes text,
  created_by uuid references public.profiles(id) on delete set null
);

-- 5. Inventory Transaction Logs (Restock, Usage, Waste)
create table if not exists public.inventory_logs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  type text not null check (type in ('restock', 'usage', 'waste', 'adjustment')),
  quantity numeric(10, 2) not null,
  unit_cost numeric(10, 2),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 6. Indexes for Performance
create index if not exists idx_inventory_vendor on public.inventory_items(vendor_id);
create index if not exists idx_vendor_invoices_vendor on public.vendor_invoices(vendor_id);
create index if not exists idx_vendor_invoices_status on public.vendor_invoices(status);
create index if not exists idx_vendor_payments_invoice on public.vendor_payments(invoice_id);
create index if not exists idx_inventory_logs_item on public.inventory_logs(item_id);

-- 7. Row Level Security (RLS)
alter table public.vendors enable row level security;
alter table public.inventory_items enable row level security;
alter table public.vendor_invoices enable row level security;
alter table public.vendor_payments enable row level security;
alter table public.inventory_logs enable row level security;

-- Policies: Full access for Owner and Manager roles
drop policy if exists "Vendors manageable by owner and manager" on public.vendors;
create policy "Vendors manageable by owner and manager"
  on public.vendors for all
  to authenticated
  using (public.current_user_role() in ('owner', 'manager'));

drop policy if exists "Inventory manageable by owner and manager" on public.inventory_items;
create policy "Inventory manageable by owner and manager"
  on public.inventory_items for all
  to authenticated
  using (public.current_user_role() in ('owner', 'manager'));

drop policy if exists "Invoices manageable by owner and manager" on public.vendor_invoices;
create policy "Invoices manageable by owner and manager"
  on public.vendor_invoices for all
  to authenticated
  using (public.current_user_role() in ('owner', 'manager'));

drop policy if exists "Vendor payments manageable by owner and manager" on public.vendor_payments;
create policy "Vendor payments manageable by owner and manager"
  on public.vendor_payments for all
  to authenticated
  using (public.current_user_role() in ('owner', 'manager'));

drop policy if exists "Inventory logs manageable by owner and manager" on public.inventory_logs;
create policy "Inventory logs manageable by owner and manager"
  on public.inventory_logs for all
  to authenticated
  using (public.current_user_role() in ('owner', 'manager'));

-- 8. Restock Inventory RPC (Atomically updates stock level and logs transaction)
create or replace function public.restock_inventory_item(
  p_item_id uuid,
  p_quantity numeric,
  p_cost_per_unit numeric default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role not in ('owner', 'manager') then
    raise exception 'Access denied';
  end if;
  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than 0';
  end if;

  update public.inventory_items
  set current_stock = current_stock + p_quantity,
      cost_per_unit = coalesce(p_cost_per_unit, cost_per_unit),
      updated_at = now()
  where id = p_item_id;

  insert into public.inventory_logs (item_id, type, quantity, unit_cost, notes, created_by)
  values (p_item_id, 'restock', p_quantity, p_cost_per_unit, p_notes, auth.uid());
end;
$$;

-- 9. Settle Vendor Due / Record Payment RPC
create or replace function public.record_vendor_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_mode text default 'upi',
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_vendor_id uuid;
  v_total numeric;
  v_paid numeric;
  v_new_paid numeric;
  v_new_status text;
  v_vendor_name text;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role not in ('owner', 'manager') then
    raise exception 'Access denied';
  end if;
  if p_amount <= 0 then
    raise exception 'Payment amount must be greater than 0';
  end if;

  select vendor_id, total_amount, paid_amount
  into v_vendor_id, v_total, v_paid
  from public.vendor_invoices
  where id = p_invoice_id for update;

  if v_vendor_id is null then
    raise exception 'Invoice not found';
  end if;

  v_new_paid := v_paid + p_amount;
  if v_new_paid >= v_total then
    v_new_status := 'paid';
  else
    v_new_status := 'partial';
  end if;

  -- Update invoice paid amount and status
  update public.vendor_invoices
  set paid_amount = v_new_paid,
      status = v_new_status
  where id = p_invoice_id;

  -- Insert payment record
  insert into public.vendor_payments (invoice_id, vendor_id, amount, mode, notes, created_by)
  values (p_invoice_id, v_vendor_id, p_amount, p_mode, p_notes, auth.uid());

  -- Optional: Automatically log payment as daily expense under category 'Other' / vendor name
  select name into v_vendor_name from public.vendors where id = v_vendor_id;
  insert into public.expenses (expense_date, category, amount, note, created_by)
  values (
    (now() at time zone 'Asia/Kolkata')::date,
    'Other',
    p_amount,
    coalesce('Vendor Payment: ' || v_vendor_name || ' (' || coalesce(p_notes, '') || ')', 'Vendor Payment'),
    auth.uid()
  );
end;
$$;

-- 10. Add to Realtime Publication safely
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inventory_items'
  ) then
    alter publication supabase_realtime add table public.inventory_items;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vendor_invoices'
  ) then
    alter publication supabase_realtime add table public.vendor_invoices;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vendors'
  ) then
    alter publication supabase_realtime add table public.vendors;
  end if;
end $$;
