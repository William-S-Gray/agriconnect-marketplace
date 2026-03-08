import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, DollarSign, Heart, Sprout } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { useBuyerAuth } from '@/stores/auth-store';

const BuyerDashboard = () => {
  const { buyer, isAuthenticated } = useBuyerAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-1">Welcome back, {buyer?.name} 👋</h1>
        <p className="text-muted-foreground text-sm mb-8">Your buying dashboard</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { icon: ShoppingBag, label: 'Orders Placed', value: 0 },
            { icon: DollarSign, label: 'Spent', value: '$0.00' },
            { icon: Heart, label: 'Saved Farmers', value: 0 },
          ].map((s, i) => (
            <div key={i} className="neo-card p-5 text-center">
              <s.icon className="h-5 w-5 mx-auto mb-2 text-primary" />
              <p className="font-mono text-xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Active orders - empty */}
        <h2 className="font-heading text-lg font-semibold text-foreground mb-4">Active Orders</h2>
        <p className="text-muted-foreground text-sm mb-8">No active orders. <Link to="/browse" className="text-primary hover:underline">Browse produce</Link></p>

        {/* Recently viewed - empty */}
        <h2 className="font-heading text-lg font-semibold text-foreground mb-4">Recently Viewed</h2>
        <div className="neo-card p-12 text-center">
          <Sprout className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No recently viewed listings. Start browsing to see produce here.</p>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default BuyerDashboard;
