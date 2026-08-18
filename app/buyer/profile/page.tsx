import { requirePageRole } from '@/lib/page-guard';
import { sql } from '@/lib/db';
import { SiteNav } from '@/components/SiteNav';
import { Footer } from '@/components/Footer';
import { BuyerProfileForm } from './profile-form';

export const dynamic = 'force-dynamic';

export default async function BuyerProfilePage() {
  const session = await requirePageRole(['buyer'], '/buyer/profile');

  const [profile] = await sql<{
    name: string; phone: string; city: string; address: string | null;
    ecocash_number: string | null; buyer_type: string;
  }>`
    SELECT name, phone, city, address, ecocash_number, buyer_type
      FROM buyers WHERE user_id = ${session.id}
  `;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />
      <main className="container mx-auto px-4 py-8 flex-1 max-w-xl">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-2">My Profile</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {session.email} · {profile?.buyer_type?.toLowerCase()}
        </p>
        <BuyerProfileForm
          initial={{
            name: profile?.name ?? '',
            phone: profile?.phone ?? '',
            city: profile?.city ?? '',
            address: profile?.address ?? '',
            ecocash_number: profile?.ecocash_number ?? '',
          }}
        />
      </main>
      <Footer />
    </div>
  );
}
