import Link from 'next/link';
import { Leaf, ShieldCheck, Sprout, ShoppingBag } from 'lucide-react';
import { sql } from '@/lib/db';
import { optionalPageUser } from '@/lib/page-guard';
import { Button } from '@/components/ui/button';

// Reads live data, so it must not be statically prerendered at build time.
export const dynamic = 'force-dynamic';

/**
 * Home page. A server component: the data comes straight from Postgres, and the
 * session (if any) is read server-side, so nothing about identity is decided in
 * the browser.
 */
export default async function HomePage() {
  const session = await optionalPageUser();

  const [stats] = await sql<{
    farmers: string;
    listings: string;
    provinces: string;
  }>`
    SELECT
      (SELECT count(*) FROM farmers WHERE status = 'VERIFIED')            AS farmers,
      (SELECT count(*) FROM listings WHERE status = 'ACTIVE')             AS listings,
      (SELECT count(DISTINCT province) FROM listings)                     AS provinces
  `;

  const listings = await sql<{
    id: string;
    title: string;
    price_per_unit: string;
    quantity_unit: string;
    province: string;
    farm_name: string;
  }>`
    SELECT l.id, l.title, l.price_per_unit, l.quantity_unit, l.province, f.farm_name
      FROM listings l
      JOIN farmers f ON f.id = l.farmer_id
     WHERE l.status = 'ACTIVE'
     ORDER BY l.created_at DESC
     LIMIT 4
  `;

  return (
    <main className="min-h-screen bg-background">
      <header className="container mx-auto flex items-center justify-between px-4 py-6">
        <div className="flex items-center gap-2">
          <Leaf className="h-7 w-7 text-primary" />
          <span className="font-heading text-2xl font-bold text-foreground">AgriConnect</span>
        </div>
        <nav className="flex items-center gap-3">
          {session ? (
            <Link href={dashboardFor(session.role)}>
              <Button className="neo-btn bg-primary text-primary-foreground">
                My Dashboard
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="outline" className="neo-flat border-none">Sign In</Button>
              </Link>
              <Link href="/register">
                <Button className="neo-btn bg-primary text-primary-foreground">Register</Button>
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="container mx-auto px-4 py-12">
        <h1 className="font-heading text-4xl md:text-5xl font-bold text-foreground max-w-2xl">
          Fresh from Zimbabwe&apos;s farms
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl">
          Buy direct from verified farmers — better prices, EcoCash secured payments,
          no middlemen.
        </p>

        <div className="grid grid-cols-3 gap-4 mt-10 max-w-lg">
          <Stat label="Verified Farmers" value={stats?.farmers ?? '0'} icon={ShieldCheck} />
          <Stat label="Active Listings" value={stats?.listings ?? '0'} icon={Sprout} />
          <Stat label="Provinces" value={stats?.provinces ?? '0'} icon={ShoppingBag} />
        </div>
      </section>

      <section className="container mx-auto px-4 pb-16">
        <h2 className="font-heading text-2xl font-bold text-foreground mb-6">In Season Now</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {listings.map((l) => (
            <article key={l.id} className="neo-card p-5">
              <h3 className="font-heading font-semibold text-foreground">{l.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{l.farm_name}</p>
              <p className="price-display mt-3">
                ${Number(l.price_per_unit).toFixed(2)} / {l.quantity_unit}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{l.province}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
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
    <div className="neo-card p-5">
      <Icon className="h-5 w-5 text-primary mb-2" />
      <p className="font-mono text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function dashboardFor(role: 'farmer' | 'buyer' | 'admin'): string {
  if (role === 'farmer') return '/farm/dashboard';
  if (role === 'buyer') return '/buyer/dashboard';
  return '/admin';
}
