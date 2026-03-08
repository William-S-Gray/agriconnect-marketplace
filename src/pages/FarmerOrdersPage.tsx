import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Sprout, Package, DollarSign, Settings, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFarmerAuth } from '@/stores/auth-store';
import { getOrdersByFarmer } from '@/lib/mock-data';

const nav = [
  { icon: BarChart3, label: 'Dashboard', href: '/farm/dashboard' },
  { icon: Sprout, label: 'My Listings', href: '/farm/listings' },
  { icon: Package, label: 'Orders', href: '/farm/orders' },
  { icon: DollarSign, label: 'Earnings', href: '/farm/earnings' },
  { icon: Settings, label: 'Profile', href: '/farm/profile' },
];

const statusMap: Record<string, 'order-pending' | 'confirmed' | 'in-season' | 'verified' | 'sold-out'> = {
  PENDING: 'order-pending', CONFIRMED: 'confirmed', IN_TRANSIT: 'in-season',
  DELIVERED: 'verified', COMPLETED: 'verified', DISPUTED: 'sold-out', CANCELLED: 'sold-out',
};

const FarmerOrdersPage = () => {
  const { farmer, logout } = useFarmerAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');

  if (!farmer) { navigate('/login'); return null; }

  const orders = getOrdersByFarmer(farmer.id);
  const filtered = tab === 'all' ? orders : orders.filter(o => o.status === tab);

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar nav={nav} userName={farmer.name} subtitle={farmer.farm_name} status={farmer.status === 'VERIFIED' ? 'verified' : 'pending'} onLogout={logout} />
      <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Orders</h1>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6 neo-flat">
            <TabsTrigger value="all">All ({orders.length})</TabsTrigger>
            <TabsTrigger value="PENDING">Pending ({orders.filter(o=>o.status==='PENDING').length})</TabsTrigger>
            <TabsTrigger value="CONFIRMED">Confirmed</TabsTrigger>
            <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-4">
          {filtered.map(order => (
            <div key={order.id} className="neo-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">Order #{order.id.toUpperCase()}</p>
                  <p className="font-heading font-semibold text-foreground mt-1">{order.produce_title}</p>
                </div>
                <StatusBadge type={statusMap[order.status] || 'pending'} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                <div><span className="text-muted-foreground">Buyer:</span> <span className="font-medium text-foreground">{order.buyer_name}</span></div>
                <div><span className="text-muted-foreground">Qty:</span> <span className="font-mono text-foreground">{order.quantity}</span></div>
                <div><span className="text-muted-foreground">Amount:</span> <span className="font-mono price-display">${order.total_amount.toFixed(2)}</span></div>
                <div><span className="text-muted-foreground">Delivery:</span> <span className="text-foreground">{order.delivery_method}</span></div>
              </div>
              <div className="flex gap-2">
                {order.status === 'PENDING' && <Button size="sm" className="neo-btn bg-primary text-primary-foreground">Confirm Order</Button>}
                {order.status === 'CONFIRMED' && <Button size="sm" className="neo-btn bg-primary text-primary-foreground">Mark Dispatched</Button>}
                <Button size="sm" variant="outline" className="neo-flat border-none"><MessageSquare className="h-3 w-3 mr-1" />Message</Button>
                {order.status === 'PENDING' && <Button size="sm" variant="outline" className="neo-flat border-none text-destructive">Cancel</Button>}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-muted-foreground text-center py-10">No orders found.</p>}
        </div>
      </main>
    </div>
  );
};

export default FarmerOrdersPage;
