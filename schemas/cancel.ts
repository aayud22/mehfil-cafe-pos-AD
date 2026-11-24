import { z } from "zod";

export const cancelOrderSchema = z.object({
  order_id: z.string().uuid("Invalid order ID"),
  reason: z
    .string()
    .trim()
    .min(3, "Reason must be at least 3 characters")
    .max(120, "Reason must not exceed 120 characters"),
});

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

export const voidItemSchema = z.object({
  item_id: z.string().uuid("Invalid item ID"),
  reason: z
    .string()
    .trim()
    .min(3, "Reason must be at least 3 characters")
    .max(120, "Reason must not exceed 120 characters"),
});

export type VoidItemInput = z.infer<typeof voidItemSchema>;
