import { z } from "zod";

export const expenseSchema = z.object({
  expense_date: z.string().min(1, "Expense date is required"),
  category: z.string().trim().min(2, "Expense category must be at least 2 characters"),
  amount: z.coerce.number().positive("Expense amount must be greater than 0"),
  note: z.string().trim().max(200, "Notes cannot exceed 200 characters").optional(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
