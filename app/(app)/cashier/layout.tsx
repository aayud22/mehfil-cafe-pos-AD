import { requireRole } from '@/lib/auth/require-role';

export default async function CashierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(['cashier', 'owner', 'manager']);
  return <>{children}</>;
}
