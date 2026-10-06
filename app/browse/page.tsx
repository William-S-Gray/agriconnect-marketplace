import { sql } from '@/lib/db';
import { toListing, type ListingRow } from '@/lib/serialize';
import { SiteNav } from '@/components/SiteNav';
import { Footer } from '@/components/Footer';
import { ProduceCard } from '@/components/ProduceCard';
import { BrowseFilters } from './filters';
import { PROVINCES, CATEGORIES } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Browse Produce — AgriConnect' };

/**
 * Public marketplace listing.
 *
 * Filtering happens in SQL with bound parameters rather than in the browser, so
 * the page scales past the seed data and the filter values can never be
 * interpolated into the query.
 */
export default async function BrowsePage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ q?: string; province?: string; category?: string; organic?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const q = searchParams.q?.trim() || null;
  const province = searchParams.province && searchParams.province !== 'all' ? searchParams.province : null;
  const category = searchParams.category && searchParams.category !== 'all' ? searchParams.category : null;
  const organicOnly = searchParams.organic === 'true';

  const rows = await sql<ListingRow & { farm_name: string }>`
    SELECT l.id, l.farmer_id, l.title, l.description, l.category, l.produce_type,
             l.quantity_kg, l.quantity_unit, l.price_per_unit, l.currency, l.min_order_qty,
             l.harvest_date, l.available_from, l.available_until, l.photos, l.is_organic,
             l.is_available, l.province, l.district, l.delivery_options, l.views_count,
             l.status, l.created_at, f.farm_name
      FROM listings l
      JOIN farmers f ON f.id = l.farmer_id
     WHERE l.status = 'ACTIVE'
       AND l.is_available = TRUE
       AND f.status <> 'SUSPENDED'
       AND (${q}::text IS NULL OR l.title ILIKE '%' || ${q} || '%' OR l.produce_type ILIKE '%' || ${q} || '%')
       AND (${province}::text IS NULL OR l.province = ${province})
       AND (${category}::text IS NULL OR l.category = ${category})
       AND (${organicOnly}::boolean = FALSE OR l.is_organic = TRUE)
     ORDER BY l.created_at DESC
     LIMIT 60
  `;

  const listings = rows.map(toListing);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />
      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="mb-8">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Browse Produce</h1>
          <p className="text-muted-foreground mt-1">
            {listings.length} listing{listings.length !== 1 ? 's' : ''} from verified Zimbabwe farms
          </p>
        </div>

        <BrowseFilters
          provinces={[...PROVINCES]}
          categories={CATEGORIES.map((c) => c.name)}
          initial={{
            q: searchParams.q ?? '',
            province: searchParams.province ?? 'all',
            category: searchParams.category ?? 'all',
            organic: organicOnly,
          }}
        />

        {listings.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">No produce matches those filters.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-8">
            {listings.map((listing) => (
              <ProduceCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
