import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ProduceCard } from '@/components/ProduceCard';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mockListings, CATEGORIES, PROVINCES } from '@/lib/mock-data';

const BrowsePage = () => {
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || '';
  const initialQuery = searchParams.get('q') || '';

  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategory ? [initialCategory] : []);
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState([0, 10]);
  const [organicOnly, setOrganicOnly] = useState(false);
  const [deliveryFilter, setDeliveryFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('newest');
  const [mobileFilters, setMobileFilters] = useState(false);
  const [query] = useState(initialQuery);

  const toggleArray = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

  const filteredListings = useMemo(() => {
    let results = mockListings.filter(l => l.is_available && l.status === 'ACTIVE');
    if (query) results = results.filter(l => l.title.toLowerCase().includes(query.toLowerCase()));
    if (selectedCategories.length) results = results.filter(l => selectedCategories.includes(l.category));
    if (selectedProvinces.length) results = results.filter(l => selectedProvinces.includes(l.province));
    if (organicOnly) results = results.filter(l => l.is_organic);
    if (deliveryFilter.length) results = results.filter(l => deliveryFilter.some(d => l.delivery_options.includes(d)));
    results = results.filter(l => l.price_per_unit >= priceRange[0] && l.price_per_unit <= priceRange[1]);
    if (sortBy === 'price-low') results.sort((a, b) => a.price_per_unit - b.price_per_unit);
    if (sortBy === 'price-high') results.sort((a, b) => b.price_per_unit - a.price_per_unit);
    if (sortBy === 'newest') results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return results;
  }, [selectedCategories, selectedProvinces, priceRange, organicOnly, deliveryFilter, sortBy, query]);

  const activeCount = selectedCategories.length + selectedProvinces.length + (organicOnly ? 1 : 0) + deliveryFilter.length;

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedProvinces([]);
    setPriceRange([0, 10]);
    setOrganicOnly(false);
    setDeliveryFilter([]);
  };

  const FilterPanel = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-heading font-semibold text-foreground mb-3 text-sm">Category</h3>
        <div className="space-y-2">
          {CATEGORIES.map(cat => (
            <label key={cat.name} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={selectedCategories.includes(cat.name)}
                onCheckedChange={() => setSelectedCategories(prev => toggleArray(prev, cat.name))}
              />
              <span className="text-sm text-foreground">{cat.emoji} {cat.name}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-heading font-semibold text-foreground mb-3 text-sm">Province</h3>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {PROVINCES.map(p => (
            <label key={p} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={selectedProvinces.includes(p)}
                onCheckedChange={() => setSelectedProvinces(prev => toggleArray(prev, p))}
              />
              <span className="text-sm text-foreground">{p}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-heading font-semibold text-foreground mb-3 text-sm">Price Range (USD/unit)</h3>
        <Slider value={priceRange} onValueChange={setPriceRange} min={0} max={10} step={0.1} className="mb-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>${priceRange[0].toFixed(2)}</span>
          <span>${priceRange[1].toFixed(2)}</span>
        </div>
      </div>
      <div>
        <h3 className="font-heading font-semibold text-foreground mb-3 text-sm">Delivery</h3>
        <div className="space-y-2">
          {['PICKUP', 'DELIVERY'].map(d => (
            <label key={d} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={deliveryFilter.includes(d)}
                onCheckedChange={() => setDeliveryFilter(prev => toggleArray(prev, d))}
              />
              <span className="text-sm text-foreground">{d === 'PICKUP' ? '📍 Pickup' : '🚗 Delivery'}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Organic Only</span>
        <Switch checked={organicOnly} onCheckedChange={setOrganicOnly} />
      </div>
      <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full text-muted-foreground">
        Clear all filters
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Browse Produce</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Showing {filteredListings.length} results {query && `for "${query}"`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-36 neo-flat border-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="neo-card border-none">
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price-low">Price: Low</SelectItem>
                <SelectItem value="price-high">Price: High</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="md:hidden neo-flat border-none"
              onClick={() => setMobileFilters(true)}
            >
              <SlidersHorizontal className="h-4 w-4 mr-1" />
              Filters {activeCount > 0 && `(${activeCount})`}
            </Button>
          </div>
        </div>

        <div className="flex gap-8">
          <aside className="hidden md:block w-64 shrink-0">
            <div className="sticky top-20 neo-card p-5">
              <FilterPanel />
            </div>
          </aside>

          <div className="flex-1">
            {filteredListings.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <p className="text-lg">No produce found matching your filters.</p>
                <Button variant="link" onClick={clearFilters} className="text-primary mt-2">Clear filters</Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {filteredListings.map(listing => (
                  <ProduceCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {mobileFilters && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => setMobileFilters(false)} />
          <div className="absolute bottom-0 left-0 right-0 neo-card rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold text-foreground">Filters</h3>
              <button onClick={() => setMobileFilters(false)}><X className="h-5 w-5 text-foreground" /></button>
            </div>
            <FilterPanel />
            <Button className="w-full mt-4 neo-btn bg-primary text-primary-foreground" onClick={() => setMobileFilters(false)}>
              Show {filteredListings.length} results
            </Button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default BrowsePage;
