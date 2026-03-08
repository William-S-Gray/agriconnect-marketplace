import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, Sprout, Package, DollarSign, Settings, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { useFarmerAuth } from '@/stores/auth-store';

const nav = [
  { icon: BarChart3, label: 'Dashboard', href: '/farm/dashboard' },
  { icon: Sprout, label: 'My Listings', href: '/farm/listings' },
  { icon: Package, label: 'Orders', href: '/farm/orders' },
  { icon: DollarSign, label: 'Earnings', href: '/farm/earnings' },
  { icon: Settings, label: 'Profile', href: '/farm/profile' },
];

const MyListingsPage = () => {
  const { farmer, logout } = useFarmerAuth();
  const navigate = useNavigate();

  if (!farmer) { navigate('/login'); return null; }

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar nav={nav} userName={farmer.name} subtitle={farmer.farm_name} status={farmer.status === 'VERIFIED' ? 'verified' : 'pending'} onLogout={logout} />
      <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-heading text-2xl font-bold text-foreground">My Listings</h1>
          <Link to="/farm/listings/new">
            <Button className="neo-btn bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-1" />New Listing</Button>
          </Link>
        </div>

        <div className="text-center py-16">
          <Sprout className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No listings yet. Create your first listing!</p>
          <Link to="/farm/listings/new">
            <Button className="btn-gold mt-4">Create Listing</Button>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default MyListingsPage;
