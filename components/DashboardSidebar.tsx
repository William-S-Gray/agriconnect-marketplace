'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Sprout, LogOut } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
}

interface DashboardSidebarProps {
  nav: NavItem[];
  userName: string;
  subtitle?: string;
  status?: 'verified' | 'pending';
  onLogout: () => void;
}

export function DashboardSidebar({ nav, userName, subtitle, status, onLogout }: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 neo-flat rounded-none p-4 shrink-0">
        <div className="flex items-center justify-between mb-8 px-2">
          <Link href="/" className="flex items-center gap-2">
            <Sprout className="h-6 w-6 text-primary" />
            <span className="font-heading text-lg font-bold text-foreground">AgriConnect</span>
          </Link>
          <ThemeToggle />
        </div>
        <div className="px-2 mb-6">
          <p className="font-semibold text-foreground text-sm">{userName}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {status && <StatusBadge type={status} />}
        </div>
        <nav className="space-y-1 flex-1">
          {nav.map(n => (
            <Link key={n.label} href={n.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
              pathname === n.href ? 'neo-inset text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}>
              <n.icon className="h-4 w-4" />{n.label}
            </Link>
          ))}
        </nav>
        <button onClick={() => { onLogout(); router.push('/'); }} className="flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground hover:text-destructive transition-colors">
          <LogOut className="h-4 w-4" />Logout
        </button>
      </aside>

      {/* Mobile bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 neo-flat rounded-none md:hidden flex justify-around py-2 z-40">
        {nav.slice(0, 5).map(n => (
          <Link key={n.label} href={n.href} className={`flex flex-col items-center text-xs p-1 ${
            pathname === n.href ? 'text-primary' : 'text-muted-foreground'
          }`}>
            <n.icon className="h-5 w-5" />
            <span className="mt-0.5">{n.label}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
