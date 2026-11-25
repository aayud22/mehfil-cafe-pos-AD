import { z } from "zod";

export const orderItemInputSchema = z.object({
  menu_item_id: z.string().uuid("Invalid menu item ID"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  unit_price: z.coerce.number().min(0, "Price must be non-negative").optional(),
  note: z.string().trim().max(100, "Note must be 100 characters or less").optional(),
});

export const orderSchema = z
  .object({
    order_type: z.enum(["dine_in", "takeaway", "delivery"]).default("dine_in"),
    table_id: z.string().uuid("Please select a valid table").nullable().optional(),
    customer_name: z
      .string()
      .trim()
      .max(60, "Customer name must be 60 characters or less")
      .nullable()
      .optional(),
    note: z.string().trim().max(200, "Order note must be under 200 characters").optional(),
    items: z
      .array(orderItemInputSchema)
      .min(1, "At least one item must be added to the order"),
  })
  .refine((data) => data.order_type !== "dine_in" || Boolean(data.table_id), {
    message: "Please select a table for dine-in orders",
    path: ["table_id"],
  })
  .refine((data) => data.order_type === "dine_in" || !data.table_id, {
    message: "Takeaway and delivery orders cannot have a table",
    path: ["table_id"],
  });

export type OrderInput = z.infer<typeof orderSchema>;
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
