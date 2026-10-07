import { sql } from '@/lib/db';
import { toListing, type ListingRow } from '@/lib/serialize';
import { SiteNav } from '@/components/SiteNav';
import { Footer } from '@/components/Footer';
import { ProduceCard } from '@/components/ProduceCard';
import { BrowseFilters } from './filters';
import { PROVINCES, CATEGORIES } from '@/lib/mock-data';
import Link from 'next/link';

const PAGE_SIZE = 24;
const SORTS = ['newest', 'price_asc', 'price_desc'] as const;
type Sort = (typeof SORTS)[number];

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
  searchParams: Promise<{ q?: string; province?: string; category?: string; organic?: string; sort?: string; page?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const sort: Sort = (SORTS as readonly string[]).includes(searchParams.sort ?? '') ? (searchParams.sort as Sort) : 'newest';
  const page = Math.max(1, Math.min(1000, Number.parseInt(searchParams.page ?? '1', 10) || 1));
  const q = searchParams.q?.trim() || null;
  const province = searchParams.province && searchParams.province !== 'all' ? searchParams.province : null;
  const category = searchParams.category && searchParams.category !== 'all' ? searchParams.category : null;
  const organicOnly = searchParams.organic === 'true';

  const rows = await sql<ListingRow & { farm_name: string; total_count: string }>`
    SELECT l.id, l.farmer_id, l.title, l.description, l.category, l.produce_type,
             l.quantity_kg, l.quantity_unit, l.price_per_unit, l.currency, l.min_order_qty,
             l.harvest_date, l.available_from, l.available_until, l.photos, l.is_organic,
             l.is_available, l.province, l.district, l.delivery_options, l.views_count,
             l.status, l.created_at, f.farm_name,
             count(*) OVER () AS total_count
      FROM listings l
      JOIN farmers f ON f.id = l.farmer_id
     WHERE l.status = 'ACTIVE'
       AND l.is_available = TRUE
       AND f.status <> 'SUSPENDED'
       AND (${q}::text IS NULL OR l.title ILIKE '%' || ${q} || '%' OR l.produce_type ILIKE '%' || ${q} || '%')
       AND (${province}::text IS NULL OR l.province = ${province})
       AND (${category}::text IS NULL OR l.category = ${category})
       AND (${organicOnly}::boolean = FALSE OR l.is_organic = TRUE)
     -- The sort is a bound value, never interpolated SQL. l.id breaks ties so
     -- a listing cannot appear on two pages or on none.
     ORDER BY CASE WHEN ${sort} = 'price_asc' THEN l.price_per_unit END ASC,
              CASE WHEN ${sort} = 'price_desc' THEN l.price_per_unit END DESC,
              l.created_at DESC, l.id
     LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
  `;

  const listings = rows.map(toListing);
  // A page past the end has no rows to carry the window count, so count again.
  const total = rows.length > 0 ? Number(rows[0]!.total_count) : page > 1 ? await countMatching() : 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(q || province || category || organicOnly);

  async function countMatching(): Promise<number> {
    const [row] = await sql<{ n: string }>`
      SELECT count(*) AS n FROM listings l JOIN farmers f ON f.id = l.farmer_id
       WHERE l.status = 'ACTIVE' AND l.is_available = TRUE AND f.status <> 'SUSPENDED'
         AND (${q}::text IS NULL OR l.title ILIKE '%' || ${q} || '%' OR l.produce_type ILIKE '%' || ${q} || '%')
         AND (${province}::text IS NULL OR l.province = ${province})
         AND (${category}::text IS NULL OR l.category = ${category})
         AND (${organicOnly}::boolean = FALSE OR l.is_organic = TRUE)
    `;
    return Number(row?.n ?? 0);
  }

  /** This page's URL with one parameter changed, keeping the filters. */
  const hrefFor = (nextPage: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== 'page') params.set(key, value);
    }
    if (nextPage > 1) params.set('page', String(nextPage));
    const qs = params.toString();
    return qs ? `/browse?${qs}` : '/browse';
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />
      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="mb-8">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Browse Produce</h1>
          <p className="text-muted-foreground mt-1">
            {total} listing{total !== 1 ? 's' : ''} from verified Zimbabwe farms
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
            sort,
          }}
        />

        {listings.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <p className="text-muted-foreground">
              {page > 1 && total > 0 ? 'There are no more listings.' : filtered ? 'No produce matches those filters.' : 'No produce is listed right now.'}
            </p>
            {page > 1 && total > 0 ? (
              <Link href={hrefFor(1)} className="text-primary font-medium hover:underline">Back to the first page</Link>
            ) : filtered ? (
              <Link href="/browse" className="text-primary font-medium hover:underline">Clear filters</Link>
            ) : null}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-8">
              {listings.map((listing) => (
                <ProduceCard key={listing.id} listing={listing} />
              ))}
            </div>
            {pages > 1 && (
              <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Pages">
                {page > 1 ? (
                  <Link href={hrefFor(page - 1)} rel="prev" className="neo-flat rounded-xl px-4 py-2 text-sm text-foreground hover:text-primary">
                    ← Previous
                  </Link>
                ) : <span className="px-4 py-2 text-sm text-muted-foreground/50" aria-hidden>← Previous</span>}
                <span className="text-sm text-muted-foreground" aria-current="page">Page {page} of {pages}</span>
                {page < pages ? (
                  <Link href={hrefFor(page + 1)} rel="next" className="neo-flat rounded-xl px-4 py-2 text-sm text-foreground hover:text-primary">
                    Next →
                  </Link>
                ) : <span className="px-4 py-2 text-sm text-muted-foreground/50" aria-hidden>Next →</span>}
              </nav>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
