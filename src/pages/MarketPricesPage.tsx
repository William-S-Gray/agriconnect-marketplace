import { useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PROVINCES, CATEGORIES } from '@/lib/mock-data';

const MarketPricesPage = () => {
  const [provinceFilter, setProvinceFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Current Market Prices</h1>
          <p className="text-muted-foreground mt-1">Zimbabwe agricultural produce prices — updated weekly</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8">
          <Select value={provinceFilter} onValueChange={setProvinceFilter}>
            <SelectTrigger className="w-44 neo-flat border-none"><SelectValue placeholder="Province" /></SelectTrigger>
            <SelectContent className="neo-card border-none">
              <SelectItem value="all">All Provinces</SelectItem>
              {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44 neo-flat border-none"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent className="neo-card border-none">
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c.name} value={c.name}>{c.emoji} {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Empty Table */}
        <div className="neo-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="neo-inset">
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Crop</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Category</th>
                  <th className="text-right p-4 text-sm font-semibold text-foreground">Avg Price</th>
                  <th className="text-right p-4 text-sm font-semibold text-foreground hidden sm:table-cell">Min</th>
                  <th className="text-right p-4 text-sm font-semibold text-foreground hidden sm:table-cell">Max</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground hidden md:table-cell">Province</th>
                  <th className="text-right p-4 text-sm font-semibold text-foreground hidden md:table-cell">Listings</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground">
                    No price data available yet. Prices will populate as listings are added.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Price trends placeholder */}
        <div className="mt-10 neo-card p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <TrendingUp className="h-6 w-6 text-fresh" />
            <TrendingDown className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="font-heading text-lg font-semibold text-foreground">Price Trends</h3>
          <p className="text-muted-foreground text-sm mt-2">Interactive price trend charts coming soon. Track weekly price movements for each crop.</p>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default MarketPricesPage;
