import { Link } from 'react-router-dom';
import { Search, ArrowRight, Sprout, Shield, Truck, Star, Users, ShoppingBag, MapPin } from 'lucide-react';
import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ProduceCard } from '@/components/ProduceCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORIES, PROVINCES } from '@/lib/mock-data';
import { SEED_LISTINGS, SEED_FARMERS, DEMO_STATS } from '@/lib/seed-data';

const HomePage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [province, setProvince] = useState('');

  const featuredListings = SEED_LISTINGS.filter(l => l.status === 'ACTIVE').slice(0, 4);
  const featuredFarmers = SEED_FARMERS.filter(f => f.status === 'VERIFIED').slice(0, 3);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="hero-gradient text-primary-foreground py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm opacity-75 mb-3 font-medium tracking-wide uppercase">{greeting}, Zimbabwe 🌿</p>
          <h1 className="font-heading text-4xl md:text-6xl font-bold mb-4 leading-tight">
            Fresh From Zimbabwe's Farms.
          </h1>
          <p className="text-lg md:text-xl opacity-90 mb-8 max-w-2xl mx-auto">
            Buy direct from verified farmers. Better prices. Better freshness. No middlemen.
          </p>
          <div className="max-w-2xl mx-auto flex flex-col sm:flex-row gap-3 bg-card/10 backdrop-blur-sm p-3 rounded-2xl border border-primary-foreground/20">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-foreground/60" />
              <Input
                placeholder="Search produce (tomatoes, maize…)"
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
                {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
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
              <Link key={cat.name} to={`/browse?category=${cat.name}`}
                className="neo-flat flex items-center gap-2 px-5 py-2.5 rounded-full whitespace-nowrap hover:scale-[1.02] transition-all text-sm font-medium text-foreground"
              >
                <span className="text-lg">{cat.emoji}</span>{cat.name}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredListings.map(listing => (
              <ProduceCard key={listing.id} listing={listing} />
            ))}
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
              { icon: Shield, title: 'Pay Securely via EcoCash', desc: "Your payment is held in escrow until you confirm delivery. Zimbabwe's #1 mobile money, protected from both sides." },
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

      {/* Live stats — seeded data */}
      <section className="py-10 hero-gradient text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-3 gap-6 text-center">
            {[
              { icon: Users, num: DEMO_STATS.totalFarmers.toString(), label: 'Verified Farmers' },
              { icon: ShoppingBag, num: DEMO_STATS.totalListings.toString(), label: 'Active Listings' },
              { icon: MapPin, num: DEMO_STATS.totalProvinces.toString(), label: 'Provinces' },
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featuredFarmers.map(farmer => (
              <div key={farmer.id} className="neo-card p-6 flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl neo-inset flex items-center justify-center shrink-0 text-xl">
                  🧑‍🌾
                </div>
                <div className="min-w-0">
                  <h3 className="font-heading font-semibold text-foreground">{farmer.name}</h3>
                  <p className="text-xs text-muted-foreground">{farmer.farm_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">📍 {farmer.province}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <Star className="h-3.5 w-3.5 text-accent fill-accent" />
                    <span className="text-sm font-semibold text-foreground">{farmer.rating}</span>
                    <span className="text-xs text-muted-foreground">({farmer.total_reviews} reviews)</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why AgriConnect for Zimbabwe */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-4">Why AgriConnect for Zimbabwe</h2>
            <p className="text-muted-foreground mb-10">Built specifically for the Zimbabwean agricultural context — not a generic marketplace.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { emoji: '📱', title: 'EcoCash Native', desc: "Econet's EcoCash is Zimbabwe's dominant mobile money. We're built around it — not bolted on." },
              { emoji: '🏡', title: 'vs. WhatsApp Groups', desc: "Today farmers sell via WhatsApp. AgriConnect gives them a verified profile, escrow payments, and reach across 10 provinces." },
              { emoji: '💰', title: 'No Middlemen', desc: "Farmers typically earn 40–60% of crop value. Direct access to buyers means better margins for farmers and lower prices for buyers." },
              { emoji: '🌍', title: '10 Provinces', desc: "From Manicaland to Matabeleland, every verified Zimbabwean farmer and buyer can participate." },
            ].map((item, i) => (
              <div key={i} className="neo-card p-6">
                <span className="text-3xl mb-3 block">{item.emoji}</span>
                <h3 className="font-heading font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
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
