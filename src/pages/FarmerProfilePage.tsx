import { useParams, Link } from 'react-router-dom';
import { Star, MapPin, CheckCircle } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ProduceCard } from '@/components/ProduceCard';
import { StatusBadge } from '@/components/StatusBadge';
import { getFarmerById, getListingsByFarmer, getReviewsByFarmer } from '@/lib/mock-data';

const FarmerProfilePage = () => {
  const { id } = useParams();
  const farmer = getFarmerById(id || '');
  const listings = farmer ? getListingsByFarmer(farmer.id) : [];
  const reviews = farmer ? getReviewsByFarmer(farmer.id) : [];

  if (!farmer) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="font-heading text-2xl text-foreground">Farmer not found</h1>
          <Link to="/" className="text-primary mt-4 inline-block">Back home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Profile header */}
      <div className="hero-gradient text-primary-foreground py-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-primary-foreground/20 flex items-center justify-center shrink-0">
            <span className="text-5xl">👨‍🌾</span>
          </div>
          <div className="text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <h1 className="font-heading text-3xl font-bold">{farmer.name}</h1>
              {farmer.status === 'VERIFIED' && <CheckCircle className="h-6 w-6 text-accent" />}
            </div>
            <p className="text-lg opacity-90">{farmer.farm_name}</p>
            <div className="flex items-center gap-4 mt-2 justify-center md:justify-start opacity-80 text-sm">
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{farmer.district}, {farmer.province}</span>
              {farmer.farm_size_ha && <span>{farmer.farm_size_ha} hectares</span>}
            </div>
            <div className="flex items-center gap-2 mt-3 justify-center md:justify-start">
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} className={`h-5 w-5 ${s <= Math.round(farmer.rating) ? 'fill-accent text-accent' : 'text-primary-foreground/30'}`} />
                ))}
              </div>
              <span className="font-medium">{farmer.rating}</span>
              <span className="opacity-70">({farmer.total_reviews} reviews)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { label: 'Total Sales', value: `$${farmer.total_sales.toLocaleString()}` },
            { label: 'Active Listings', value: listings.filter(l => l.status === 'ACTIVE').length },
            { label: 'Reviews', value: farmer.total_reviews },
          ].map((s, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="font-mono text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Listings */}
        <h2 className="font-heading text-xl font-bold text-foreground mb-6">Produce Listings</h2>
        {listings.length === 0 ? (
          <p className="text-muted-foreground">No listings yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {listings.map(l => <ProduceCard key={l.id} listing={l} />)}
          </div>
        )}

        {/* Reviews */}
        <h2 className="font-heading text-xl font-bold text-foreground mt-12 mb-6">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-muted-foreground">No reviews yet.</p>
        ) : (
          <div className="space-y-4">
            {reviews.map(r => (
              <div key={r.id} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-1 mb-2">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} className={`h-3 w-3 ${s <= r.rating ? 'fill-accent text-accent' : 'text-border'}`} />
                  ))}
                </div>
                <p className="text-sm text-foreground">{r.comment}</p>
                <p className="text-xs text-muted-foreground mt-2">— {r.buyer_name}, {r.buyer_city}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default FarmerProfilePage;
