import { z } from "zod";

export const orderItemInputSchema = z.object({
  menu_item_id: z.string().uuid("Invalid menu item ID"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  unit_price: z.coerce.number().min(0, "Price must be non-negative"),
  note: z.string().trim().max(100, "Note is too long").optional(),
});

export const orderSchema = z.object({
  table_id: z.string().uuid("Please select a valid table"),
  note: z.string().trim().max(250, "Order note must be under 250 characters").optional(),
  items: z.array(orderItemInputSchema).min(1, "At least one item must be added to the order"),
});

export type OrderInput = z.infer<typeof orderSchema>;
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
