'use server';

import { createClient } from '@/lib/supabase/server';
import {
  modifierGroupSchema,
  modifierOptionSchema,
  itemModifierAssignmentSchema,
  ModifierGroupInput,
  ModifierOptionInput,
} from '@/schemas/modifier';
import { revalidatePath } from 'next/cache';

async function requireManagerOrOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Authentication required' as const, supabase: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.is_active || !['owner', 'manager'].includes(profile.role)) {
    return { error: 'Owner or Manager access required' as const, supabase: null };
  }
  return { error: null, supabase };
}

export async function createModifierGroupAction(input: ModifierGroupInput) {
  const parsed = modifierGroupSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message || 'Invalid group' };

  const { error: authErr, supabase } = await requireManagerOrOwner();
  if (authErr || !supabase) return { error: authErr || 'Unauthorized' };

  const { error } = await supabase.from('modifier_groups').insert({
    name: parsed.data.name,
    selection_type: parsed.data.selection_type,
    is_required: parsed.data.is_required,
    max_select: parsed.data.selection_type === 'single' ? 1 : parsed.data.max_select ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath('/manager/modifiers');
  revalidatePath('/manager/menu');
  return { success: true };
}

export async function updateModifierGroupAction(id: string, input: ModifierGroupInput) {
  const parsed = modifierGroupSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message || 'Invalid group' };

  const { error: authErr, supabase } = await requireManagerOrOwner();
  if (authErr || !supabase) return { error: authErr || 'Unauthorized' };

  const { error } = await supabase
    .from('modifier_groups')
    .update({
      name: parsed.data.name,
      selection_type: parsed.data.selection_type,
      is_required: parsed.data.is_required,
      max_select: parsed.data.selection_type === 'single' ? 1 : parsed.data.max_select ?? null,
    })
    .eq('id', id);

  if (error) return { error: error.message };
  revalidatePath('/manager/modifiers');
  revalidatePath('/manager/menu');
  return { success: true };
}

export async function deleteModifierGroupAction(id: string) {
  const { error: authErr, supabase } = await requireManagerOrOwner();
  if (authErr || !supabase) return { error: authErr || 'Unauthorized' };

  const { error } = await supabase.from('modifier_groups').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/manager/modifiers');
  revalidatePath('/manager/menu');
  return { success: true };
}

export async function createModifierOptionAction(input: ModifierOptionInput) {
  const parsed = modifierOptionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message || 'Invalid option' };

  const { error: authErr, supabase } = await requireManagerOrOwner();
  if (authErr || !supabase) return { error: authErr || 'Unauthorized' };

  const { error } = await supabase.from('modifier_options').insert({
    group_id: parsed.data.group_id,
    name: parsed.data.name,
    price_delta: parsed.data.price_delta,
    is_available: parsed.data.is_available,
    sort_order: parsed.data.sort_order,
  });

  if (error) return { error: error.message };
  revalidatePath('/manager/modifiers');
  return { success: true };
}

export async function updateModifierOptionAction(id: string, input: ModifierOptionInput) {
  const parsed = modifierOptionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message || 'Invalid option' };

  const { error: authErr, supabase } = await requireManagerOrOwner();
  if (authErr || !supabase) return { error: authErr || 'Unauthorized' };

  const { error } = await supabase
    .from('modifier_options')
    .update({
      name: parsed.data.name,
      price_delta: parsed.data.price_delta,
      is_available: parsed.data.is_available,
      sort_order: parsed.data.sort_order,
    })
    .eq('id', id);

  if (error) return { error: error.message };
  revalidatePath('/manager/modifiers');
  return { success: true };
}

export async function deleteModifierOptionAction(id: string) {
  const { error: authErr, supabase } = await requireManagerOrOwner();
  if (authErr || !supabase) return { error: authErr || 'Unauthorized' };

  const { error } = await supabase.from('modifier_options').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/manager/modifiers');
  return { success: true };
}

export async function setMenuItemModifierGroupsAction(menuItemId: string, groupIds: string[]) {
  const parsed = itemModifierAssignmentSchema.safeParse({
    menu_item_id: menuItemId,
    group_ids: groupIds,
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message || 'Invalid assignment' };

  const { error: authErr, supabase } = await requireManagerOrOwner();
  if (authErr || !supabase) return { error: authErr || 'Unauthorized' };

  const { error: delErr } = await supabase
    .from('menu_item_modifier_groups')
    .delete()
    .eq('menu_item_id', parsed.data.menu_item_id);
  if (delErr) return { error: delErr.message };

  if (parsed.data.group_ids.length > 0) {
    const rows = parsed.data.group_ids.map((gid, idx) => ({
      menu_item_id: parsed.data.menu_item_id,
      group_id: gid,
      sort_order: idx + 1,
    }));
    const { error: insErr } = await supabase.from('menu_item_modifier_groups').insert(rows);
    if (insErr) return { error: insErr.message };
  }

  revalidatePath('/manager/menu');
  revalidatePath('/waiter');
  return { success: true };
}
