import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function LegacyBillRedirectPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const resolvedParams = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select('table_id')
    .eq('id', resolvedParams.orderId)
    .single();

  if (order?.table_id) {
    redirect(`/cashier/table/${order.table_id}`);
  }

  redirect('/cashier');
}
