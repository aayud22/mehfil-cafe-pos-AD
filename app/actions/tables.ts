"use server"

import { createClient } from "@/lib/supabase/server"
import { tableSchema, TableInput } from "@/schemas/table"
import { revalidatePath } from "next/cache"

export async function createTableAction(input: TableInput) {
  const parsed = tableSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid table details" }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("cafe_tables")
    .insert({
      label: parsed.data.label,
      seats: parsed.data.seats,
      status: parsed.data.status,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/manager/tables")
  revalidatePath("/waiter")
  return { success: true, table: data }
}

export async function toggleTableStatusAction(id: string, currentStatus: "free" | "occupied") {
  const nextStatus = currentStatus === "free" ? "occupied" : "free"
  const supabase = await createClient()
  const { error } = await supabase
    .from("cafe_tables")
    .update({ status: nextStatus })
    .eq("id", id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/manager/tables")
  revalidatePath("/waiter")
  return { success: true, status: nextStatus }
}
