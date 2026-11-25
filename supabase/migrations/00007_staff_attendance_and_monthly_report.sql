-- ==============================================================================
-- Migration 00007: Version 3 — Staff Attendance, Shifts, Salary & Monthly Report
-- ==============================================================================

-- 1. Staff Members Directory
create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  role_title text not null, -- e.g. 'Barista', 'Head Chef', 'Floor Waiter', 'Cashier', 'Helper'
  phone text,
  monthly_salary numeric(10, 2) not null default 0,
  shift_type text not null default 'full_day' check (shift_type in ('morning', 'evening', 'full_day')),
  joined_date date not null default ((now() at time zone 'Asia/Kolkata')::date),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Daily Staff Attendance & Shifts
create table if not exists public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  attendance_date date not null default ((now() at time zone 'Asia/Kolkata')::date),
  status text not null check (status in ('present', 'half_day', 'absent', 'leave')),
  shift text not null default 'full_day' check (shift in ('morning', 'evening', 'full_day')),
  clock_in timestamptz,
  clock_out timestamptz,
  notes text,
  marked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (staff_id, attendance_date)
);

-- 3. Staff Salary & Advance Payments
create table if not exists public.staff_salary_payments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  payment_month text not null, -- Format: 'YYYY-MM'
  amount numeric(10, 2) not null check (amount > 0),
  payment_type text not null default 'salary' check (payment_type in ('salary', 'advance', 'bonus')),
  mode text not null default 'bank_transfer' check (mode in ('cash', 'upi', 'bank_transfer')),
  paid_at timestamptz not null default now(),
  notes text,
  created_by uuid references public.profiles(id) on delete set null
);

-- 4. Indexes
create index if not exists idx_staff_attendance_date on public.staff_attendance(attendance_date);
create index if not exists idx_staff_attendance_staff on public.staff_attendance(staff_id);
create index if not exists idx_staff_salary_month on public.staff_salary_payments(payment_month);
create index if not exists idx_staff_salary_staff on public.staff_salary_payments(staff_id);

-- 5. Row Level Security (RLS)
alter table public.staff_members enable row level security;
alter table public.staff_attendance enable row level security;
alter table public.staff_salary_payments enable row level security;

drop policy if exists "Staff manageable by owner and manager" on public.staff_members;
create policy "Staff manageable by owner and manager"
  on public.staff_members for all
  to authenticated
  using (public.current_user_role() in ('owner', 'manager'));

drop policy if exists "Attendance manageable by owner and manager" on public.staff_attendance;
create policy "Attendance manageable by owner and manager"
  on public.staff_attendance for all
  to authenticated
  using (public.current_user_role() in ('owner', 'manager'));

drop policy if exists "Salary payments manageable by owner and manager" on public.staff_salary_payments;
create policy "Salary payments manageable by owner and manager"
  on public.staff_salary_payments for all
  to authenticated
  using (public.current_user_role() in ('owner', 'manager'));

