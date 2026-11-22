"use server"

import { createClient } from "@/lib/supabase/server"
import { orderSchema, OrderInput } from "@/schemas/order"
import { revalidatePath } from "next/cache"

export async function createOrderAction(input: OrderInput) {
  const parsed = orderSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid order payload" }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 1. Create order
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      table_id: parsed.data.table_id,
      waiter_id: user?.id || null,
      status: "new",
      note: parsed.data.note || null,
    })
    .select()
    .single()

  if (orderErr || !order) {
    return { error: orderErr?.message || "Failed to create order" }
  }

  // 2. Insert order items
  const items = parsed.data.items.map((item) => ({
    order_id: order.id,
    menu_item_id: item.menu_item_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    note: item.note || null,
  }))

  const { error: itemsErr } = await supabase.from("order_items").insert(items)
  if (itemsErr) {
    return { error: itemsErr.message }
  }

  // 3. Mark table occupied
  await supabase
    .from("cafe_tables")
    .update({ status: "occupied" })
    .eq("id", parsed.data.table_id)

  revalidatePath("/kitchen")
  revalidatePath("/waiter")
  revalidatePath("/cashier")
  return { success: true, orderId: order.id }
}

export async function updateOrderStatusAction(
  orderId: string,
  status: "new" | "preparing" | "ready" | "served" | "billed" | "cancelled"
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/kitchen")
  revalidatePath("/cashier")
  return { success: true }
}
