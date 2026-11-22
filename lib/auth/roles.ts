import { UserRole } from '@/types/database';

export const ROLE_HOMES: Record<UserRole, string> = {
  owner: '/owner',
  manager: '/manager/menu',
  cashier: '/cashier',
  kitchen: '/kitchen',
  waiter: '/waiter',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Cafe Owner',
  manager: 'Branch Manager',
  cashier: 'Cashier / POS',
  kitchen: 'Kitchen Display (KDS)',
  waiter: 'Floor Waiter',
};

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  if (role === 'owner') return true; // Owner can see everything

  if (pathname.startsWith('/owner')) {
    return false;
  }

  if (pathname.startsWith('/manager')) {
    return role === 'manager';
  }

  if (pathname.startsWith('/kitchen')) {
    return role === 'kitchen' || role === 'manager';
  }

  if (pathname.startsWith('/cashier')) {
    return role === 'cashier' || role === 'manager';
  }

  if (pathname.startsWith('/waiter')) {
    return role === 'waiter' || role === 'cashier' || role === 'manager';
  }

  return true;
}
