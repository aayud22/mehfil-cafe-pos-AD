import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const orderItemSchema = z.object({
  menu_item_id: z.string().uuid(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unit_price: z.number().min(0),
  note: z.string().optional(),
});

export const createOrderSchema = z.object({
  table_id: z.string().uuid('Please select a table'),
  note: z.string().optional(),
  items: z.array(orderItemSchema).min(1, 'Order must contain at least one item'),
});

export const paymentSchema = z.object({
  order_id: z.string().uuid(),
  mode: z.enum(['cash', 'upi', 'card']),
  amount: z.number().min(0),
});

export const expenseSchema = z.object({
  expense_date: z.string().min(1, 'Expense date is required'),
  category: z.string().min(2, 'Category name is required'),
  amount: z.number().min(1, 'Amount must be greater than zero'),
  note: z.string().optional(),
});

export const menuItemSchema = z.object({
  category_id: z.string().uuid('Category is required'),
  name: z.string().min(2, 'Item name is required'),
  price: z.number().min(0, 'Price must be positive'),
  is_available: z.boolean().default(true),
});
