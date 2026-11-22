import { requireRole } from '@/lib/auth/require-role';

export default async function WaiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(['waiter', 'owner', 'manager']);
  return <>{children}</>;
}
