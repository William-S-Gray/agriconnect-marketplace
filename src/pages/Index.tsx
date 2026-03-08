import { Link } from 'react-router-dom';
import { Search, ArrowRight, Sprout, Shield, Truck, Star, Users, ShoppingBag, MapPin } from 'lucide-react';
import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ProduceCard } from '@/components/ProduceCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mockListings, mockFarmers, CATEGORIES, PROVINCES } from '@/lib/mock-data';

const HomePage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [province, setProvince] = useState('');
  const featuredListings = mockListings.filter(l => l.is_available).slice(0, 8);
  const verifiedFarmers = mockFarmers.filter(f => f.status === 'VERIFIED');

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="hero-gradient text-primary-foreground py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <h1 className="font-heading text-4xl md:text-6xl font-bold mb-4 leading-tight">
            Fresh From Zimbabwe's Farms.
          </h1>
          <p className="text-lg md:text-xl opacity-90 mb-8 max-w-2xl mx-auto">
            Buy direct from verified farmers. Better prices. Better freshness. No middlemen.
          </p>

          {/* Search bar */}
          <div className="max-w-2xl mx-auto flex flex-col sm:flex-row gap-3 bg-card/10 backdrop-blur-sm p-3 rounded-xl border border-primary-foreground/20">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-foreground/60" />
              <Input
                placeholder="Search produce..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
              />
            </div>
            <Select value={province} onValueChange={setProvince}>
              <SelectTrigger className="w-full sm:w-44 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
                <SelectValue placeholder="Province" />
              </SelectTrigger>
              <SelectContent>
                {PROVINCES.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link to={`/browse?q=${searchQuery}&province=${province}`}>
              <Button className="btn-gold w-full sm:w-auto">Search</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Category pills */}
      <section className="py-8 border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES.map(cat => (
              <Link
                key={cat.name}
                to={`/browse?category=${cat.name}`}
                className="flex items-center gap-2 px-5 py-2.5 bg-card border border-border rounded-full whitespace-nowrap hover:border-primary hover:bg-primary/5 transition-colors text-sm font-medium text-foreground"
              >
                <span className="text-lg">{cat.emoji}</span>
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* In Season Now */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground">In Season Now</h2>
              <p className="text-muted-foreground mt-1">Fresh harvest from Zimbabwe's farms</p>
            </div>
            <Link to="/browse" className="text-primary font-medium text-sm flex items-center gap-1 hover:underline">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {featuredListings.map(listing => (
              <ProduceCard key={listing.id} listing={listing} />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-card border-y border-border">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { icon: Sprout, title: 'Browse Fresh Produce', desc: 'Explore listings from verified Zimbabwe farms. Filter by crop, province, and delivery options.' },
              { icon: Shield, title: 'Pay Securely via EcoCash', desc: 'Your payment is held in escrow until you confirm delivery. Protected from both sides.' },
              { icon: Truck, title: 'Collect or Get Delivered', desc: 'Pick up at the farm or arrange delivery directly with the farmer. Fresh from field to table.' },
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <step.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm max-w-xs">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-10 hero-gradient text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-3 gap-6 text-center">
            {[
              { icon: Users, num: '500+', label: 'Farmers' },
              { icon: ShoppingBag, num: '1,200+', label: 'Listings' },
              { icon: MapPin, num: '10', label: 'Provinces' },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center">
                <s.icon className="h-6 w-6 mb-2 opacity-80" />
                <span className="font-heading text-2xl md:text-3xl font-bold">{s.num}</span>
                <span className="text-sm opacity-80">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Farmers */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-8">Featured Farmers</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {verifiedFarmers.map(farmer => (
              <Link
                key={farmer.id}
                to={`/farmer/${farmer.id}`}
                className="card-produce p-6 flex items-start gap-4"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-2xl">👨‍🌾</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-heading font-semibold text-foreground">{farmer.name}</h3>
                  <p className="text-sm text-muted-foreground">{farmer.farm_name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{farmer.province}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Star className="h-4 w-4 fill-accent text-accent" />
                    <span className="text-sm font-medium">{farmer.rating}</span>
                    <span className="text-xs text-muted-foreground">({farmer.total_reviews} reviews)</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-card border-t border-border">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-4">Are You a Farmer?</h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Join AgriConnect and sell your produce directly to buyers across Zimbabwe. No middlemen, fair prices, EcoCash payouts.
          </p>
          <Link to="/farmer/register">
            <Button className="btn-gold text-lg px-8 py-4 h-auto">List Your Harvest Free</Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HomePage;
