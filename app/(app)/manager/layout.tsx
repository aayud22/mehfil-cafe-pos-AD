import { requireRole } from '@/lib/auth/require-role';

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(['owner', 'manager']);
  return <>{children}</>;
}
