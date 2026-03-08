import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, Sprout, Package, DollarSign, Settings, Plus, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { useFarmerAuth } from '@/stores/auth-store';

const nav = [
  { icon: BarChart3, label: 'Dashboard', href: '/farm/dashboard' },
  { icon: Sprout, label: 'My Listings', href: '/farm/listings' },
  { icon: Package, label: 'Orders', href: '/farm/orders' },
  { icon: DollarSign, label: 'Earnings', href: '/farm/earnings' },
  { icon: Settings, label: 'Profile', href: '/farm/profile' },
];

const FarmerDashboard = () => {
  const { farmer, logout } = useFarmerAuth();
  const navigate = useNavigate();

  if (!farmer) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar nav={nav} userName={farmer.name} subtitle={farmer.farm_name} status={farmer.status === 'VERIFIED' ? 'verified' : 'pending'} onLogout={logout} />

      <main className="flex-1 p-4 md:p-8">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-1">Good morning, {farmer.farm_name} 👋</h1>
        <p className="text-muted-foreground text-sm mb-8">Here's what's happening with your farm today.</p>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'This Month', value: '$0', icon: DollarSign, color: 'text-accent' },
            { label: 'Active Listings', value: 0, icon: Sprout, color: 'text-primary' },
            { label: 'Orders Total', value: 0, icon: Package, color: 'text-fresh' },
            { label: 'Rating', value: '★ 0', icon: Star, color: 'text-accent' },
          ].map((s, i) => (
            <div key={i} className="neo-card p-5">
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
          <p className="text-muted-foreground text-sm">No pending orders.</p>
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
        <div className="neo-card p-12 text-center">
          <Sprout className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No listings yet. Create your first listing to start selling!</p>
        </div>

        {/* Mobile bottom nav */}
        <div className="fixed bottom-0 left-0 right-0 neo-flat rounded-none md:hidden flex justify-around py-2 z-40">
          {nav.slice(0, 5).map(n => (
            <Link key={n.label} to={n.href} className="flex flex-col items-center text-xs p-1 text-muted-foreground">
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
