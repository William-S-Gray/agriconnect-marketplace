import { Link } from 'react-router-dom';
import { ShoppingBag, DollarSign, Heart, Sprout, ArrowRight, Package } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useBuyerAuth } from '@/stores/auth-store';
import { SEED_ORDERS, SEED_LISTINGS } from '@/lib/seed-data';
import { Button } from '@/components/ui/button';

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
  CONFIRMED: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  IN_TRANSIT: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
  COMPLETED: 'text-green-600 bg-green-50 dark:bg-green-900/20',
  DISPUTED: 'text-red-600 bg-red-50 dark:bg-red-900/20',
};

function BuyerDashboardInner() {
  const { buyer } = useBuyerAuth();

  const myOrders = SEED_ORDERS.filter(o => o.buyer_id === buyer?.id || buyer?.id?.startsWith('buyer'));
  const totalSpent = myOrders.reduce((s, o) => s + o.total_amount, 0);
  const activeOrders = myOrders.filter(o => !['COMPLETED', 'CANCELLED'].includes(o.status));
  const recommended = SEED_LISTINGS.filter(l => l.status === 'ACTIVE').slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-1">
          Welcome back, {buyer?.name} 👋
        </h1>
        <p className="text-muted-foreground text-sm mb-8">Your buying dashboard</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { icon: ShoppingBag, label: 'Orders Placed', value: myOrders.length },
            { icon: DollarSign, label: 'Total Spent', value: `$${totalSpent.toFixed(2)}` },
            { icon: Heart, label: 'Saved Farmers', value: 2 },
          ].map((s, i) => (
            <div key={i} className="neo-card p-5 text-center">
              <s.icon className="h-5 w-5 mx-auto mb-2 text-primary" />
              <p className="font-mono text-xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Active Orders */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-semibold text-foreground">Active Orders</h2>
            <Link to="/buyer/orders" className="text-primary text-sm flex items-center gap-1 hover:underline">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {activeOrders.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No active orders.{' '}
              <Link to="/browse" className="text-primary hover:underline">Browse produce</Link>
            </p>
          ) : (
            <div className="space-y-3">
              {activeOrders.map(order => (
                <div key={order.id} className="neo-card p-4 flex items-center justify-between gap-4">
                  <div className="w-10 h-10 rounded-xl neo-inset flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm line-clamp-1">{order.produce_title}</p>
                    <p className="text-xs text-muted-foreground">From {order.farmer_name} · Ref: {order.id.toUpperCase()}</p>
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

        {/* Recommended produce */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-semibold text-foreground">Recommended For You</h2>
            <Link to="/browse" className="text-primary text-sm flex items-center gap-1 hover:underline">
              Browse all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {recommended.map(listing => (
              <div key={listing.id} className="neo-card p-4 flex flex-col gap-2">
                <div className="w-full h-24 rounded-xl neo-inset flex items-center justify-center text-4xl">🥬</div>
                <p className="font-medium text-foreground text-sm line-clamp-1">{listing.title}</p>
                <p className="text-xs text-muted-foreground">{listing.province}</p>
                <div className="flex items-center justify-between mt-auto">
                  <span className="font-mono font-bold text-accent">${listing.price_per_unit.toFixed(2)}/{listing.quantity_unit}</span>
                  <Link to={`/browse`}>
                    <Button size="sm" variant="outline" className="neo-flat border-none text-xs h-7">View</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

const BuyerDashboard = () => (
  <ProtectedRoute role="buyer">
    <BuyerDashboardInner />
  </ProtectedRoute>
);

export default BuyerDashboard;
