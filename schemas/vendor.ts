import { z } from 'zod';

export const VENDOR_CATEGORIES = [
  'Dairy & Milk Supplier',
  'Coffee Bean Roaster',
  'Bakery Supplier',
  'Produce & Vegetables',
  'FMCG & Groceries',
  'Packaging & Disposables',
  'Equipment & Maintenance',
  'Other',
] as const;

export const vendorSchema = z.object({
  name: z.string().trim().min(2, 'Vendor name must be at least 2 characters').max(80),
  contact_person: z.string().max(60).optional().nullable().or(z.literal('')),
  phone: z.string().max(20).optional().nullable().or(z.literal('')),
  category: z.string().min(1, 'Vendor category is required'),
});

export type VendorInput = z.infer<typeof vendorSchema>;

export const vendorInvoiceSchema = z.object({
  vendor_id: z.string().uuid('Select a valid vendor'),
  invoice_number: z.string().max(50).optional().nullable().or(z.literal('')),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date required (YYYY-MM-DD)'),
  total_amount: z.coerce.number().positive('Invoice total must be greater than 0'),
  paid_amount: z.coerce.number().min(0, 'Paid amount cannot be negative').default(0),
  notes: z.string().max(200).optional().nullable().or(z.literal('')),
});

export type VendorInvoiceInput = z.infer<typeof vendorInvoiceSchema>;

export const vendorPaymentSchema = z.object({
  invoice_id: z.string().uuid('Invalid invoice ID'),
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  mode: z.enum(['cash', 'upi', 'bank_transfer', 'cheque']).default('upi'),
  notes: z.string().max(200).optional().nullable().or(z.literal('')),
});

export type VendorPaymentInput = z.infer<typeof vendorPaymentSchema>;
