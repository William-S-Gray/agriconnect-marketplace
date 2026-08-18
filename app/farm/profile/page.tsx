import { requirePageRole } from '@/lib/page-guard';
import { sql } from '@/lib/db';
import { num } from '@/lib/serialize';
import { PROVINCES } from '@/lib/mock-data';
import { FarmShell } from '../farm-shell';
import { ProfileForm } from './profile-form';

export const dynamic = 'force-dynamic';

export default async function FarmerProfilePage() {
  const session = await requirePageRole(['farmer'], '/farm/profile');

  const [profile] = await sql<{
    name: string; farm_name: string; phone: string; province: string;
    district: string; ecocash_number: string; status: string;
    rating: string; total_reviews: number;
  }>`
    SELECT name, farm_name, phone, province, district, ecocash_number,
           status, rating, total_reviews
      FROM farmers WHERE user_id = ${session.id}
  `;

  return (
    <FarmShell name={profile?.name ?? ''} farmName={profile?.farm_name ?? ''} status={profile?.status ?? 'PENDING'}>
      <h1 className="font-heading text-2xl font-bold text-foreground mb-2">Profile</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {session.email} · ★ {num(profile?.rating).toFixed(1)} ({profile?.total_reviews ?? 0} reviews)
      </p>
      <ProfileForm
        provinces={[...PROVINCES]}
        initial={{
          name: profile?.name ?? '',
          farm_name: profile?.farm_name ?? '',
          phone: profile?.phone ?? '',
          province: profile?.province ?? '',
          district: profile?.district ?? '',
          ecocash_number: profile?.ecocash_number ?? '',
        }}
      />
    </FarmShell>
  );
}
