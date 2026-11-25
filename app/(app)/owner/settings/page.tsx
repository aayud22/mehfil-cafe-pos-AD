import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/require-role';
import { AppSettings } from '@/types/database';
import { SettingsForm } from './SettingsForm';

export default async function OwnerSettingsPage() {
  await requireRole(['owner']);

  const supabase = await createClient();
  const { data } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 1)
    .single();

  const initialSettings: AppSettings = (data as AppSettings) || {
    id: 1,
    cafe_name: 'Mehfil Cafe',
    cafe_address: null,
    gstin: null,
    gst_enabled: true,
    gst_rate: 5,
    cashier_max_discount_percent: 10,
    manager_max_discount_percent: 25,
    upi_id: null,
    upi_payee_name: null,
  };

  return <SettingsForm initialSettings={initialSettings} />;
}
