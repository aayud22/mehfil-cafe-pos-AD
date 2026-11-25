"use server"

import { createClient } from "@/lib/supabase/server"
import { paymentSchema, PaymentInput, payTableSchema, PayTableInput } from "@/schemas/payment"
import { formatMoney } from "@/lib/format"
import { revalidatePath } from "next/cache"

type PayTableResult =
  | { ok: true; billId: string }
  | { ok: false; error: string }

function mapFriendlyPayError(msg: string): string {
  const lower = msg.toLowerCase()
  if (lower.includes("above your limit")) {
    return "This discount exceeds your role's maximum allowed percentage."
  }
  if (lower.includes("reason is required")) {
    return "Please enter a reason for applying the discount."
  }
  if (lower.includes("cannot be more than the subtotal")) {
    return "Discount cannot exceed the item subtotal."
  }
  if (lower.includes("must add up to the bill total")) {
    return "Payment lines must add up to the exact bill total."
  }
  if (lower.includes("still being prepared")) {
    return "Some orders for this table are still being prepared in the kitchen."
  }
  if (lower.includes("some selected items cannot be billed")) {
    return "Some selected items were already billed or voided. Please refresh."
  }
  if (lower.includes("nothing to bill")) {
    return "No served, unbilled items found to settle."
  }
  if (lower.includes("not allowed")) {
    return "You do not have permission to settle bills."
  }
  return msg || "Unable to complete payment. Please try again."
}

export async function payTable(input: PayTableInput): Promise<PayTableResult> {
  const parsed = payTableSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message || "Invalid payment details",
    }
  }

  const supabase = await createClient()

  try {
    const { data, error } = await supabase.rpc("pay_table", {
      p_table_id: parsed.data.table_id ?? null,
      p_payments: parsed.data.payments,
      p_order_id: parsed.data.order_id ?? null,
      p_item_ids: parsed.data.item_ids ?? null,
      p_discount_type: parsed.data.discount_type,
      p_discount_value: parsed.data.discount_value,
      p_discount_reason: parsed.data.discount_reason ?? null,
    })

    if (error) {
      return { ok: false, error: mapFriendlyPayError(error.message) }
    }

    revalidatePath("/cashier")
    revalidatePath("/owner")
    revalidatePath("/waiter")
    revalidatePath("/history")

    return { ok: true, billId: String(data) }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Payment failed"
    return { ok: false, error: mapFriendlyPayError(msg) }
  }
}

export async function processPaymentAction(input: PaymentInput) {
  const parsed = paymentSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid payment details" }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: order, error: orderFetchErr } = await supabase
    .from("orders")
    .select(
      `
      id,
      table_id,
      status,
      order_items(quantity, unit_price, voided_at)
    `
    )
    .eq("id", parsed.data.order_id)
    .single()

  if (orderFetchErr || !order) {
    return { error: "Order not found or inaccessible" }
  }

  if (order.status === "billed") {
    return { error: "Order has already been billed and settled" }
  }

  const items = (order.order_items || []) as Array<{
    quantity: number
    unit_price: number
    voided_at?: string | null
  }>
  const computedTotal = items
    .filter((item) => !item.voided_at)
    .reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0)

  if (Math.abs(parsed.data.amount - computedTotal) > 0.01) {
    return {
      error: `Payment amount (${formatMoney(parsed.data.amount)}) does not match database order total (${formatMoney(computedTotal)})`,
    }
  }

  const { error: payErr } = await supabase.from("payments").insert({
    order_id: parsed.data.order_id,
    mode: parsed.data.mode,
    amount: computedTotal,
    received_by: user?.id || null,
  })

  if (payErr) {
    return { error: payErr.message }
  }

  await supabase
    .from("orders")
    .update({ status: "billed" })
    .eq("id", parsed.data.order_id)

  const { data: remainingOrders } = await supabase
    .from("orders")
    .select("id")
    .eq("table_id", order.table_id)
    .in("status", ["new", "preparing", "ready", "served"])

  if (!remainingOrders || remainingOrders.length === 0) {
    await supabase
      .from("cafe_tables")
      .update({ status: "free" })
      .eq("id", order.table_id)
  }

  revalidatePath("/cashier")
  revalidatePath("/owner")
  revalidatePath("/waiter")
  return { success: true }
}
