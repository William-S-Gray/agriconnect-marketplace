import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requirePageRole } from '@/lib/page-guard';
import { sql } from '@/lib/db';
import { num } from '@/lib/serialize';
import { Button } from '@/components/ui/button';
import { FarmShell } from '../farm-shell';
import { ListingRow } from './listing-row';

export const dynamic = 'force-dynamic';

export default async function MyListingsPage() {
  const session = await requirePageRole(['farmer'], '/farm/listings');

  const [profile] = await sql<{ name: string; farm_name: string; status: string }>`
    SELECT name, farm_name, status FROM farmers WHERE user_id = ${session.id}
  `;

  // Joined through farmers on user_id, so the result set can only ever contain
  // this farmer's rows.
  const listings = await sql<{
    id: string; title: string; status: string; price_per_unit: string;
    quantity_kg: string; quantity_unit: string; views_count: number;
  }>`
    SELECT l.id, l.title, l.status, l.price_per_unit, l.quantity_kg, l.quantity_unit, l.views_count
      FROM listings l JOIN farmers f ON f.id = l.farmer_id
     WHERE f.user_id = ${session.id}
     ORDER BY l.created_at DESC
     LIMIT 200
  `;

  return (
    <FarmShell name={profile?.name ?? ''} farmName={profile?.farm_name ?? ''} status={profile?.status ?? 'PENDING'}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">My Listings</h1>
        <Link href="/farm/listings/new">
          <Button className="neo-btn bg-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" /> New listing
          </Button>
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="neo-card p-12 text-center">
          <p className="text-muted-foreground mb-4">You have no listings yet.</p>
          <Link href="/farm/listings/new">
            <Button className="neo-btn bg-primary text-primary-foreground">Create your first listing</Button>
          </Link>
        </div>
      ) : (
        <ul className="space-y-3 max-w-3xl">
          {listings.map((l) => (
            <ListingRow
              key={l.id}
              id={l.id}
              title={l.title}
              status={l.status}
              price={num(l.price_per_unit)}
              quantity={num(l.quantity_kg)}
              unit={l.quantity_unit}
              views={l.views_count}
            />
          ))}
        </ul>
      )}
    </FarmShell>
  );
}
