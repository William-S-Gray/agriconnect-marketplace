import { Link, Navigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { useBuyerAuth } from '@/stores/auth-store';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingBag } from 'lucide-react';
import { useState } from 'react';

const BuyerOrdersPage = () => {
  const { isAuthenticated } = useBuyerAuth();
  const [tab, setTab] = useState('all');

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-6">My Orders</h1>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6 neo-flat">
            <TabsTrigger value="all">All (0)</TabsTrigger>
            <TabsTrigger value="PENDING">Pending</TabsTrigger>
            <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="text-center py-16">
          <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">No orders found.</p>
          <Link to="/browse" className="text-primary hover:underline text-sm mt-2 inline-block">Browse produce</Link>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default BuyerOrdersPage;
