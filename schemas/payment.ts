import { z } from "zod";

export const paymentSchema = z.object({
  order_id: z.string().uuid("Valid order ID is required"),
  mode: z.enum(["cash", "upi", "card"], {
    required_error: "Please select a payment mode (Cash, UPI, or Card)",
  }),
  amount: z.coerce.number().positive("Amount payable must be positive"),
});

export type PaymentInput = z.infer<typeof paymentSchema>;
