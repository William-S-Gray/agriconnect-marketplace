import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, DollarSign, Heart } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { OrderTimeline } from '@/components/OrderTimeline';
import { useBuyerAuth } from '@/stores/auth-store';
import { mockOrders, mockListings } from '@/lib/mock-data';

const BuyerDashboard = () => {
  const { buyer, isAuthenticated } = useBuyerAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  const buyerOrders = mockOrders.filter(o => o.buyer_id === 'b1');
  const activeOrders = buyerOrders.filter(o => !['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(o.status));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-1">Welcome back, {buyer?.name} 👋</h1>
        <p className="text-muted-foreground text-sm mb-8">Your buying dashboard</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { icon: ShoppingBag, label: 'Orders Placed', value: buyerOrders.length },
            { icon: DollarSign, label: 'Spent', value: '$' + buyerOrders.reduce((s, o) => s + o.total_amount, 0).toFixed(2) },
            { icon: Heart, label: 'Saved Farmers', value: 3 },
          ].map((s, i) => (
            <div key={i} className="neo-card p-5 text-center">
              <s.icon className="h-5 w-5 mx-auto mb-2 text-primary" />
              <p className="font-mono text-xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Active orders */}
        <h2 className="font-heading text-lg font-semibold text-foreground mb-4">Active Orders</h2>
        {activeOrders.length === 0 ? (
          <p className="text-muted-foreground text-sm mb-8">No active orders. <Link to="/browse" className="text-primary hover:underline">Browse produce</Link></p>
        ) : (
          <div className="space-y-4 mb-10">
            {activeOrders.map(order => (
              <div key={order.id} className="neo-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-semibold text-foreground text-sm">{order.produce_title}</p>
                    <p className="text-xs text-muted-foreground">Order #{order.id.toUpperCase()} · {order.quantity} units · ${order.total_amount.toFixed(2)}</p>
                  </div>
                </div>
                <OrderTimeline status={order.status} />
              </div>
            ))}
          </div>
        )}

        {/* Recently viewed */}
        <h2 className="font-heading text-lg font-semibold text-foreground mb-4">Recently Viewed</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {mockListings.slice(0, 6).map(l => (
            <Link key={l.id} to={`/listing/${l.id}`} className="neo-flat p-4 rounded-xl hover:scale-[1.02] transition-all">
              <h3 className="font-heading font-semibold text-foreground text-sm mb-1 line-clamp-1">{l.title}</h3>
              <p className="price-display text-sm">${l.price_per_unit.toFixed(2)} <span className="text-muted-foreground text-xs font-normal">/ {l.quantity_unit}</span></p>
              <p className="text-xs text-muted-foreground mt-1">{l.province}</p>
            </Link>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default BuyerDashboard;
