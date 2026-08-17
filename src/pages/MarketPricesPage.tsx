import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus as Flat } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PROVINCES, CATEGORIES } from '@/lib/mock-data';
import { SEED_PRICES } from '@/lib/seed-data';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#4f7c3f', '#7ab85a', '#a8d87f', '#c8e6a0', '#e8f5c8', '#f0f9e0', '#3d6b2f', '#5a9048', '#78b560'];

const MarketPricesPage = () => {
  const [provinceFilter, setProvinceFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const filtered = useMemo(() =>
    SEED_PRICES.filter(p =>
      (provinceFilter === 'all' || p.province === provinceFilter) &&
      (categoryFilter === 'all' || p.category === categoryFilter)
    ), [provinceFilter, categoryFilter]);

  // Build chart data — avg price per produce type
  const chartData = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filtered.forEach(p => {
      if (!map[p.produce_type]) map[p.produce_type] = { total: 0, count: 0 };
      map[p.produce_type].total += p.avg_price;
      map[p.produce_type].count += 1;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, price: +(v.total / v.count).toFixed(2) }))
      .sort((a, b) => b.price - a.price)
      .slice(0, 10);
  }, [filtered]);

  const trend = (min: number, max: number, avg: number) => {
    const spread = max - min;
    if (spread / avg < 0.15) return <Flat className="h-4 w-4 text-muted-foreground" />;
    if (avg > (min + max) / 2) return <TrendingUp className="h-4 w-4 text-fresh" />;
    return <TrendingDown className="h-4 w-4 text-destructive" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Current Market Prices</h1>
          <p className="text-muted-foreground mt-1">Zimbabwe agricultural produce prices — updated weekly · {SEED_PRICES.length} data points</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8">
          <Select value={provinceFilter} onValueChange={setProvinceFilter}>
            <SelectTrigger className="w-48 neo-flat border-none"><SelectValue placeholder="All Provinces" /></SelectTrigger>
            <SelectContent className="neo-card border-none">
              <SelectItem value="all">All Provinces</SelectItem>
              {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48 neo-flat border-none"><SelectValue placeholder="All Categories" /></SelectTrigger>
            <SelectContent className="neo-card border-none">
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c.name} value={c.name}>{c.emoji} {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="self-center text-xs text-muted-foreground">{filtered.length} records</span>
        </div>

        {/* Price chart */}
        {chartData.length > 0 && (
          <div className="neo-card p-6 mb-8">
            <h3 className="font-heading text-base font-semibold text-foreground mb-4">Average Price by Crop (USD / unit)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickFormatter={v => `$${v}`} />
                <Tooltip
                  formatter={(value: number) => [`$${value}`, 'Avg Price']}
                  contentStyle={{ background: 'var(--card)', border: 'none', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}
                  labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
                />
                <Bar dataKey="price" radius={[6, 6, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Price table */}
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
                  <th className="text-center p-4 text-sm font-semibold text-foreground hidden md:table-cell">Trend</th>
                  <th className="text-right p-4 text-sm font-semibold text-foreground hidden md:table-cell">Listings</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-muted-foreground">
                      No price data for the selected filters.
                    </td>
                  </tr>
                ) : filtered.map((p, i) => (
                  <tr key={p.id} className={`border-t border-border/30 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                    <td className="p-4 font-medium text-foreground text-sm">{p.produce_type}</td>
                    <td className="p-4 text-sm text-muted-foreground">{p.category}</td>
                    <td className="p-4 text-right font-mono font-bold text-accent">${p.avg_price.toFixed(2)}</td>
                    <td className="p-4 text-right font-mono text-sm text-muted-foreground hidden sm:table-cell">${p.min_price.toFixed(2)}</td>
                    <td className="p-4 text-right font-mono text-sm text-muted-foreground hidden sm:table-cell">${p.max_price.toFixed(2)}</td>
                    <td className="p-4 text-sm text-muted-foreground hidden md:table-cell">{p.province}</td>
                    <td className="p-4 text-center hidden md:table-cell">{trend(p.min_price, p.max_price, p.avg_price)}</td>
                    <td className="p-4 text-right text-sm text-muted-foreground hidden md:table-cell">{p.listings_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-4 text-center">
          Prices are indicative and sourced from active AgriConnect listings. Last updated: {new Date().toLocaleDateString('en-ZW')}.
        </p>
      </div>
      <Footer />
    </div>
  );
};

export default MarketPricesPage;
