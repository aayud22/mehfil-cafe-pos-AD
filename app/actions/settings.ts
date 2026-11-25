'use server';

import { createClient } from '@/lib/supabase/server';
import { appSettingsSchema, AppSettingsInput } from '@/schemas/settings';
import { revalidatePath } from 'next/cache';

export async function updateAppSettingsAction(input: AppSettingsInput) {
  const parsed = appSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message || 'Invalid settings payload' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: 'Authentication required' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.is_active || profile.role !== 'owner') {
    return { ok: false, error: 'Only the cafe owner can update settings' };
  }

  const { error } = await supabase
    .from('app_settings')
    .update({
      cafe_name: parsed.data.cafe_name,
      cafe_address: parsed.data.cafe_address || null,
      gstin: parsed.data.gstin ? parsed.data.gstin.toUpperCase() : null,
      gst_enabled: parsed.data.gst_enabled,
      gst_rate: parsed.data.gst_rate,
      cashier_max_discount_percent: parsed.data.cashier_max_discount_percent,
      manager_max_discount_percent: parsed.data.manager_max_discount_percent,
    })
    .eq('id', 1);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/owner/settings');
  revalidatePath('/cashier');
  return { ok: true };
}
