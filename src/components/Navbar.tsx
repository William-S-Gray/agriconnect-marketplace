import { Link } from 'react-router-dom';
import { Leaf, Menu, ShoppingCart, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/stores/auth-store';
import { useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, role, farmer, buyer, cart, logout } = useAuth();
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const userName = role === 'farmer' ? farmer?.name : role === 'buyer' ? buyer?.name : 'Admin';
  const dashboardLink = role === 'farmer' ? '/farm/dashboard' : role === 'buyer' ? '/buyer/dashboard' : '/admin';

  return (
    <nav className="sticky top-0 z-50 bg-card/90 backdrop-blur-md">
      <div className="neo-flat mx-0 rounded-none">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Leaf className="h-7 w-7 text-primary" />
            <span className="font-heading text-xl font-bold text-foreground">AgriConnect</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-4">
            <Link to="/browse" className="text-muted-foreground hover:text-foreground transition-colors font-medium text-sm">
              Browse Produce
            </Link>
            <Link to="/prices" className="text-muted-foreground hover:text-foreground transition-colors font-medium text-sm">
              Market Prices
            </Link>
            <Link to="/farmer/register" className="btn-gold text-sm py-2 px-4 inline-block rounded-xl no-underline">
              Sell Your Harvest
            </Link>

            <ThemeToggle />

            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                {role === 'buyer' && (
                  <Link to="/buyer/cart" className="relative">
                    <ShoppingCart className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                    {cartCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-accent text-accent-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center font-bold">
                        {cartCount}
                      </span>
                    )}
                  </Link>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="neo-flat border-none">{userName}</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="neo-card border-none">
                    <DropdownMenuItem asChild><Link to={dashboardLink}>Dashboard</Link></DropdownMenuItem>
                    <DropdownMenuItem onClick={logout}>Logout</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <Link to="/login">
                <Button variant="outline" size="sm" className="neo-flat border-none">Login</Button>
              </Link>
            )}
          </div>

          {/* Mobile toggle */}
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button className="text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden neo-card mx-4 mb-4 p-4 space-y-3 rounded-2xl">
          <Link to="/browse" className="block text-foreground font-medium" onClick={() => setMobileOpen(false)}>Browse Produce</Link>
          <Link to="/prices" className="block text-foreground font-medium" onClick={() => setMobileOpen(false)}>Market Prices</Link>
          <Link to="/farmer/register" className="block text-accent font-bold" onClick={() => setMobileOpen(false)}>Sell Your Harvest</Link>
          {isAuthenticated ? (
            <>
              <Link to={dashboardLink} className="block text-foreground font-medium" onClick={() => setMobileOpen(false)}>Dashboard</Link>
              <button onClick={() => { logout(); setMobileOpen(false); }} className="block text-destructive font-medium">Logout</button>
            </>
          ) : (
            <Link to="/login" className="block text-primary font-medium" onClick={() => setMobileOpen(false)}>Login</Link>
          )}
        </div>
      )}
    </nav>
  );
}