-- 6. Record Staff Salary / Advance Payment RPC
--    Inserts payment record and logs a corresponding 'Salary' expense
create or replace function public.record_staff_salary_payment(
  p_staff_id uuid,
  p_month text,
  p_amount numeric,
  p_type text default 'salary',
  p_mode text default 'bank_transfer',
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_staff_name text;
  v_payment_id uuid;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role not in ('owner', 'manager') then
    raise exception 'Access denied. Owner or Manager role required.';
  end if;

  if p_amount <= 0 then
    raise exception 'Payment amount must be greater than 0';
  end if;

  if p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Invalid month format. Expected YYYY-MM';
  end if;

  select full_name into v_staff_name from public.staff_members where id = p_staff_id;
  if v_staff_name is null then
    raise exception 'Staff member not found';
  end if;

  insert into public.staff_salary_payments (
    staff_id, payment_month, amount, payment_type, mode, notes, created_by
  ) values (
    p_staff_id, p_month, p_amount, p_type, p_mode, p_notes, auth.uid()
  ) returning id into v_payment_id;

  -- Record in daily expenses under 'Salary' category for unified P&L
  insert into public.expenses (expense_date, category, amount, note, created_by)
  values (
    (now() at time zone 'Asia/Kolkata')::date,
    'Salary',
    p_amount,
    initcap(p_type) || ': ' || v_staff_name || ' (' || p_month || ')' ||
      case when coalesce(trim(p_notes), '') <> '' then ' - ' || trim(p_notes) else '' end,
    auth.uid()
  );

  return v_payment_id;
end;
$$;

-- 7. Monthly Business P&L & Operational Report RPC
create or replace function public.get_monthly_business_report(
  p_month text default to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM')
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_start_date date;
  v_end_date date;
  v_total_sales numeric(12,2) := 0;
  v_cash_sales numeric(12,2) := 0;
  v_upi_sales numeric(12,2) := 0;
  v_card_sales numeric(12,2) := 0;
  v_orders_count int := 0;
  v_cancelled_count int := 0;
  v_operating_expenses numeric(12,2) := 0;
  v_salary_expenses numeric(12,2) := 0;
  v_total_expenses numeric(12,2) := 0;
  v_vendor_dues_pending numeric(12,2) := 0;
  v_daily_breakdown json;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role not in ('owner', 'manager') then
    raise exception 'Access denied. Owner or Manager role required.';
  end if;

  if p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Invalid month format. Expected YYYY-MM';
  end if;

  v_start_date := to_date(p_month || '-01', 'YYYY-MM-DD');
  v_end_date := (v_start_date + interval '1 month - 1 day')::date;

  -- 1. Sales breakdown
  select
    coalesce(sum(amount), 0),
    coalesce(sum(case when mode = 'cash' then amount else 0 end), 0),
    coalesce(sum(case when mode = 'upi' then amount else 0 end), 0),
    coalesce(sum(case when mode = 'card' then amount else 0 end), 0)
  into v_total_sales, v_cash_sales, v_upi_sales, v_card_sales
  from public.payments
  where (paid_at at time zone 'Asia/Kolkata')::date between v_start_date and v_end_date;

  -- 2. Orders counts
  select
    count(*) filter (where status <> 'cancelled'),
    count(*) filter (where status = 'cancelled')
  into v_orders_count, v_cancelled_count
  from public.orders
  where (created_at at time zone 'Asia/Kolkata')::date between v_start_date and v_end_date;

  -- 3. Expenses breakdown (Operating vs Salary)
  select
    coalesce(sum(case when category <> 'Salary' then amount else 0 end), 0),
    coalesce(sum(case when category = 'Salary' then amount else 0 end), 0),
    coalesce(sum(amount), 0)
  into v_operating_expenses, v_salary_expenses, v_total_expenses
  from public.expenses
  where expense_date between v_start_date and v_end_date;

  -- 4. Current Pending Vendor Dues (all unpaid/partial invoices)
  select coalesce(sum(greatest(0, total_amount - paid_amount)), 0)
  into v_vendor_dues_pending
  from public.vendor_invoices
  where status <> 'paid';

  -- 5. Daily Breakdown for Chart
  select coalesce(json_agg(day_row order by day_row.date), '[]'::json)
  into v_daily_breakdown
  from (
    select
      d::date as date,
      to_char(d, 'DD Mon') as label,
      extract(day from d)::int as day,
      coalesce((
        select sum(p.amount)
        from public.payments p
        where (p.paid_at at time zone 'Asia/Kolkata')::date = d::date
      ), 0) as sales,
      coalesce((
        select sum(e.amount)
        from public.expenses e
        where e.expense_date = d::date
      ), 0) as expenses
    from generate_series(v_start_date, v_end_date, interval '1 day') as d
  ) as day_row;

  return json_build_object(
    'month', p_month,
    'start_date', v_start_date,
    'end_date', v_end_date,
    'total_sales', v_total_sales,
    'cash_sales', v_cash_sales,
    'upi_sales', v_upi_sales,
    'card_sales', v_card_sales,
    'orders_count', v_orders_count,
    'cancelled_count', v_cancelled_count,
    'operating_expenses', v_operating_expenses,
    'salary_expenses', v_salary_expenses,
    'total_expenses', v_total_expenses,
    'net_profit', (v_total_sales - v_total_expenses),
    'vendor_dues_pending', v_vendor_dues_pending,
    'daily_breakdown', v_daily_breakdown
  );
end;
$$;

-- 8. Add to Realtime Publication safely
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'staff_members'
  ) then
    alter publication supabase_realtime add table public.staff_members;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'staff_attendance'
  ) then
    alter publication supabase_realtime add table public.staff_attendance;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'staff_salary_payments'
  ) then
    alter publication supabase_realtime add table public.staff_salary_payments;
  end if;
end $$;
