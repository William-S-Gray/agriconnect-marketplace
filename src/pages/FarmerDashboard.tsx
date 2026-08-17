import { Link } from 'react-router-dom';
import { BarChart3, Sprout, Package, DollarSign, Settings, Plus, Star, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useFarmerAuth } from '@/stores/auth-store';
import { SEED_LISTINGS, SEED_ORDERS } from '@/lib/seed-data';

const nav = [
  { icon: BarChart3, label: 'Dashboard', href: '/farm/dashboard' },
  { icon: Sprout, label: 'My Listings', href: '/farm/listings' },
  { icon: Package, label: 'Orders', href: '/farm/orders' },
  { icon: DollarSign, label: 'Earnings', href: '/farm/earnings' },
  { icon: Settings, label: 'Profile', href: '/farm/profile' },
];

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
  CONFIRMED: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  IN_TRANSIT: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
  COMPLETED: 'text-green-600 bg-green-50 dark:bg-green-900/20',
  DISPUTED: 'text-red-600 bg-red-50 dark:bg-red-900/20',
};

function FarmerDashboardInner() {
  const { farmer, logout } = useFarmerAuth();

  const myListings = SEED_LISTINGS.filter(l => l.farmer_id === farmer?.id || farmer?.id === 'farmer-001');
  const myOrders = SEED_ORDERS.filter(o => o.farmer_id === (farmer?.id ?? 'farmer-001'));
  const revenue = myOrders.filter(o => o.payment_status === 'RELEASED').reduce((s, o) => s + o.farmer_payout, 0);
  const pendingOrders = myOrders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar nav={nav} userName={farmer?.name ?? ''} subtitle={farmer?.farm_name ?? ''} status={farmer?.status === 'VERIFIED' ? 'verified' : 'pending'} onLogout={logout} />

      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-1">{greeting}, {farmer?.farm_name} 👋</h1>
        <p className="text-muted-foreground text-sm mb-8">Here's what's happening with your farm today.</p>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Revenue Earned', value: `$${revenue.toFixed(2)}`, icon: DollarSign, color: 'text-accent' },
            { label: 'Active Listings', value: myListings.filter(l => l.status === 'ACTIVE').length, icon: Sprout, color: 'text-primary' },
            { label: 'Total Orders', value: myOrders.length, icon: Package, color: 'text-fresh' },
            { label: 'Rating', value: farmer?.rating ? `★ ${farmer.rating}` : '—', icon: Star, color: 'text-accent' },
          ].map((s, i) => (
            <div key={i} className="neo-card p-5">
              <div className="flex items-center justify-between mb-2">
                <s.icon className={`h-5 w-5 ${s.color}`} />
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
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
            <p className="text-muted-foreground text-sm">No pending orders right now.</p>
          ) : (
            <div className="space-y-3">
              {pendingOrders.map(order => (
                <div key={order.id} className="neo-card p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground text-sm line-clamp-1">{order.produce_title}</p>
                    <p className="text-xs text-muted-foreground">Buyer: {order.buyer_name} · {order.quantity} kg</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-foreground">${order.total_amount.toFixed(2)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[order.status]}`}>{order.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick listings */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg font-semibold text-foreground">My Listings</h2>
          <Link to="/farm/listings/new">
            <Button size="sm" className="neo-btn bg-primary text-primary-foreground">
              <Plus className="h-4 w-4 mr-1" />New Listing
            </Button>
          </Link>
        </div>

        {myListings.length === 0 ? (
          <div className="neo-card p-12 text-center">
            <Sprout className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No listings yet. Create your first listing to start selling!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myListings.slice(0, 5).map(listing => (
              <div key={listing.id} className="neo-card p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm line-clamp-1">{listing.title}</p>
                  <p className="text-xs text-muted-foreground">{listing.quantity_kg} kg available · {listing.province}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-bold text-accent">${listing.price_per_unit.toFixed(2)}/{listing.quantity_unit}</p>
                  <span className="text-xs text-green-600 font-medium">{listing.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mobile bottom nav */}
        <div className="fixed bottom-0 left-0 right-0 neo-flat rounded-none md:hidden flex justify-around py-2 z-40 border-t border-border/30">
          {nav.map(n => (
            <Link key={n.label} to={n.href} className="flex flex-col items-center text-xs p-1 text-muted-foreground hover:text-foreground transition-colors">
              <n.icon className="h-5 w-5" />
              <span className="mt-0.5">{n.label}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

const FarmerDashboard = () => (
  <ProtectedRoute role="farmer">
    <FarmerDashboardInner />
  </ProtectedRoute>
);

export default FarmerDashboard;
