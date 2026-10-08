import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { requirePageUser } from '@/lib/page-guard';
import { sql } from '@/lib/db';
import { SiteNav } from '@/components/SiteNav';
import { Footer } from '@/components/Footer';
import { MfaSettings } from './mfa-settings';
import { PasswordSettings } from './password-settings';
import { formatDate } from '@/lib/serialize';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Security — AgriConnect' };

/**
 * Security settings. Available to any signed-in role.
 *
 * MFA status is read from the database rather than passed in from the client,
 * so what the page renders always reflects the account's real state.
 */
export default async function SecuritySettingsPage() {
  const session = await requirePageUser('/settings/security');

  const [row] = await sql<{ mfa_enabled: boolean; mfa_confirmed_at: Date | null; codes: string }>`
    SELECT u.mfa_enabled,
           u.mfa_confirmed_at,
           (SELECT count(*) FROM mfa_recovery_codes c
             WHERE c.user_id = u.id AND c.used_at IS NULL)::text AS codes
      FROM users u WHERE u.id = ${session.id}
  `;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />
      <main className="container mx-auto px-4 py-8 flex-1 max-w-2xl">
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold text-foreground">Security</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">{session.email}</p>

        <PasswordSettings />

        <MfaSettings
          enabled={row?.mfa_enabled ?? false}
          confirmedAt={row?.mfa_confirmed_at ? formatDate(row.mfa_confirmed_at) : null}
          unusedRecoveryCodes={Number(row?.codes ?? 0)}
        />

        <p className="text-xs text-muted-foreground mt-8">
          Signed in as {session.role}.{' '}
          <Link href="/" className="text-primary underline underline-offset-2">Back to site</Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}
