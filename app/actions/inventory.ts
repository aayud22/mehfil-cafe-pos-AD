'use server';

import { createClient } from '@/lib/supabase/server';
import { inventoryItemSchema, restockSchema, InventoryItemInput, RestockInput } from '@/schemas/inventory';
import { revalidatePath } from 'next/cache';

export async function createInventoryItemAction(input: InventoryItemInput) {
  const parsed = inventoryItemSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Invalid item payload' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Authentication required' };

  const payload: any = {
    name: parsed.data.name,
    category: parsed.data.category,
    current_stock: parsed.data.current_stock,
    unit: parsed.data.unit,
    min_threshold: parsed.data.min_threshold,
    cost_per_unit: parsed.data.cost_per_unit,
    vendor_id: parsed.data.vendor_id || null,
  };

  const { data, error } = await supabase
    .from('inventory_items')
    .insert(payload)
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/manager/stock');
  return { success: true, item: data };
}

export async function updateInventoryItemAction(id: string, input: InventoryItemInput) {
  const parsed = inventoryItemSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Invalid item payload' };
  }

  const supabase = await createClient();
  const payload: any = {
    name: parsed.data.name,
    category: parsed.data.category,
    current_stock: parsed.data.current_stock,
    unit: parsed.data.unit,
    min_threshold: parsed.data.min_threshold,
    cost_per_unit: parsed.data.cost_per_unit,
    vendor_id: parsed.data.vendor_id || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('inventory_items')
    .update(payload)
    .eq('id', id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/manager/stock');
  return { success: true };
}

export async function deleteInventoryItemAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('inventory_items').delete().eq('id', id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/manager/stock');
  return { success: true };
}

export async function restockInventoryAction(input: RestockInput) {
  const parsed = restockSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Invalid restock payload' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('restock_inventory_item', {
    p_item_id: parsed.data.item_id,
    p_quantity: parsed.data.quantity,
    p_cost_per_unit: parsed.data.cost_per_unit ?? null,
    p_notes: parsed.data.notes ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/manager/stock');
  return { success: true };
}
