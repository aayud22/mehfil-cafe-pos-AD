"use server";

import { createClient } from "@/lib/supabase/server";
import {
  cancelOrderSchema,
  CancelOrderInput,
  voidItemSchema,
  VoidItemInput,
} from "@/schemas/cancel";
import { revalidatePath } from "next/cache";

export async function cancelOrder(
  input: CancelOrderInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = cancelOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message || "Invalid cancellation request",
    };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_order", {
      p_order_id: parsed.data.order_id,
      p_reason: parsed.data.reason,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/waiter");
    revalidatePath("/kitchen");
    revalidatePath("/cashier");
    revalidatePath("/owner");

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Failed to cancel order" };
  }
}

export async function voidOrderItem(
  input: VoidItemInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = voidItemSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message || "Invalid item removal request",
    };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("void_order_item", {
      p_item_id: parsed.data.item_id,
      p_reason: parsed.data.reason,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/waiter");
    revalidatePath("/kitchen");
    revalidatePath("/cashier");
    revalidatePath("/owner");

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Failed to remove item" };
  }
}
