import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Sprout, Package, DollarSign, Settings } from 'lucide-react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFarmerAuth } from '@/stores/auth-store';

const nav = [
  { icon: BarChart3, label: 'Dashboard', href: '/farm/dashboard' },
  { icon: Sprout, label: 'My Listings', href: '/farm/listings' },
  { icon: Package, label: 'Orders', href: '/farm/orders' },
  { icon: DollarSign, label: 'Earnings', href: '/farm/earnings' },
  { icon: Settings, label: 'Profile', href: '/farm/profile' },
];

const FarmerOrdersPage = () => {
  const { farmer, logout } = useFarmerAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');

  if (!farmer) { navigate('/login'); return null; }

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar nav={nav} userName={farmer.name} subtitle={farmer.farm_name} status={farmer.status === 'VERIFIED' ? 'verified' : 'pending'} onLogout={logout} />
      <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Orders</h1>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6 neo-flat">
            <TabsTrigger value="all">All (0)</TabsTrigger>
            <TabsTrigger value="PENDING">Pending (0)</TabsTrigger>
            <TabsTrigger value="CONFIRMED">Confirmed</TabsTrigger>
            <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="text-center py-16">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No orders found.</p>
        </div>
      </main>
    </div>
  );
};

export default FarmerOrdersPage;
