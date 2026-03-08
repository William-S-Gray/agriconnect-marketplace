import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, Sprout, Package, DollarSign, Settings, LogOut, Plus, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { useFarmerAuth } from '@/stores/auth-store';
import { getListingsByFarmer, getOrdersByFarmer } from '@/lib/mock-data';

const FarmerDashboard = () => {
  const { farmer, logout } = useFarmerAuth();
  const navigate = useNavigate();

  if (!farmer) {
    navigate('/farmer/login');
    return null;
  }

  const listings = getListingsByFarmer(farmer.id);
  const orders = getOrdersByFarmer(farmer.id);
  const activeListings = listings.filter(l => l.status === 'ACTIVE');
  const pendingOrders = orders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED');

  const nav = [
    { icon: BarChart3, label: 'Dashboard', href: '/farm/dashboard', active: true },
    { icon: Sprout, label: 'My Listings', href: '/farm/listings' },
    { icon: Package, label: 'Orders', href: '/farm/orders' },
    { icon: DollarSign, label: 'Earnings', href: '/farm/earnings' },
    { icon: Settings, label: 'Profile', href: '/farm/profile' },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border p-4">
        <Link to="/" className="flex items-center gap-2 mb-8 px-2">
          <Sprout className="h-6 w-6 text-primary" />
          <span className="font-heading text-lg font-bold">AgriConnect</span>
        </Link>
        <div className="px-2 mb-6">
          <p className="font-semibold text-foreground text-sm">{farmer.name}</p>
          <p className="text-xs text-muted-foreground">{farmer.farm_name}</p>
          <StatusBadge type={farmer.status === 'VERIFIED' ? 'verified' : 'pending'} />
        </div>
        <nav className="space-y-1 flex-1">
          {nav.map(n => (
            <Link key={n.label} to={n.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              n.active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'
            }`}>
              <n.icon className="h-4 w-4" />{n.label}
            </Link>
          ))}
        </nav>
        <button onClick={() => { logout(); navigate('/'); }} className="flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground hover:text-destructive">
          <LogOut className="h-4 w-4" />Logout
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 p-4 md:p-8">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-1">Good morning, {farmer.farm_name} 👋</h1>
        <p className="text-muted-foreground text-sm mb-8">Here's what's happening with your farm today.</p>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'This Month', value: `$${farmer.total_sales.toLocaleString()}`, icon: DollarSign, color: 'text-accent' },
            { label: 'Active Listings', value: activeListings.length, icon: Sprout, color: 'text-primary' },
            { label: 'Orders Total', value: orders.length, icon: Package, color: 'text-fresh' },
            { label: 'Rating', value: `★ ${farmer.rating}`, icon: Star, color: 'text-accent' },
          ].map((s, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <p className="font-mono text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Pending orders */}
        <div className="mb-8">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-4">Pending Orders</h2>
          {pendingOrders.length === 0 ? (
            <p className="text-muted-foreground text-sm">No pending orders.</p>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="text-left p-3 text-xs font-semibold text-foreground">Buyer</th>
                    <th className="text-left p-3 text-xs font-semibold text-foreground">Produce</th>
                    <th className="text-right p-3 text-xs font-semibold text-foreground">Qty</th>
                    <th className="text-right p-3 text-xs font-semibold text-foreground">Amount</th>
                    <th className="text-left p-3 text-xs font-semibold text-foreground">Status</th>
                    <th className="text-right p-3 text-xs font-semibold text-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingOrders.map(order => (
                    <tr key={order.id} className="border-b border-border last:border-0">
                      <td className="p-3 text-sm">{order.buyer_name}</td>
                      <td className="p-3 text-sm">{order.produce_title}</td>
                      <td className="p-3 text-sm text-right font-mono">{order.quantity}</td>
                      <td className="p-3 text-sm text-right font-mono">${order.total_amount.toFixed(2)}</td>
                      <td className="p-3"><StatusBadge type={order.status === 'PENDING' ? 'order-pending' : 'confirmed'} /></td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="outline" className="text-xs">
                          {order.status === 'PENDING' ? 'Confirm' : 'Dispatch'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick listings */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg font-semibold text-foreground">My Listings</h2>
          <Link to="/farm/listings/new">
            <Button size="sm" className="bg-primary text-primary-foreground">
              <Plus className="h-4 w-4 mr-1" />New Listing
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeListings.slice(0, 3).map(l => (
            <div key={l.id} className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-heading font-semibold text-foreground text-sm mb-1">{l.title}</h3>
              <p className="price-display text-base">${l.price_per_unit.toFixed(2)} <span className="text-muted-foreground text-xs font-normal">/ {l.quantity_unit}</span></p>
              <p className="text-xs text-muted-foreground mt-1">{l.quantity_kg} {l.quantity_unit} available</p>
              <p className="text-xs text-muted-foreground">{l.views_count} views</p>
            </div>
          ))}
        </div>

        {/* Mobile bottom nav */}
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border md:hidden flex justify-around py-2 z-40">
          {nav.slice(0, 5).map(n => (
            <Link key={n.label} to={n.href} className={`flex flex-col items-center text-xs p-1 ${
              n.active ? 'text-primary' : 'text-muted-foreground'
            }`}>
              <n.icon className="h-5 w-5" />
              <span className="mt-0.5">{n.label}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
};

export default FarmerDashboard;
