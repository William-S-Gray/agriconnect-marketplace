import Link from 'next/link';
import { DollarSign, Package, ShoppingBag, Star, Plus } from 'lucide-react';
import { requirePageRole } from '@/lib/page-guard';
import { sql } from '@/lib/db';
import { num, iso } from '@/lib/serialize';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { FarmShell } from '../farm-shell';

export const dynamic = 'force-dynamic';

export default async function FarmerDashboardPage() {
  const session = await requirePageRole(['farmer'], '/farm/dashboard');

  const [profile] = await sql<{
    id: string; name: string; farm_name: string; status: string;
    rating: string; total_reviews: number;
  }>`
    SELECT id, name, farm_name, status, rating, total_reviews
      FROM farmers WHERE user_id = ${session.id}
  `;

  const [stats] = await sql<{ revenue: string; orders: string; listings: string; pending: string }>`
    SELECT COALESCE((SELECT SUM(o.farmer_payout) FROM orders o
                      JOIN farmers f ON f.id = o.farmer_id
                     WHERE f.user_id = ${session.id}), 0) AS revenue,
           (SELECT count(*) FROM orders o JOIN farmers f ON f.id = o.farmer_id
             WHERE f.user_id = ${session.id})             AS orders,
           (SELECT count(*) FROM listings l JOIN farmers f ON f.id = l.farmer_id
             WHERE f.user_id = ${session.id} AND l.status = 'ACTIVE') AS listings,
           (SELECT count(*) FROM orders o JOIN farmers f ON f.id = o.farmer_id
             WHERE f.user_id = ${session.id} AND o.status = 'PENDING') AS pending
  `;

  const recentOrders = await sql<{
    id: string; reference: string; status: string; total_amount: string;
    created_at: Date; buyer_name: string; listing_title: string;
  }>`
    SELECT o.id, o.reference, o.status, o.total_amount, o.created_at,
           b.name AS buyer_name, l.title AS listing_title
      FROM orders o
      JOIN farmers  f ON f.id = o.farmer_id
      JOIN buyers   b ON b.id = o.buyer_id
      JOIN listings l ON l.id = o.listing_id
     WHERE f.user_id = ${session.id}
     ORDER BY o.created_at DESC LIMIT 5
  `;

  const greeting = timeGreeting();

  return (
    <FarmShell name={profile?.name ?? ''} farmName={profile?.farm_name ?? ''} status={profile?.status ?? 'PENDING'}>
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Good {greeting}, {profile?.name?.split(' ')[0] ?? 'farmer'} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            {profile?.farm_name}
            {profile?.status === 'VERIFIED' && <StatusBadge type="verified" />}
          </p>
        </div>
        <Link href="/farm/listings/new">
          <Button className="neo-btn bg-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" /> New listing
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat icon={DollarSign} label="Net revenue" value={`$${num(stats?.revenue).toFixed(2)}`} />
        <Stat icon={ShoppingBag} label="Orders" value={String(stats?.orders ?? 0)} />
        <Stat icon={Package} label="Active listings" value={String(stats?.listings ?? 0)} />
        <Stat icon={Star} label="Rating" value={num(profile?.rating).toFixed(1)} />
      </div>

      {num(stats?.pending) > 0 && (
        <div className="neo-card p-4 mb-8 border-l-4 border-amber-500">
          <p className="text-sm text-foreground">
            {stats?.pending} order{num(stats?.pending) !== 1 ? 's' : ''} awaiting your confirmation.
          </p>
          <Link href="/farm/orders" className="text-xs text-primary hover:underline">Review now →</Link>
        </div>
      )}

      <h2 className="font-heading text-lg font-semibold text-foreground mb-3">Recent orders</h2>
      {recentOrders.length === 0 ? (
        <p className="text-muted-foreground text-sm">No orders yet.</p>
      ) : (
        <ul className="space-y-2 max-w-2xl">
          {recentOrders.map((o) => (
            <li key={o.id} className="neo-card p-4 flex justify-between items-center">
              <div>
                <p className="text-foreground text-sm font-medium">{o.listing_title}</p>
                <p className="text-xs text-muted-foreground">
                  {o.buyer_name} · {o.reference} · {iso(o.created_at).slice(0, 10)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-foreground">${num(o.total_amount).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{o.status}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </FarmShell>
  );
}

function Stat({
  icon: Icon, label, value,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="neo-card p-5">
      <Icon className="h-5 w-5 text-primary mb-2" />
      <p className="font-mono text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}
