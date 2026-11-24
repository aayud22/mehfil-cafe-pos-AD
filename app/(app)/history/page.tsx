import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/require-role';
import { parseHistoryFilters } from '@/schemas/history';
import { HistoryView } from './HistoryView';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HistoryPage({ searchParams }: PageProps) {
  // Protect route
  await requireRole(['owner', 'manager', 'cashier']);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch verified profile role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id || '')
    .single();

  const role = profile?.role || 'cashier';

  // Parse initial filters from incoming URL search params
  const rawParams = await searchParams;
  const initialFilters = parseHistoryFilters(rawParams);

  return <HistoryView initialRole={role} initialFilters={initialFilters} />;
}
