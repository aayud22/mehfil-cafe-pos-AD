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

  // Validate unique label (case-insensitive)
  const { data: existing } = await supabase
    .from("cafe_tables")
    .select("id")
    .ilike("label", parsed.data.label.trim())
    .maybeSingle()

  if (existing) {
    return { error: `Table label "${parsed.data.label}" already exists. Please choose a unique name.` }
  }

  const { data, error } = await supabase
    .from("cafe_tables")
    .insert({
      label: parsed.data.label.trim(),
      seats: parsed.data.seats,
      status: "free",
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

export async function updateTableAction(id: string, input: TableInput) {
  const parsed = tableSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid table details" }
  }

  const supabase = await createClient()

  // Check if table has open orders
  const { data: openOrders } = await supabase
    .from("orders")
    .select("id")
    .eq("table_id", id)
    .in("status", ["new", "preparing", "ready", "served"])

  if (openOrders && openOrders.length > 0) {
    return { error: "Cannot edit table while it has active open dining orders." }
  }

  // Validate unique label against other tables
  const { data: existing } = await supabase
    .from("cafe_tables")
    .select("id")
    .ilike("label", parsed.data.label.trim())
    .neq("id", id)
    .maybeSingle()

  if (existing) {
    return { error: `Another table with label "${parsed.data.label}" already exists.` }
  }

  const { data, error } = await supabase
    .from("cafe_tables")
    .update({
      label: parsed.data.label.trim(),
      seats: parsed.data.seats,
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/manager/tables")
  revalidatePath("/waiter")
  return { success: true, table: data }
}

export async function deleteTableAction(id: string) {
  const supabase = await createClient()

  // Check if table has open orders
  const { data: openOrders } = await supabase
    .from("orders")
    .select("id")
    .eq("table_id", id)
    .in("status", ["new", "preparing", "ready", "served"])

  if (openOrders && openOrders.length > 0) {
    return { error: "Cannot delete table while it has active dining orders." }
  }

  const { error } = await supabase.from("cafe_tables").delete().eq("id", id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/manager/tables")
  revalidatePath("/waiter")
  return { success: true }
}
