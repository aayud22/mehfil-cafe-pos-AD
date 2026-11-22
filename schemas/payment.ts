import { z } from "zod";

export const paymentSchema = z.object({
  order_id: z.string().uuid("Valid order ID is required"),
  mode: z.enum(["cash", "upi", "card"], {
    required_error: "Please select a payment mode (Cash, UPI, or Card)",
  }),
  amount: z.coerce.number().positive("Amount payable must be positive"),
});

export const payTableSchema = z.object({
  table_id: z.string().uuid("Valid table ID is required"),
  mode: z.enum(["cash", "upi", "card"], {
    required_error: "Payment mode must be cash, upi, or card",
  }),
});

export type PaymentInput = z.infer<typeof paymentSchema>;
export type PayTableInput = z.infer<typeof payTableSchema>;
