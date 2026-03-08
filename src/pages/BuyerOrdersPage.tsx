import { useNavigate, Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { StatusBadge } from '@/components/StatusBadge';
import { OrderTimeline } from '@/components/OrderTimeline';
import { useBuyerAuth } from '@/stores/auth-store';
import { getOrdersByBuyer } from '@/lib/mock-data';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';

const statusMap: Record<string, 'order-pending' | 'confirmed' | 'in-season' | 'verified' | 'sold-out'> = {
  PENDING: 'order-pending', CONFIRMED: 'confirmed', IN_TRANSIT: 'in-season',
  DELIVERED: 'verified', COMPLETED: 'verified', DISPUTED: 'sold-out', CANCELLED: 'sold-out',
};

const BuyerOrdersPage = () => {
  const { buyer, isAuthenticated } = useBuyerAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');

  if (!isAuthenticated) { navigate('/buyer/login'); return null; }

  const orders = getOrdersByBuyer('b1');
  const filtered = tab === 'all' ? orders : orders.filter(o => o.status === tab);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-6">My Orders</h1>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="all">All ({orders.length})</TabsTrigger>
            <TabsTrigger value="PENDING">Pending</TabsTrigger>
            <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-4">
          {filtered.map(order => (
            <div key={order.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-heading font-semibold text-foreground">{order.produce_title}</p>
                  <p className="font-mono text-xs text-muted-foreground">Order #{order.id.toUpperCase()} · {order.created_at}</p>
                </div>
                <StatusBadge type={statusMap[order.status] || 'pending'} />
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm mb-4">
                <div><span className="text-muted-foreground">Qty:</span> <span className="font-mono">{order.quantity}</span></div>
                <div><span className="text-muted-foreground">Total:</span> <span className="font-mono price-display">${order.total_amount.toFixed(2)}</span></div>
                <div><span className="text-muted-foreground">Delivery:</span> {order.delivery_method}</div>
              </div>
              <OrderTimeline status={order.status} />
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No orders found. <Link to="/browse" className="text-primary hover:underline">Browse produce</Link></p>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default BuyerOrdersPage;
