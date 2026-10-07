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
        <section className="container mx-auto px-4 pt-12 pb-10 md:pt-16">
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-foreground max-w-2xl leading-tight">
            Fresh from Zimbabwe&apos;s farms
          </h1>
          <p className="text-muted-foreground text-base md:text-lg mt-4 max-w-xl">
            Buy direct from verified farmers — better prices, EcoCash payments held in
            escrow until you confirm delivery, and no middlemen.
          </p>

          <div className="flex flex-wrap gap-3 mt-8">
            <Link href="/browse">
              <Button size="lg" className="neo-btn bg-primary text-primary-foreground">
                Browse produce <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Button>
            </Link>
            {session ? (
              <Link href={homeForRole(session.role)}>
                <Button size="lg" variant="outline" className="neo-flat border-none">
                  My dashboard
                </Button>
              </Link>
            ) : (
              <Link href="/register?role=farmer">
                <Button size="lg" variant="outline" className="neo-flat border-none">
                  Sell your produce
                </Button>
              </Link>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 md:gap-4 mt-10 max-w-xl">
            <Stat label="Verified farmers" value={stats?.farmers ?? '0'} icon={ShieldCheck} />
            <Stat label="Active listings" value={stats?.listings ?? '0'} icon={Sprout} />
            <Stat label="Provinces" value={stats?.provinces ?? '0'} icon={MapPin} />
          </div>
        </section>

        <section className="container mx-auto px-4 pb-6">
          <div className="flex items-end justify-between gap-4 mb-6">
            <h2 className="font-heading text-2xl font-bold text-foreground">In season now</h2>
            <Link href="/browse" className="text-sm text-primary hover:underline whitespace-nowrap">
              View all →
            </Link>
          </div>
          {listings.length === 0 ? (
            <p className="neo-card p-6 text-muted-foreground">
              No listings yet. Check back soon — farmers add new produce every week.
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {listings.map((l) => <ProduceCard key={l.id} listing={l} />)}
            </div>
          )}
        </section>

        <section className="container mx-auto px-4 py-10">
          <div className="grid gap-4 md:grid-cols-3">
            <Feature icon={ShieldCheck} title="Verified farmers">
              Every farm is checked by AgriConnect before its produce goes on sale.
            </Feature>
            <Feature icon={Lock} title="Payment held in escrow">
              Your EcoCash payment is released to the farmer only after you confirm delivery.
            </Feature>
            <Feature icon={MapPin} title="Across Zimbabwe">
              Buy close to home for pickup, or arrange delivery from further afield.
            </Feature>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="neo-card p-4 md:p-5">
      <Icon className="h-5 w-5 text-primary mb-2" />
      <p className="font-mono text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
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
    <div className="neo-flat rounded-2xl p-5">
      <Icon className="h-6 w-6 text-primary mb-3" />
      <h3 className="font-heading font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{children}</p>
    </div>
  );
}
