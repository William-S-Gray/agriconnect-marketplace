import { Link } from 'react-router-dom';
import { MapPin, Leaf, Truck, Package, Star } from 'lucide-react';
import type { ProduceListing } from '@/lib/mock-data';
import { getFarmerById } from '@/lib/mock-data';

interface ProduceCardProps {
  listing: ProduceListing;
}

const categoryColors: Record<string, string> = {
  Vegetables: 'bg-primary/10 text-primary',
  Fruits: 'bg-warning/10 text-warning',
  Grains: 'bg-accent/10 text-accent-dark',
  Legumes: 'bg-earth/10 text-earth',
  Livestock: 'bg-earth/10 text-earth',
  Dairy: 'bg-muted text-muted-foreground',
  Poultry: 'bg-warning/10 text-warning',
  Herbs: 'bg-fresh/10 text-fresh',
};

export function ProduceCard({ listing }: ProduceCardProps) {
  const farmer = getFarmerById(listing.farmer_id);
  const isLimited = listing.quantity_kg < 20;

  return (
    <Link to={`/listing/${listing.id}`} className="card-produce block group">
      {/* Image placeholder */}
      <div className="h-48 bg-gradient-to-br from-primary/10 to-fresh/10 relative flex items-center justify-center overflow-hidden">
        <span className="text-6xl opacity-60">
          {listing.category === 'Vegetables' ? '🥬' :
           listing.category === 'Fruits' ? '🍎' :
           listing.category === 'Grains' ? '🌾' :
           listing.category === 'Legumes' ? '🫘' : '🌿'}
        </span>

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          <span className={`badge-status text-[10px] ${categoryColors[listing.category] || 'bg-muted text-muted-foreground'}`}>
            {listing.category}
          </span>
          {listing.is_organic && (
            <span className="badge-organic text-[10px]">
              <Leaf className="h-3 w-3 mr-1" />Organic
            </span>
          )}
        </div>

        {isLimited && (
          <span className="absolute top-3 right-3 badge-limited text-[10px]">Limited</span>
        )}

        {listing.status === 'SOLD_OUT' && (
          <div className="absolute inset-0 bg-foreground/50 flex items-center justify-center">
            <span className="badge-sold-out text-sm">Sold Out</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <h3 className="font-heading font-semibold text-foreground text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {listing.title}
        </h3>

        <div className="flex items-baseline justify-between">
          <span className="price-display text-lg">${listing.price_per_unit.toFixed(2)}</span>
          <span className="text-muted-foreground text-xs">/ {listing.quantity_unit}</span>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span>{listing.district}, {listing.province}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>{listing.quantity_kg} {listing.quantity_unit} available</span>
            <div className="flex items-center gap-1">
              {listing.delivery_options.includes('DELIVERY') && <Truck className="h-3 w-3 text-fresh" />}
              {listing.delivery_options.includes('PICKUP') && <Package className="h-3 w-3 text-muted-foreground" />}
            </div>
          </div>
        </div>

        {farmer && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">{farmer.farm_name}</span>
            {farmer.rating > 0 && (
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-accent text-accent" />
                <span className="text-xs font-medium text-foreground">{farmer.rating}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
