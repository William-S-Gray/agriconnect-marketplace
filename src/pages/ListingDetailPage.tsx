import { useParams, Link } from 'react-router-dom';
import { Star, MapPin, Calendar, Leaf, Truck, Package, ChevronRight, Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { StatusBadge } from '@/components/StatusBadge';
import { PriceTag } from '@/components/PriceTag';
import { Button } from '@/components/ui/button';
import { getListingById, getFarmerById, getReviewsByFarmer, calculateOrder } from '@/lib/mock-data';
import { useBuyerAuth } from '@/stores/auth-store';
import { toast } from 'sonner';

const ListingDetailPage = () => {
  const { id } = useParams();
  const listing = getListingById(id || '');
  const farmer = listing ? getFarmerById(listing.farmer_id) : null;
  const reviews = farmer ? getReviewsByFarmer(farmer.id) : [];
  const buyerAuth = useBuyerAuth();
  const [quantity, setQuantity] = useState(listing?.min_order_qty || 1);
  const [deliveryMethod, setDeliveryMethod] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');

  if (!listing || !farmer) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="font-heading text-2xl text-foreground">Listing not found</h1>
          <Link to="/browse" className="text-primary mt-4 inline-block">Back to Browse</Link>
        </div>
      </div>
    );
  }

  const order = calculateOrder(quantity, listing.price_per_unit);

  const handleAddToCart = () => {
    buyerAuth.addToCart({
      listingId: listing.id,
      title: listing.title,
      farmerName: farmer.farm_name,
      farmerId: farmer.id,
      pricePerUnit: listing.price_per_unit,
      quantity,
      unit: listing.quantity_unit,
      maxAvailable: listing.quantity_kg,
    });
    toast.success('Added to cart!');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Breadcrumb */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to={`/browse?category=${listing.category}`} className="hover:text-foreground">{listing.category}</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{listing.produce_type}</span>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-12">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Photos */}
          <div className="lg:col-span-3">
            <div className="neo-card rounded-2xl overflow-hidden h-64 md:h-96 flex items-center justify-center bg-gradient-to-br from-primary/10 to-fresh/10">
              <span className="text-8xl opacity-50">
                {listing.category === 'Vegetables' ? '🥬' : listing.category === 'Fruits' ? '🍎' : listing.category === 'Grains' ? '🌾' : '🫘'}
              </span>
            </div>
          </div>

          {/* Order Panel */}
          <div className="lg:col-span-2">
            <div className="neo-card p-6 sticky top-20 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {listing.is_organic && <StatusBadge type="in-season" />}
                  {farmer.status === 'VERIFIED' && <StatusBadge type="verified" />}
                  {farmer.status === 'PENDING' && <StatusBadge type="pending" />}
                </div>
                <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground">{listing.title}</h1>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className={`h-4 w-4 ${s <= Math.round(farmer.rating) ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`} />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">({farmer.total_reviews} reviews)</span>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <PriceTag price={listing.price_per_unit} unit={listing.quantity_unit} size="lg" />
                <p className="text-sm text-muted-foreground mt-1">
                  {listing.quantity_kg} {listing.quantity_unit} available · Min order: {listing.min_order_qty} {listing.quantity_unit}
                </p>
              </div>

              {/* Quantity */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Quantity ({listing.quantity_unit})</label>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="icon" className="neo-flat border-none" onClick={() => setQuantity(Math.max(listing.min_order_qty, quantity - 1))}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="font-mono text-lg font-bold w-16 text-center text-foreground">{quantity}</span>
                  <Button variant="outline" size="icon" className="neo-flat border-none" onClick={() => setQuantity(Math.min(listing.quantity_kg, quantity + 1))}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Order summary */}
              <div className="neo-inset p-4 space-y-2 text-sm">
                <div className="flex justify-between text-foreground"><span>Subtotal</span><span className="font-mono font-semibold">${order.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Platform fee (5%)</span><span className="font-mono">${order.platformFee.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold border-t border-border pt-2 text-foreground"><span>Total</span><span className="font-mono text-accent">${order.total.toFixed(2)}</span></div>
              </div>

              {/* Delivery */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Delivery Method</label>
                <div className="space-y-2">
                  {listing.delivery_options.map(opt => (
                    <label key={opt} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                      deliveryMethod === opt ? 'neo-inset' : 'neo-flat'
                    }`}>
                      <input type="radio" name="delivery" checked={deliveryMethod === opt} onChange={() => setDeliveryMethod(opt as 'PICKUP' | 'DELIVERY')} className="accent-primary" />
                      {opt === 'PICKUP' ? <Package className="h-4 w-4 text-muted-foreground" /> : <Truck className="h-4 w-4 text-fresh" />}
                      <span className="text-sm text-foreground">{opt === 'PICKUP' ? 'Pickup at farm' : 'Delivery (negotiated)'}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Button className="w-full neo-btn bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleAddToCart}>
                  Add to Cart
                </Button>
                <Button className="w-full btn-gold">Buy Now via EcoCash</Button>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-2"><MapPin className="h-3 w-3" />{listing.district}, {listing.province}</div>
                {listing.harvest_date && <div className="flex items-center gap-2"><Calendar className="h-3 w-3" />Harvest: {listing.harvest_date}</div>}
                <div className="flex items-center gap-2"><Leaf className="h-3 w-3" />{listing.is_organic ? 'Organic' : 'Conventional'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Farmer info */}
        <div className="mt-10 neo-card p-6">
          <Link to={`/farmer/${farmer.id}`} className="flex items-center gap-4 group">
            <div className="w-14 h-14 rounded-full neo-inset flex items-center justify-center shrink-0">
              <span className="text-2xl">👨‍🌾</span>
            </div>
            <div className="flex-1">
              <h3 className="font-heading font-semibold text-foreground group-hover:text-primary transition-colors">{farmer.name}</h3>
              <p className="text-sm text-muted-foreground">{farmer.farm_name} · {farmer.province}</p>
              <div className="flex items-center gap-2 mt-1">
                <Star className="h-4 w-4 fill-accent text-accent" />
                <span className="text-sm font-medium text-foreground">{farmer.rating}</span>
                <span className="text-xs text-muted-foreground">{farmer.total_reviews} reviews · {farmer.total_sales > 0 ? `$${farmer.total_sales} in sales` : ''}</span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="neo-flat border-none">View Profile</Button>
          </Link>
        </div>

        {/* Description */}
        {listing.description && (
          <div className="mt-6">
            <h2 className="font-heading text-lg font-semibold text-foreground mb-3">Description</h2>
            <p className="text-muted-foreground">{listing.description}</p>
          </div>
        )}

        {/* Reviews */}
        <div className="mt-10">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-4">Reviews</h2>
          {reviews.length === 0 ? (
            <p className="text-muted-foreground">No reviews yet.</p>
          ) : (
            <div className="space-y-4">
              {reviews.map(review => (
                <div key={review.id} className="neo-flat p-4 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className={`h-3 w-3 ${s <= review.rating ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`} />
                    ))}
                  </div>
                  <p className="text-sm text-foreground">{review.comment}</p>
                  <p className="text-xs text-muted-foreground mt-2">— {review.buyer_name}, {review.buyer_city}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ListingDetailPage;
