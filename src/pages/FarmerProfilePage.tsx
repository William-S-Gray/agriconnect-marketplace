import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';

const FarmerProfilePage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-20 text-center">
        <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="font-heading text-2xl font-bold text-foreground mb-2">Farmer Not Found</h1>
        <p className="text-muted-foreground mb-6">This farmer profile doesn't exist.</p>
        <Link to="/"><Button className="neo-btn bg-primary text-primary-foreground">Back Home</Button></Link>
      </div>
      <Footer />
    </div>
  );
};

export default FarmerProfilePage;
