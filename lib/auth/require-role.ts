import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Role, HOME_BY_ROLE } from '@/lib/auth/roles';

export async function requireRole(allowedRoles: Role[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch verified role directly from the server profiles table
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, is_active, full_name')
    .eq('id', user.id)
    .single();

  if (error || !profile || profile.is_active === false) {
    redirect('/login');
  }

  const role = profile.role as Role;

  if (!allowedRoles.includes(role)) {
    const fallbackHome = HOME_BY_ROLE[role] || '/login';
    redirect(fallbackHome);
  }

  return { user, profile, role };
}
