"use server"

import { createClient } from "@/lib/supabase/server"
import { paymentSchema, PaymentInput, payTableSchema, PayTableInput } from "@/schemas/payment"
import { revalidatePath } from "next/cache"

type PayTableResult =
  | { ok: true; total: number }
  | { ok: false; error: string }

export async function payTable(input: PayTableInput): Promise<PayTableResult> {
  // Validate { table_id: uuid, mode: enum cash|upi|card } with Zod
  const parsed = payTableSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message || "Invalid table payment payload",
    }
  }

  const supabase = await createClient()

  // Call pay_table RPC function
  const { data, error } = await supabase.rpc("pay_table", {
    p_table_id: parsed.data.table_id,
    p_mode: parsed.data.mode,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/cashier")
  revalidatePath("/owner")
  revalidatePath("/waiter")

  return { ok: true, total: Number(data) }
}

export async function processPaymentAction(input: PaymentInput) {
  // 1. Re-validate schema on the server
  const parsed = paymentSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid payment details" }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 2. Recompute order total directly from database order items
  const { data: order, error: orderFetchErr } = await supabase
    .from("orders")
    .select(`
      id,
      table_id,
      status,
      order_items (
        quantity,
        unit_price
      )
    `)
    .eq("id", parsed.data.order_id)
    .single()

  if (orderFetchErr || !order) {
    return { error: "Order not found or inaccessible." }
  }

  if (order.status === "billed") {
    return { error: "This order has already been paid and settled." }
  }

  const items = (order.order_items as { quantity: number; unit_price: number }[]) || []
  if (items.length === 0) {
    return { error: "Cannot settle an order with no items." }
  }

  // Exact server-computed total
  const computedTotal = items.reduce(
    (sum, item) => sum + Number(item.unit_price) * item.quantity,
    0
  )

  // 3. Reject mismatch between client amount and recomputed server total
  if (Math.abs(computedTotal - parsed.data.amount) > 0.01) {
    return {
      error: `Payment amount mismatch: Expected ₹${computedTotal.toFixed(2)}, received ₹${parsed.data.amount.toFixed(2)}. Transaction rejected.`,
    }
  }

  // 4. Record payment
  const { error: payErr } = await supabase.from("payments").insert({
    order_id: order.id,
    mode: parsed.data.mode,
    amount: computedTotal,
    received_by: user?.id || null,
  })

  if (payErr) {
    return { error: `Failed to record payment: ${payErr.message}` }
  }

  // 5. Update order status to billed
  const { error: orderUpdateErr } = await supabase
    .from("orders")
    .update({ status: "billed" })
    .eq("id", order.id)

  if (orderUpdateErr) {
    return { error: `Failed to close order tab: ${orderUpdateErr.message}` }
  }

  // 6. Free the table
  if (order.table_id) {
    await supabase
      .from("cafe_tables")
      .update({ status: "free" })
      .eq("id", order.table_id)
  }

  revalidatePath("/cashier")
  revalidatePath("/owner")
  revalidatePath("/waiter")

  return { success: true, amount: computedTotal }
}
