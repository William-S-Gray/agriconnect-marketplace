'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Leaf, ShoppingCart, LogOut, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet';
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
            <Link
              href="/buyer/cart"
              className="relative p-2 -m-2"
              aria-label={cartCount > 0 ? `Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Cart'}
            >
              <ShoppingCart className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              {cartCount > 0 && (
                <span aria-hidden className="absolute top-0 right-0 bg-accent text-accent-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
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
              <Link
                href="/settings/security"
                className="text-sm text-muted-foreground hover:text-foreground hidden sm:block"
              >
                Security
              </Link>
              <button
                onClick={onLogout}
                aria-label="Sign out"
                className="p-2 -m-2 text-muted-foreground hover:text-destructive transition-colors hidden sm:block"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="outline" className="neo-flat border-none text-sm">Sign in</Button>
              </Link>
              <Link href="/register" className="hidden sm:block">
                <Button className="neo-btn bg-primary text-primary-foreground text-sm">Register</Button>
              </Link>
            </>
          )}
          {/* Below sm the text links are hidden, which left phones with no way
              to reach Browse or Prices from the header. */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="neo-flat h-9 w-9 sm:hidden" aria-label="Open menu">
                <Menu className="h-4 w-4" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="font-heading">Menu</SheetTitle>
              <nav className="mt-6 flex flex-col gap-1" aria-label="Mobile">
                {[
                  { href: '/browse', label: 'Browse produce' },
                  { href: '/prices', label: 'Market prices' },
                  ...(isAuthenticated
                    ? [{ href: dashboard, label: 'My dashboard' }, { href: '/settings/security', label: 'Security' }]
                    : [{ href: '/register', label: 'Create an account' }, { href: '/register?role=farmer', label: 'Sell your produce' }]),
                ].map((item) => (
                  <SheetClose asChild key={item.href}>
                    <Link href={item.href} className="rounded-xl px-3 py-3 text-foreground hover:bg-muted">
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
                {isAuthenticated && (
                  <SheetClose asChild>
                    <button onClick={onLogout} className="rounded-xl px-3 py-3 text-left text-destructive hover:bg-muted">
                      Sign out
                    </button>
                  </SheetClose>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </nav>
      </div>
    </header>
  );
}
