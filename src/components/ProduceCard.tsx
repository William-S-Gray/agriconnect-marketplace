import { Link } from 'react-router-dom';
import { MapPin, Truck, Package } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { PriceTag } from '@/components/PriceTag';
import type { ProduceListing } from '@/lib/mock-data';

interface ProduceCardProps {
  listing: ProduceListing;
}

export function ProduceCard({ listing }: ProduceCardProps) {
  const status = listing.quantity_kg < 20 ? 'limited' : listing.status === 'SOLD_OUT' ? 'sold-out' : 'in-season';
  const categoryEmoji: Record<string, string> = {
    Vegetables: '🥬', Fruits: '🍎', Grains: '🌾', Legumes: '🫘',
    Livestock: '🐄', Dairy: '🥛', Poultry: '🐔', Herbs: '🌿',
  };

  return (
    <Link to={`/listing/${listing.id}`} className="group">
      <div className="neo-card rounded-2xl overflow-hidden transition-all duration-300 group-hover:translate-y-[-4px]">
        <div className="h-40 md:h-48 bg-gradient-to-br from-primary/10 to-fresh/10 flex items-center justify-center relative">
          <span className="text-5xl md:text-6xl opacity-60">{categoryEmoji[listing.category] || '🌱'}</span>
          <div className="absolute top-3 left-3 flex gap-1.5">
            <StatusBadge type={status} />
            {listing.is_organic && <StatusBadge type="organic" />}
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-heading font-semibold text-foreground text-sm line-clamp-1 mb-1">{listing.title}</h3>
          <PriceTag price={listing.price_per_unit} unit={listing.quantity_unit} />
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {listing.province}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span>{listing.quantity_kg} {listing.quantity_unit}</span>
            <span className="flex items-center gap-0.5">
              {listing.delivery_options.includes('DELIVERY') && <Truck className="h-3 w-3" />}
              {listing.delivery_options.includes('PICKUP') && <Package className="h-3 w-3" />}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
