import { Link } from 'react-router-dom';
import { Leaf, Menu, ShoppingCart, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBuyerAuth, useFarmerAuth } from '@/stores/auth-store';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const farmerAuth = useFarmerAuth();
  const buyerAuth = useBuyerAuth();
  const cartCount = buyerAuth.cart.reduce((sum, c) => sum + c.quantity, 0);

  return (
    <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Leaf className="h-7 w-7 text-primary" />
          <span className="font-heading text-xl font-bold text-foreground">AgriConnect</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/browse" className="text-muted-foreground hover:text-foreground transition-colors font-medium text-sm">
            Browse Produce
          </Link>
          <Link to="/prices" className="text-muted-foreground hover:text-foreground transition-colors font-medium text-sm">
            Market Prices
          </Link>
          <Link to="/farmer/register" className="btn-gold text-sm py-2 px-4 inline-block rounded-lg no-underline">
            Sell Your Harvest
          </Link>

          {farmerAuth.isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">{farmerAuth.farmer?.name}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild><Link to="/farm/dashboard">Dashboard</Link></DropdownMenuItem>
                <DropdownMenuItem onClick={farmerAuth.logout}>Logout</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : buyerAuth.isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link to="/buyer/cart" className="relative">
                <ShoppingCart className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-accent text-accent-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center font-bold">
                    {cartCount}
                  </span>
                )}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">{buyerAuth.buyer?.name}</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem asChild><Link to="/buyer/dashboard">Dashboard</Link></DropdownMenuItem>
                  <DropdownMenuItem onClick={buyerAuth.logout}>Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">Login</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild><Link to="/farmer/login">Farmer Login</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/buyer/login">Buyer Login</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-card border-b border-border px-4 py-4 space-y-3">
          <Link to="/browse" className="block text-foreground font-medium" onClick={() => setMobileOpen(false)}>Browse Produce</Link>
          <Link to="/prices" className="block text-foreground font-medium" onClick={() => setMobileOpen(false)}>Market Prices</Link>
          <Link to="/farmer/register" className="block text-accent font-bold" onClick={() => setMobileOpen(false)}>Sell Your Harvest</Link>
          <Link to="/farmer/login" className="block text-muted-foreground" onClick={() => setMobileOpen(false)}>Farmer Login</Link>
          <Link to="/buyer/login" className="block text-muted-foreground" onClick={() => setMobileOpen(false)}>Buyer Login</Link>
        </div>
      )}
    </nav>
  );
}
