import { requireRole } from '@/lib/auth/require-role';

export default async function KitchenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(['kitchen', 'owner', 'manager']);
  return <>{children}</>;
}
