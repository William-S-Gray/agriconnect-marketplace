import Link from 'next/link';
import { ArrowRight, ShieldCheck, Sprout, MapPin, Lock } from 'lucide-react';
import { sql } from '@/lib/db';
import { toListing, type ListingRow } from '@/lib/serialize';
import { optionalPageUser, homeForRole } from '@/lib/page-guard';
import { Button } from '@/components/ui/button';
import { SiteNav } from '@/components/SiteNav';
import { Footer } from '@/components/Footer';
import { ProduceCard } from '@/components/ProduceCard';

// Reads live data, so it must not be statically prerendered at build time.
export const dynamic = 'force-dynamic';

/**
 * Home page. A server component: the data comes straight from Postgres, and the
 * session (if any) is read server-side, so nothing about identity is decided in
 * the browser.
 *
 * Uses the shared SiteNav, ProduceCard and Footer so it looks and navigates
 * like every other page; it used to have its own header (no Browse or Prices
 * links, no theme toggle), no footer, and listing cards that could not be
 * clicked.
 */
export default async function HomePage() {
  const session = await optionalPageUser();

  // Same visibility rules as /browse, so the numbers match what a buyer can find.
  const [stats] = await sql<{ farmers: string; listings: string; provinces: string }>`
    WITH visible AS (
      SELECT l.province FROM listings l JOIN farmers f ON f.id = l.farmer_id
       WHERE l.status = 'ACTIVE' AND l.is_available AND f.status = 'VERIFIED' AND l.quantity_kg > 0
    )
    SELECT (SELECT count(*) FROM farmers WHERE status = 'VERIFIED') AS farmers,
           (SELECT count(*) FROM visible)                            AS listings,
           (SELECT count(DISTINCT province) FROM visible)            AS provinces
  `;

  const rows = await sql<ListingRow & { farm_name: string }>`
    SELECT l.id, l.farmer_id, l.title, l.description, l.category, l.produce_type,
           l.quantity_kg, l.quantity_unit, l.price_per_unit, l.currency, l.min_order_qty,
           l.harvest_date, l.available_from, l.available_until, l.photos, l.is_organic,
           l.is_available, l.province, l.district, l.delivery_options, l.views_count,
           l.status, l.created_at, f.farm_name
      FROM listings l
      JOIN farmers f ON f.id = l.farmer_id
     WHERE l.status = 'ACTIVE' AND l.is_available AND f.status = 'VERIFIED' AND l.quantity_kg > 0
     ORDER BY l.created_at DESC
     LIMIT 4
  `;
  const listings = rows.map(toListing);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />

      <main className="flex-1">
        <section className="border-b border-border bg-secondary/40">
          <div className="container mx-auto px-4 py-12 md:py-20 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold text-primary mb-3">Zimbabwe&apos;s farm-to-market marketplace</p>
              <h1 className="font-heading text-4xl md:text-5xl font-bold text-foreground leading-tight">
                Fresh from Zimbabwe&apos;s farms
              </h1>
              <p className="text-muted-foreground text-base md:text-lg mt-4 max-w-xl">
                Buy direct from verified farmers, with better prices and no middlemen.
              </p>

              <div className="flex flex-wrap gap-3 mt-8">
                <Link href="/browse">
                  <Button size="lg" className="neo-btn bg-primary text-primary-foreground">
                    Browse produce <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
                  </Button>
                </Link>
                {session ? (
                  <Link href={homeForRole(session.role)}>
                    <Button size="lg" variant="outline" className="neo-flat">My dashboard</Button>
                  </Link>
                ) : (
                  <Link href="/register?role=farmer">
                    <Button size="lg" variant="outline" className="neo-flat">Sell your produce</Button>
                  </Link>
                )}
              </div>

              {/* Counts only once there is something to count. */}
              {Number(stats?.listings ?? 0) > 0 && (
                <dl className="flex flex-wrap gap-x-8 gap-y-3 mt-10">
                  <Stat label="Verified farmers" value={stats!.farmers} />
                  <Stat label="Active listings" value={stats!.listings} />
                  <Stat label="Provinces" value={stats!.provinces} />
                </dl>
              )}
            </div>

            <ul className="neo-card divide-y divide-border">
              <Feature icon={ShieldCheck} title="Verified farmers">
                Every farm is checked by AgriConnect before its produce goes on sale.
              </Feature>
              <Feature icon={Lock} title="Payment held in escrow">
                Your payment is released to the farmer only after you confirm delivery.
              </Feature>
              <Feature icon={MapPin} title="Across Zimbabwe">
                Buy close to home for pickup, or arrange delivery from further afield.
              </Feature>
            </ul>
          </div>
        </section>

        <section className="container mx-auto px-4 py-12">
          <div className="flex items-end justify-between gap-4 mb-6">
            <h2 className="font-heading text-2xl font-bold text-foreground">In season now</h2>
            {listings.length > 0 && (
              <Link href="/browse" className="text-sm font-medium text-primary hover:underline whitespace-nowrap">
                View all →
              </Link>
            )}
          </div>
          {listings.length === 0 ? (
            <div className="neo-card p-10 text-center">
              <Sprout className="h-8 w-8 text-primary mx-auto mb-3" aria-hidden />
              <p className="font-medium text-foreground">No produce listed yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Farmers add new produce every week. Are you a farmer?
              </p>
              <Link href="/register?role=farmer" className="inline-block mt-5">
                <Button className="neo-btn bg-primary text-primary-foreground">List your produce</Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {listings.map((l) => <ProduceCard key={l.id} listing={l} />)}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-bold text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4 p-5">
      <span className="h-10 w-10 shrink-0 rounded-lg bg-secondary flex items-center justify-center">
        <Icon className="h-5 w-5 text-primary" />
      </span>
      <div>
        <h2 className="font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{children}</p>
      </div>
    </li>
  );
}
