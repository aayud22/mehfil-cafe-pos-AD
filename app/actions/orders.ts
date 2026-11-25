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

  const { data: orderId, error } = await supabase.rpc("create_order", {
    p_table_id: parsed.data.order_type === "dine_in" ? parsed.data.table_id ?? null : null,
    p_note: parsed.data.note || null,
    p_items: parsed.data.items.map((item) => ({
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      note: item.note || null,
      modifier_option_ids: item.modifier_option_ids || [],
    })),
    p_order_type: parsed.data.order_type,
    p_customer_name: parsed.data.customer_name || null,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/kitchen")
  revalidatePath("/waiter")
  revalidatePath("/cashier")
  return { success: true, orderId: String(orderId) }
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
  revalidatePath("/waiter")
  return { success: true }
}
