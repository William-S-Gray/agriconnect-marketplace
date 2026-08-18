'use client';

import { LayoutDashboard, Package, ShoppingBag, DollarSign, User } from 'lucide-react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { useLogout } from '@/hooks/use-session';

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/farm/dashboard' },
  { icon: Package, label: 'My Listings', href: '/farm/listings' },
  { icon: ShoppingBag, label: 'Orders', href: '/farm/orders' },
  { icon: DollarSign, label: 'Earnings', href: '/farm/earnings' },
  { icon: User, label: 'Profile', href: '/farm/profile' },
];

export function FarmShell({
  name, farmName, status, children,
}: {
  name: string;
  farmName: string;
  /** Farmer verification state; the sidebar renders a badge for it. */
  status: string;
  children: React.ReactNode;
}) {
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar
        nav={NAV}
        userName={name}
        subtitle={farmName}
        // The sidebar badge only distinguishes verified from everything else.
        status={status === 'VERIFIED' ? 'verified' : 'pending'}
        onLogout={logout}
      />
      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-auto">{children}</main>
    </div>
  );
}
