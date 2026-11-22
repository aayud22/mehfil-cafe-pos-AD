"use server"

import { createClient } from "@/lib/supabase/server"
import { expenseSchema, ExpenseInput } from "@/schemas/expense"
import { revalidatePath } from "next/cache"

export async function createExpenseAction(input: ExpenseInput) {
  const parsed = expenseSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid expense details" }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      expense_date: parsed.data.expense_date,
      category: parsed.data.category,
      amount: parsed.data.amount,
      note: parsed.data.note || null,
      created_by: user?.id || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/manager/expenses")
  revalidatePath("/owner")

  return { success: true, expense: data }
}
