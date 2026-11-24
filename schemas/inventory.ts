import { z } from 'zod';

export const INVENTORY_CATEGORIES = [
  'Dairy & Milk',
  'Coffee Beans',
  'Bakery & Breads',
  'Syrups & Flavors',
  'Tea & Chai',
  'Vegetables & Produce',
  'Snacks & Dry Goods',
  'Packaging & Disposables',
  'Cleaning & Sanitation',
  'Other',
] as const;

export const INVENTORY_UNITS = [
  'kg',
  'L',
  'packs',
  'pcs',
  'cans',
  'boxes',
  'bottles',
] as const;

export const inventoryItemSchema = z.object({
  name: z.string().trim().min(2, 'Item name must be at least 2 characters').max(80),
  category: z.string().min(1, 'Category is required'),
  current_stock: z.coerce.number().min(0, 'Current stock cannot be negative'),
  unit: z.string().min(1, 'Unit is required'),
  min_threshold: z.coerce.number().min(0, 'Alert threshold cannot be negative').default(5),
  cost_per_unit: z.coerce.number().min(0, 'Cost per unit cannot be negative').default(0),
  vendor_id: z.string().uuid().optional().nullable().or(z.literal('')),
});

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;

export const restockSchema = z.object({
  item_id: z.string().uuid('Invalid item ID'),
  quantity: z.coerce.number().positive('Restock quantity must be greater than 0'),
  cost_per_unit: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().max(200).optional().nullable(),
});

export type RestockInput = z.infer<typeof restockSchema>;
