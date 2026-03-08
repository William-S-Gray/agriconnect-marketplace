import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, Sprout, Package, DollarSign, Settings, Plus, Eye, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { useFarmerAuth } from '@/stores/auth-store';
import { getListingsByFarmer } from '@/lib/mock-data';

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

  if (!farmer) { navigate('/farmer/login'); return null; }

  const listings = getListingsByFarmer(farmer.id);

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar nav={nav} userName={farmer.name} subtitle={farmer.farm_name} status={farmer.status === 'VERIFIED' ? 'verified' : 'pending'} onLogout={logout} />
      <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-heading text-2xl font-bold text-foreground">My Listings</h1>
          <Link to="/farm/listings/new">
            <Button className="bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-1" />New Listing</Button>
          </Link>
        </div>

        {listings.length === 0 ? (
          <div className="text-center py-16">
            <Sprout className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No listings yet. Create your first listing!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {listings.map(l => (
              <div key={l.id} className="bg-card border border-border rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-heading font-semibold text-foreground">{l.title}</h3>
                    <StatusBadge type={l.status === 'ACTIVE' ? 'in-season' : l.status === 'SOLD_OUT' ? 'sold-out' : 'pending'} />
                    {l.is_organic && <StatusBadge type="organic" />}
                  </div>
                  <p className="text-sm text-muted-foreground">{l.category} · {l.quantity_kg} {l.quantity_unit} available</p>
                  <p className="price-display text-base mt-1">${l.price_per_unit.toFixed(2)} <span className="text-muted-foreground text-xs font-normal">/ {l.quantity_unit}</span></p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" />{l.views_count}</span>
                  <Link to={`/listing/${l.id}`}><Button size="sm" variant="outline"><Eye className="h-3 w-3 mr-1" />View</Button></Link>
                  <Button size="sm" variant="outline"><Edit className="h-3 w-3 mr-1" />Edit</Button>
                  <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyListingsPage;
