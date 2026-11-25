import { z } from 'zod';

export const appSettingsSchema = z.object({
  cafe_name: z
    .string()
    .trim()
    .min(1, 'Cafe name is required')
    .max(60, 'Cafe name must be 60 characters or less'),
  cafe_address: z
    .string()
    .trim()
    .max(200, 'Address must be 200 characters or less')
    .optional()
    .nullable()
    .or(z.literal('')),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine(
      (val) => val === '' || /^[0-9A-Z]{15}$/.test(val),
      'GSTIN must be exactly 15 alphanumeric characters (A-Z, 0-9)'
    )
    .optional()
    .nullable()
    .or(z.literal('')),
  gst_enabled: z.boolean().default(true),
  gst_rate: z.coerce
    .number()
    .min(0, 'GST rate must be between 0 and 28')
    .max(28, 'GST rate must be between 0 and 28'),
  cashier_max_discount_percent: z.coerce
    .number()
    .min(0, 'Must be between 0 and 100')
    .max(100, 'Must be between 0 and 100'),
  manager_max_discount_percent: z.coerce
    .number()
    .min(0, 'Must be between 0 and 100')
    .max(100, 'Must be between 0 and 100'),
});

export type AppSettingsInput = z.infer<typeof appSettingsSchema>;
