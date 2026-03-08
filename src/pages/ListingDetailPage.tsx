import { Link } from 'react-router-dom';
import { Sprout } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';

const ListingDetailPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-20 text-center">
        <Sprout className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="font-heading text-2xl font-bold text-foreground mb-2">Listing Not Found</h1>
        <p className="text-muted-foreground mb-6">This listing doesn't exist or has been removed.</p>
        <Link to="/browse"><Button className="neo-btn bg-primary text-primary-foreground">Browse Produce</Button></Link>
      </div>
      <Footer />
    </div>
  );
};

export default ListingDetailPage;
