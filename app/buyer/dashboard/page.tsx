import Link from 'next/link';
import { ShoppingBag, DollarSign, Heart } from 'lucide-react';
import { requirePageRole } from '@/lib/page-guard';
import { sql } from '@/lib/db';
import { iso, num, toListing, type ListingRow, formatDate } from '@/lib/serialize';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { SiteNav } from '@/components/SiteNav';
import { Footer } from '@/components/Footer';
import { ProduceCard } from '@/components/ProduceCard';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function BuyerDashboardPage() {
  const session = await requirePageRole(['buyer'], '/buyer/dashboard');

  const [profile] = await sql<{ id: string; name: string; city: string }>`
    SELECT id, name, city FROM buyers WHERE user_id = ${session.id}
  `;

  const [stats] = await sql<{ orders: string; spent: string; cart: string }>`
    SELECT (SELECT count(*) FROM orders o JOIN buyers b ON b.id = o.buyer_id
             WHERE b.user_id = ${session.id})                     AS orders,
           COALESCE((SELECT SUM(o.total_amount) FROM orders o
                      JOIN buyers b ON b.id = o.buyer_id
                     WHERE b.user_id = ${session.id}
                       AND o.payment_status <> 'REFUNDED'), 0)    AS spent,
           (SELECT count(*) FROM cart_items c JOIN buyers b ON b.id = c.buyer_id
             WHERE b.user_id = ${session.id})                     AS cart
  `;

  const activeOrders = await sql<{
    id: string; reference: string; status: string; total_amount: string;
    created_at: Date; listing_title: string; farm_name: string;
  }>`
    SELECT o.id, o.reference, o.status, o.total_amount, o.created_at,
           l.title AS listing_title, f.farm_name
      FROM orders o
      JOIN buyers   b ON b.id = o.buyer_id
      JOIN listings l ON l.id = o.listing_id
      JOIN farmers  f ON f.id = o.farmer_id
     WHERE b.user_id = ${session.id}
       AND o.status NOT IN ('COMPLETED', 'CANCELLED', 'REFUNDED')
     ORDER BY o.created_at DESC LIMIT 5
  `;

  const recommended = await sql<ListingRow>`
    SELECT l.id, l.farmer_id, l.title, l.description, l.category, l.produce_type,
           l.quantity_kg, l.quantity_unit, l.price_per_unit, l.currency, l.min_order_qty,
           l.harvest_date, l.available_from, l.available_until, l.photos, l.is_organic,
           l.is_available, l.province, l.district, l.delivery_options, l.views_count,
           l.status, l.created_at
      FROM listings l
      JOIN farmers f ON f.id = l.farmer_id
     WHERE l.status = 'ACTIVE' AND l.is_available = TRUE AND f.status = 'VERIFIED' AND l.quantity_kg > 0
     ORDER BY l.created_at DESC LIMIT 4
  `;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav cartCount={Number(stats?.cart ?? 0)} />
      <main className="container mx-auto px-4 py-8 flex-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Welcome back, {profile?.name?.split(' ')[0] ?? session.email}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Your buying dashboard · {profile?.city}</p>

        <div className="grid grid-cols-3 gap-4 mt-8">
          <Stat icon={ShoppingBag} label="Orders placed" value={String(stats?.orders ?? 0)} />
          <Stat icon={DollarSign} label="Total spent" value={`$${num(stats?.spent).toFixed(2)}`} />
          <Stat icon={Heart} label="In cart" value={String(stats?.cart ?? 0)} />
        </div>

        <div className="flex items-center justify-between mt-10 mb-3">
          <h2 className="font-heading text-lg font-semibold text-foreground">Active orders</h2>
          <Link href="/buyer/orders" className="text-sm text-primary hover:underline">View all →</Link>
        </div>

        {activeOrders.length === 0 ? (
          <div className="neo-card p-8 text-center">
            <p className="text-muted-foreground mb-4">No active orders.</p>
            <Link href="/browse">
              <Button className="neo-btn bg-primary text-primary-foreground">Browse produce</Button>
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {activeOrders.map((o) => (
              <li key={o.id} className="neo-card p-4 flex justify-between items-center">
                <div>
                  <p className="text-foreground text-sm font-medium">{o.listing_title}</p>
                  <p className="text-xs text-muted-foreground">
                    From {o.farm_name} · {o.reference} · {formatDate(o.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums text-foreground">${num(o.total_amount).toFixed(2)}</p>
                  <div className="mt-1"><OrderStatusBadge status={o.status} /></div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h2 className="font-heading text-lg font-semibold text-foreground mt-10 mb-3">
          Recommended for you
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {recommended.map((row) => <ProduceCard key={row.id} listing={toListing(row)} />)}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Stat({
  icon: Icon, label, value,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="neo-card p-5 text-center">
      <Icon className="h-5 w-5 text-primary mb-2 mx-auto" />
      <p className="tabular-nums text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
