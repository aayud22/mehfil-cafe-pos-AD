import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { HOME_BY_ROLE, Role } from '@/lib/auth/roles';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch verified role directly from the server profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (!profile || profile.is_active === false) {
    redirect('/login');
  }

  const role = (profile.role as Role) || 'waiter';
  redirect(HOME_BY_ROLE[role] || '/login');
}
