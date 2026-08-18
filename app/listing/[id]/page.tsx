import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Truck, Package, Calendar, ShieldCheck } from 'lucide-react';
import { sql } from '@/lib/db';
import { toListing, num, type ListingRow } from '@/lib/serialize';
import { optionalPageUser } from '@/lib/page-guard';
import { SiteNav } from '@/components/SiteNav';
import { Footer } from '@/components/Footer';
import { StatusBadge } from '@/components/StatusBadge';
import { PriceTag } from '@/components/PriceTag';
import { AddToCart } from './add-to-cart';

export const dynamic = 'force-dynamic';

export default async function ListingDetailPage({ params }: { params: { id: string } }) {
  // The id comes from the URL, so it is validated as a uuid before it reaches a
  // query — an invalid cast would otherwise surface as a 500.
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();

  const rows = await sql<ListingRow & {
    farm_name: string; farmer_name: string; farmer_status: string;
    rating: string; total_reviews: number; farmer_uuid: string;
  }>`
    SELECT l.id, l.farmer_id, l.title, l.description, l.category, l.produce_type,
           l.quantity_kg, l.quantity_unit, l.price_per_unit, l.currency, l.min_order_qty,
           l.harvest_date, l.available_from, l.available_until, l.photos, l.is_organic,
           l.is_available, l.province, l.district, l.delivery_options, l.views_count,
           l.status, l.created_at,
           f.id AS farmer_uuid, f.farm_name, f.name AS farmer_name,
           f.status AS farmer_status, f.rating, f.total_reviews
      FROM listings l
      JOIN farmers f ON f.id = l.farmer_id
     WHERE l.id = ${params.id}
     LIMIT 1
  `;

  const row = rows[0];
  if (!row) notFound();

  const listing = toListing(row);
  const session = await optionalPageUser();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />
      <main className="container mx-auto px-4 py-8 flex-1 max-w-4xl">
        <Link href="/browse" className="text-sm text-muted-foreground hover:text-primary">
          ← Back to browse
        </Link>

        <div className="grid gap-8 md:grid-cols-2 mt-6">
          <div className="neo-card rounded-2xl aspect-[4/3] flex items-center justify-center text-7xl">
            {categoryEmoji(listing.category)}
          </div>

          <div>
            <div className="flex gap-2 mb-3">
              {listing.is_organic && <StatusBadge type="organic" />}
              {row.farmer_status === 'VERIFIED' && <StatusBadge type="verified" />}
            </div>

            <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
              {listing.title}
            </h1>

            <div className="mt-3">
              <PriceTag price={listing.price_per_unit} unit={listing.quantity_unit} size="lg" />
            </div>

            <p className="text-sm text-muted-foreground mt-4">{listing.description}</p>

            <dl className="mt-6 space-y-2 text-sm">
              <Row icon={Package} label="Available" value={`${listing.quantity_kg} ${listing.quantity_unit}`} />
              <Row icon={MapPin} label="Location" value={`${listing.district}, ${listing.province}`} />
              <Row icon={Truck} label="Delivery" value={listing.delivery_options.join(', ') || 'Pickup'} />
              {listing.harvest_date && (
                <Row icon={Calendar} label="Harvested" value={listing.harvest_date} />
              )}
              <Row
                icon={ShieldCheck}
                label="Minimum order"
                value={`${listing.min_order_qty} ${listing.quantity_unit}`}
              />
            </dl>

            <div className="neo-flat rounded-xl p-4 mt-6">
              <p className="text-xs text-muted-foreground">Sold by</p>
              <Link href={`/farmer/${row.farmer_uuid}`} className="font-heading font-semibold text-foreground hover:text-primary">
                {row.farm_name}
              </Link>
              <p className="text-xs text-muted-foreground mt-1">
                {row.farmer_name} · ★ {num(row.rating).toFixed(1)} ({row.total_reviews} reviews)
              </p>
            </div>

            <div className="mt-6">
              <AddToCart
                listingId={listing.id}
                title={listing.title}
                unit={listing.quantity_unit}
                pricePerUnit={listing.price_per_unit}
                minOrder={listing.min_order_qty}
                maxAvailable={listing.quantity_kg}
                farmName={row.farm_name}
                canBuy={session?.role === 'buyer'}
                isAuthenticated={Boolean(session)}
              />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Row({
  icon: Icon, label, value,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

function categoryEmoji(category: string): string {
  const map: Record<string, string> = {
    Vegetables: '🥬', Fruits: '🍎', Grains: '🌾', Legumes: '🫘',
    Livestock: '🐄', Dairy: '🥛', Poultry: '🐔', Herbs: '🌿',
  };
  return map[category] ?? '🌱';
}
