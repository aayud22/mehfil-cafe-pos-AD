import { z } from "zod";

export const paymentSchema = z.object({
  order_id: z.string().uuid("Valid order ID is required"),
  mode: z.enum(["cash", "upi", "card"], {
    required_error: "Please select a payment mode (Cash, UPI, or Card)",
  }),
  amount: z.coerce.number().positive("Amount payable must be positive"),
});

export const paymentLineSchema = z.object({
  mode: z.enum(["cash", "upi", "card"]),
  amount: z.coerce
    .number()
    .positive("Amount must be greater than 0")
    .refine(
      (val) => Math.abs(Math.round(val * 100) - val * 100) < 1e-6,
      "Amount can have at most 2 decimal places"
    ),
});

export const DISCOUNT_REASONS = [
  "Regular customer",
  "Staff meal",
  "Complaint",
  "Owner approved",
  "Other",
] as const;

export const payTableSchema = z
  .object({
    table_id: z.string().uuid("Valid table ID is required").nullable().optional(),
    order_id: z.string().uuid("Valid order ID is required").nullable().optional(),
    split_mode: z.boolean().optional().default(false),
    item_ids: z.array(z.string().uuid("Each item ID must be a valid UUID")).nullable().optional(),
    payments: z.array(paymentLineSchema).min(1, "At least one payment line is required"),
    discount_type: z.enum(["none", "percent", "flat"]).default("none"),
    discount_value: z.coerce.number().min(0, "Discount cannot be negative").default(0),
    discount_reason: z.string().max(120, "Reason must be 120 characters or less").nullable().optional(),
  })
  .refine((data) => Boolean(data.table_id || data.order_id), {
    message: "Table or order is required",
    path: ["table_id"],
  })
  .refine(
    (data) => !data.split_mode || (Array.isArray(data.item_ids) && data.item_ids.length > 0),
    {
      message: "Select at least one item when split bill is enabled",
      path: ["item_ids"],
    }
  )
  .refine(
    (data) =>
      data.discount_type === "none" ||
      (data.discount_reason && data.discount_reason.trim().length > 0),
    {
      message: "A reason is required when applying a discount",
      path: ["discount_reason"],
    }
  );

export type PaymentInput = z.infer<typeof paymentSchema>;
export type PaymentLineInput = z.infer<typeof paymentLineSchema>;
export type PayTableInput = z.input<typeof payTableSchema>;
