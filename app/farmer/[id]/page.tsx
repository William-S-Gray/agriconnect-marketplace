import { notFound } from 'next/navigation';
import { MapPin, Star, Package } from 'lucide-react';
import { sql } from '@/lib/db';
import { toListing, num, iso, type ListingRow } from '@/lib/serialize';
import { SiteNav } from '@/components/SiteNav';
import { Footer } from '@/components/Footer';
import { ProduceCard } from '@/components/ProduceCard';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

/**
 * Public farmer profile.
 *
 * The query selects named columns only. The farmer's user row — and therefore
 * their email, password hash and MFA secret — is never joined in, so no amount
 * of client inspection reveals contact details that are not meant to be public.
 */
export default async function FarmerProfilePage({ params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();

  const farmers = await sql<{
    id: string; name: string; farm_name: string; province: string; district: string;
    status: string; rating: string; total_reviews: number; total_sales: number;
    farm_size_ha: string | null; profile_photo: string | null;
  }>`
    SELECT id, name, farm_name, province, district, status, rating,
           total_reviews, total_sales, farm_size_ha, profile_photo
      FROM farmers WHERE id = ${params.id} AND status <> 'SUSPENDED' LIMIT 1
  `;
  const farmer = farmers[0];
  if (!farmer) notFound();

  const rows = await sql<ListingRow>`
    SELECT l.id, l.farmer_id, l.title, l.description, l.category, l.produce_type,
           l.quantity_kg, l.quantity_unit, l.price_per_unit, l.currency, l.min_order_qty,
           l.harvest_date, l.available_from, l.available_until, l.photos, l.is_organic,
           l.is_available, l.province, l.district, l.delivery_options, l.views_count,
           l.status, l.created_at
      FROM listings l
     WHERE l.farmer_id = ${params.id} AND l.status = 'ACTIVE'
     ORDER BY l.created_at DESC
     LIMIT 60
  `;

  const reviews = await sql<{ rating: number; comment: string; created_at: Date; buyer_name: string }>`
    SELECT r.rating, r.comment, r.created_at, b.name AS buyer_name
      FROM reviews r JOIN buyers b ON b.id = r.buyer_id
     WHERE r.farmer_id = ${params.id}
     ORDER BY r.created_at DESC LIMIT 10
  `;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />
      <main className="container mx-auto px-4 py-8 flex-1 max-w-4xl">
        <section className="neo-card p-6 md:p-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="font-heading text-2xl font-bold text-foreground">{farmer.farm_name}</h1>
                {farmer.status === 'VERIFIED' && <StatusBadge type="verified" />}
              </div>
              <p className="text-muted-foreground">{farmer.name}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-2">
                <MapPin className="h-3.5 w-3.5" /> {farmer.district}, {farmer.province}
              </p>
            </div>
            <div className="text-right">
              <p className="flex items-center gap-1 justify-end text-foreground">
                <Star className="h-4 w-4 text-accent fill-accent" />
                <span className="font-mono font-bold">{num(farmer.rating).toFixed(1)}</span>
              </p>
              <p className="text-xs text-muted-foreground">{farmer.total_reviews} reviews</p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 justify-end">
                <Package className="h-3 w-3" /> {farmer.total_sales} sales
              </p>
            </div>
          </div>
        </section>

        <h2 className="font-heading text-xl font-semibold text-foreground mt-10 mb-4">
          Active listings ({rows.length})
        </h2>
        {rows.length === 0 ? (
          <p className="text-muted-foreground">No active listings right now.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => <ProduceCard key={row.id} listing={toListing(row)} />)}
          </div>
        )}

        {reviews.length > 0 && (
          <>
            <h2 className="font-heading text-xl font-semibold text-foreground mt-10 mb-4">Reviews</h2>
            <ul className="space-y-3">
              {reviews.map((review, i) => (
                <li key={i} className="neo-card p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground text-sm">{review.buyer_name}</span>
                    <span className="text-accent text-sm">{'★'.repeat(review.rating)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{review.comment}</p>
                  <p className="text-xs text-muted-foreground mt-1">{iso(review.created_at).slice(0, 10)}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
