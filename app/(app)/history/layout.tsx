import { requireRole } from '@/lib/auth/require-role';

export default async function HistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(['owner', 'manager', 'cashier']);
  return <>{children}</>;
}
