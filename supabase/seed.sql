-- ==============================================================================
-- Mehfil Cafe Management System - Seed Data
-- ==============================================================================

-- 1. Insert Menu Categories
INSERT INTO public.menu_categories (id, name, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Hot Coffee', 1),
  ('22222222-2222-2222-2222-222222222222', 'Cold Coffee & Shakes', 2),
  ('33333333-3333-3333-3333-333333333333', 'Chai & Teas', 3),
  ('44444444-4444-4444-4444-444444444444', 'Sandwiches & Snacks', 4),
  ('55555555-5555-5555-5555-555555555555', 'Bakery & Desserts', 5)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Menu Items (All rows contain exactly 5 columns matching schema)
INSERT INTO public.menu_items (id, category_id, name, price, is_available) VALUES
  -- Hot Coffee (Category: 11111111-1111-1111-1111-111111111111)
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Espresso Double Shot', 120.00, true),
  ('a1111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'Cappuccino', 160.00, true),
  ('a1111111-1111-1111-1111-111111111113', '11111111-1111-1111-1111-111111111111', 'Cafe Latte', 170.00, true),
  ('a1111111-1111-1111-1111-111111111114', '11111111-1111-1111-1111-111111111111', 'Mocha Supreme', 190.00, true),
  ('a1111111-1111-1111-1111-111111111115', '11111111-1111-1111-1111-111111111111', 'Flat White', 180.00, true),

  -- Cold Coffee & Shakes (Category: 22222222-2222-2222-2222-222222222222)
  ('b1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Classic Iced Americano', 150.00, true),
  ('b1111111-1111-1111-1111-111111111112', '22222222-2222-2222-2222-222222222222', 'Hazelnut Cold Coffee', 210.00, true),
  ('b1111111-1111-1111-1111-111111111113', '22222222-2222-2222-2222-222222222222', 'Vietnamese Iced Brew', 220.00, true),
  ('b1111111-1111-1111-1111-111111111114', '22222222-2222-2222-2222-222222222222', 'Belgian Chocolate Shake', 240.00, true),

  -- Chai & Teas (Category: 33333333-3333-3333-3333-333333333333)
  ('c1111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Masala Adrak Chai', 80.00, true),
  ('c1111111-1111-1111-1111-111111111112', '33333333-3333-3333-3333-333333333333', 'Kashmiri Kahwa', 120.00, true),
  ('c1111111-1111-1111-1111-111111111113', '33333333-3333-3333-3333-333333333333', 'Matcha Green Tea Latte', 190.00, true),

  -- Sandwiches & Snacks (Category: 44444444-4444-4444-4444-444444444444)
  ('d1111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'Paneer Tikka Grilled Sandwich', 210.00, true),
  ('d1111111-1111-1111-1111-111111111112', '44444444-4444-4444-4444-444444444444', 'Smoked Chicken & Pesto Panini', 260.00, true),
  ('d1111111-1111-1111-1111-111111111113', '44444444-4444-4444-4444-444444444444', 'Peri-Peri Crinkle Fries', 140.00, true),
  ('d1111111-1111-1111-1111-111111111114', '44444444-4444-4444-4444-444444444444', 'Cheese & Jalapeno Poppers', 180.00, true),

  -- Bakery & Desserts (Category: 55555555-5555-5555-5555-555555555555)
  ('e1111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'Butter Croissant', 130.00, true),
  ('e1111111-1111-1111-1111-111111111112', '55555555-5555-5555-5555-555555555555', 'Walnut Brownie with Fudge', 160.00, true),
  ('e1111111-1111-1111-1111-111111111113', '55555555-5555-5555-5555-555555555555', 'New York Baked Cheesecake', 250.00, true)
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Cafe Tables (Valid hex UUIDs)
INSERT INTO public.cafe_tables (id, label, seats, status) VALUES
  ('cafe0000-0000-0000-0000-000000000001', 'T1', 2, 'free'),
  ('cafe0000-0000-0000-0000-000000000002', 'T2', 2, 'free'),
  ('cafe0000-0000-0000-0000-000000000003', 'T3', 4, 'free'),
  ('cafe0000-0000-0000-0000-000000000004', 'T4', 4, 'free'),
  ('cafe0000-0000-0000-0000-000000000005', 'T5', 6, 'free'),
  ('cafe0000-0000-0000-0000-000000000006', 'T6', 6, 'free'),
  ('cafe0000-0000-0000-0000-000000000007', 'T7', 2, 'free'),
  ('cafe0000-0000-0000-0000-000000000008', 'T8', 8, 'free')
ON CONFLICT (label) DO NOTHING;

-- 4. Sample Expenses for Today
INSERT INTO public.expenses (expense_date, category, amount, note) VALUES
  (CURRENT_DATE, 'Dairy & Milk Supply', 1450.00, 'Fresh full cream milk 20L'),
  (CURRENT_DATE, 'Coffee Beans', 2800.00, 'Arabica Medium Dark Roast 2kg'),
  (CURRENT_DATE, 'Bakery Supply', 950.00, 'Sourdough and burger buns'),
  (CURRENT_DATE, 'Cleaning Supplies', 320.00, 'Dishwash & surface sanitizer');
