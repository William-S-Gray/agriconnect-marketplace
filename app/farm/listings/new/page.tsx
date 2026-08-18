import { requirePageRole } from '@/lib/page-guard';
import { sql } from '@/lib/db';
import { PROVINCES, CATEGORIES, UNITS } from '@/lib/mock-data';
import { FarmShell } from '../../farm-shell';
import { NewListingForm } from './new-listing-form';

export const dynamic = 'force-dynamic';

export default async function NewListingPage() {
  const session = await requirePageRole(['farmer'], '/farm/listings/new');

  const [profile] = await sql<{ name: string; farm_name: string; status: string; province: string; district: string }>`
    SELECT name, farm_name, status, province, district FROM farmers WHERE user_id = ${session.id}
  `;

  return (
    <FarmShell name={profile?.name ?? ''} farmName={profile?.farm_name ?? ''} status={profile?.status ?? 'PENDING'}>
      <h1 className="font-heading text-2xl font-bold text-foreground mb-6">New Listing</h1>
      <NewListingForm
        provinces={[...PROVINCES]}
        categories={CATEGORIES.map((c) => c.name)}
        units={[...UNITS]}
        defaults={{ province: profile?.province ?? '', district: profile?.district ?? '' }}
      />
    </FarmShell>
  );
}
