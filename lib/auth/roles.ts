export type Role = 'owner' | 'manager' | 'cashier' | 'kitchen' | 'waiter';

export type UserRole = Role; // Alias for backward compatibility

export interface NavItem {
  href: string;
  label: string;
  iconName: 'dashboard' | 'menu' | 'tables' | 'expenses' | 'stock' | 'vendors' | 'waiter' | 'kitchen' | 'cashier' | 'history';
  roles: Role[];
}

export const HOME_BY_ROLE: Record<Role, string> = {
  owner: '/owner',
  manager: '/owner',
  cashier: '/cashier',
  kitchen: '/kitchen',
  waiter: '/waiter',
};

export const ROLE_HOMES = HOME_BY_ROLE;

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Cafe Owner',
  manager: 'Branch Manager',
  cashier: 'Cashier / POS',
  kitchen: 'Kitchen Display (KDS)',
  waiter: 'Floor Waiter',
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: '/owner',
    label: 'Owner Dashboard',
    iconName: 'dashboard',
    roles: ['owner', 'manager'],
  },
  {
    href: '/manager/menu',
    label: 'Menu Catalog',
    iconName: 'menu',
    roles: ['owner', 'manager'],
  },
  {
    href: '/manager/tables',
    label: 'Tables Layout',
    iconName: 'tables',
    roles: ['owner', 'manager'],
  },
  {
    href: '/manager/expenses',
    label: 'Daily Expenses',
    iconName: 'expenses',
    roles: ['owner', 'manager'],
  },
  {
    href: '/manager/stock',
    label: 'Stock & Inventory',
    iconName: 'stock',
    roles: ['owner', 'manager'],
  },
  {
    href: '/manager/vendors',
    label: 'Vendor Dues',
    iconName: 'vendors',
    roles: ['owner', 'manager'],
  },
  {
    href: '/waiter',
    label: 'Floor POS',
    iconName: 'waiter',
    roles: ['waiter', 'owner', 'manager'],
  },
  {
    href: '/kitchen',
    label: 'Kitchen Display (KDS)',
    iconName: 'kitchen',
    roles: ['kitchen', 'owner', 'manager'],
  },
  {
    href: '/cashier',
    label: 'Cashier Billing',
    iconName: 'cashier',
    roles: ['cashier', 'owner', 'manager'],
  },
  {
    href: '/history',
    label: 'Bill History',
    iconName: 'history',
    roles: ['owner', 'manager', 'cashier'],
  },
];

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function canAccessRoute(role: Role, pathname: string): boolean {
  if (role === 'owner' || role === 'manager') return true;

  if (pathname.startsWith('/owner')) {
    return false;
  }

  if (pathname.startsWith('/manager')) {
    return false;
  }

  if (pathname.startsWith('/kitchen')) {
    return role === 'kitchen';
  }

  if (pathname.startsWith('/cashier')) {
    return role === 'cashier';
  }

  if (pathname.startsWith('/history')) {
    return role === 'cashier';
  }

  if (pathname.startsWith('/waiter')) {
    return role === 'waiter';
  }

  return true;
}
