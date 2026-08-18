'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Leaf, ShoppingCart, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useSession, useLogout } from '@/hooks/use-session';

/**
 * Public site navigation.
 *
 * Replaces the old Navbar, which read the role out of a Zustand store backed by
 * localStorage. This asks the server instead. What it renders is a presentation
 * choice only: hiding a link never protects the route behind it, which is
 * enforced server-side in every case.
 */
export function SiteNav({ cartCount = 0 }: { cartCount?: number }) {
  const { isAuthenticated, user, profile } = useSession();
  const router = useRouter();
  const logout = useLogout();

  const dashboard =
    user?.role === 'farmer' ? '/farm/dashboard'
    : user?.role === 'admin' ? '/admin'
    : '/buyer/dashboard';

  const displayName =
    (profile?.name as string | undefined) ?? user?.email ?? '';

  async function onLogout() {
    await logout();
    router.push('/');
    router.refresh();
  }

  return (
    <header className="border-b border-border/40">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Leaf className="h-6 w-6 text-primary" />
          <span className="font-heading text-xl font-bold text-foreground">AgriConnect</span>
        </Link>

        <nav className="flex items-center gap-2 md:gap-4">
          <Link href="/browse" className="text-sm text-muted-foreground hover:text-foreground hidden sm:block">
            Browse Produce
          </Link>
          <Link href="/prices" className="text-sm text-muted-foreground hover:text-foreground hidden sm:block">
            Market Prices
          </Link>

          <ThemeToggle />

          {user?.role === 'buyer' && (
            <Link href="/buyer/cart" className="relative" aria-label="Cart">
              <ShoppingCart className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-accent text-accent-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
          )}

          {isAuthenticated ? (
            <>
              <Link href={dashboard}>
                <Button variant="outline" className="neo-flat border-none text-sm">
                  {displayName.split(' ')[0] || 'Dashboard'}
                </Button>
              </Link>
              <button
                onClick={onLogout}
                aria-label="Sign out"
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="outline" className="neo-flat border-none text-sm">Sign In</Button>
              </Link>
              <Link href="/register" className="hidden sm:block">
                <Button className="neo-btn bg-primary text-primary-foreground text-sm">Register</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
