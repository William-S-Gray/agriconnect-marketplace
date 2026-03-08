import { Link } from 'react-router-dom';
import { Search, ArrowRight, Sprout, Shield, Truck, Star, Users, ShoppingBag, MapPin } from 'lucide-react';
import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORIES, PROVINCES } from '@/lib/mock-data';

const HomePage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [province, setProvince] = useState('');

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
          <div className="max-w-2xl mx-auto flex flex-col sm:flex-row gap-3 bg-card/10 backdrop-blur-sm p-3 rounded-2xl border border-primary-foreground/20">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-foreground/60" />
              <Input
                placeholder="Search produce..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50 rounded-xl"
              />
            </div>
            <Select value={province} onValueChange={setProvince}>
              <SelectTrigger className="w-full sm:w-44 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground rounded-xl">
                <SelectValue placeholder="Province" />
              </SelectTrigger>
              <SelectContent className="neo-card border-none">
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
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES.map(cat => (
              <Link
                key={cat.name}
                to={`/browse?category=${cat.name}`}
                className="neo-flat flex items-center gap-2 px-5 py-2.5 rounded-full whitespace-nowrap hover:scale-[1.02] transition-all text-sm font-medium text-foreground"
              >
                <span className="text-lg">{cat.emoji}</span>
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* In Season Now - Empty State */}
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
          <div className="neo-card p-12 text-center">
            <Sprout className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">No produce listings yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Be the first farmer to list your harvest!</p>
            <Link to="/farmer/register">
              <Button className="btn-gold mt-4">Start Selling</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { icon: Sprout, title: 'Browse Fresh Produce', desc: 'Explore listings from verified Zimbabwe farms. Filter by crop, province, and delivery options.' },
              { icon: Shield, title: 'Pay Securely via EcoCash', desc: 'Your payment is held in escrow until you confirm delivery. Protected from both sides.' },
              { icon: Truck, title: 'Collect or Get Delivered', desc: 'Pick up at the farm or arrange delivery directly with the farmer. Fresh from field to table.' },
            ].map((step, i) => (
              <div key={i} className="neo-card p-8 flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl neo-inset flex items-center justify-center mb-4">
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
              { icon: Users, num: '0', label: 'Farmers' },
              { icon: ShoppingBag, num: '0', label: 'Listings' },
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

      {/* Featured Farmers - Empty State */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-8">Featured Farmers</h2>
          <div className="neo-card p-12 text-center">
            <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">No verified farmers yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Farmers will appear here once they are verified.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="neo-card p-12">
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-4">Are You a Farmer?</h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Join AgriConnect and sell your produce directly to buyers across Zimbabwe. No middlemen, fair prices, EcoCash payouts.
            </p>
            <Link to="/farmer/register">
              <Button className="btn-gold text-lg px-8 py-4 h-auto">List Your Harvest Free</Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HomePage;
