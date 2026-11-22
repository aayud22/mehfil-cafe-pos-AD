import { z } from "zod";

export const menuItemSchema = z.object({
  category_id: z.string().uuid("Please select a valid menu category"),
  name: z.string().trim().min(2, "Item name must be at least 2 characters"),
  price: z.coerce.number().positive("Price must be greater than ₹0"),
  is_available: z.boolean().default(true),
});

export type MenuItemInput = z.infer<typeof menuItemSchema>;
