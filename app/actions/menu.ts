"use server"

import { createClient } from "@/lib/supabase/server"
import { menuItemSchema, MenuItemInput } from "@/schemas/menu-item"
import { revalidatePath } from "next/cache"

export async function createMenuItemAction(input: MenuItemInput) {
  const parsed = menuItemSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid menu item data" }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("menu_items")
    .insert({
      category_id: parsed.data.category_id,
      name: parsed.data.name,
      price: parsed.data.price,
      is_available: parsed.data.is_available,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/manager/menu")
  return { success: true, item: data }
}

export async function updateMenuItemAction(id: string, input: MenuItemInput) {
  const parsed = menuItemSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid menu item data" }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("menu_items")
    .update({
      category_id: parsed.data.category_id,
      name: parsed.data.name,
      price: parsed.data.price,
      is_available: parsed.data.is_available,
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/manager/menu")
  return { success: true, item: data }
}

export async function toggleMenuItemAvailabilityAction(id: string, isAvailable: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("menu_items")
    .update({ is_available: isAvailable })
    .eq("id", id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/manager/menu")
  return { success: true }
}
