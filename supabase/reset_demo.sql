-- ==============================================================================
-- Mehfil Cafe POS — Complete Demo Reset Script
-- Run this in Supabase SQL Editor anytime to wipe demo transactional data
-- and restore a clean cafe floor setup.
-- ==============================================================================

-- 1. Reset Table Status to Free
UPDATE public.cafe_tables
SET status = 'free';

-- 2. Clean Up Transactional Activity (Orders, Items, Payments)
DELETE FROM public.payments;
DELETE FROM public.order_items;
DELETE FROM public.orders;

-- 3. Reset Daily Expenses to Fresh Sample Baseline
DELETE FROM public.expenses;
INSERT INTO public.expenses (expense_date, category, amount, note) VALUES
  ((now() AT TIME ZONE 'Asia/Kolkata')::date, 'Dairy & Milk Supply', 1450.00, 'Fresh full cream milk 20L'),
  ((now() AT TIME ZONE 'Asia/Kolkata')::date, 'Coffee Beans', 2800.00, 'Arabica Medium Dark Roast 2kg'),
  ((now() AT TIME ZONE 'Asia/Kolkata')::date, 'Bakery Supply', 950.00, 'Sourdough and burger buns'),
  ((now() AT TIME ZONE 'Asia/Kolkata')::date, 'Cleaning Supplies', 320.00, 'Dishwash & surface sanitizer');

-- 4. Ensure All Menu Items Are Available
UPDATE public.menu_items
SET is_available = true;

-- 5. Ensure Demo Profiles Have Correct Roles and Are Active
UPDATE public.profiles
SET role = 'owner', is_active = true, full_name = 'Ayushi Diyora (Owner)'
WHERE id IN (SELECT id FROM auth.users WHERE email = 'owner@mehfilcafe.demo');

UPDATE public.profiles
SET role = 'kitchen', is_active = true, full_name = 'Head Chef'
WHERE id IN (SELECT id FROM auth.users WHERE email = 'kitchen@mehfilcafe.demo');

UPDATE public.profiles
SET role = 'cashier', is_active = true, full_name = 'Front Cashier'
WHERE id IN (SELECT id FROM auth.users WHERE email = 'cashier@mehfilcafe.demo');

UPDATE public.profiles
SET role = 'waiter', is_active = true, full_name = 'Floor Waiter'
WHERE id IN (SELECT id FROM auth.users WHERE email = 'waiter@mehfilcafe.demo');
