import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { getSession } from '@/lib/session';
import { homeForRole } from '@/lib/page-guard';
import { MfaChallengeForm } from './mfa-form';

export const dynamic = 'force-dynamic';

/**
 * The MFA challenge for a half-authenticated session.
 *
 * Reaching this page requires having already passed the password step: without
 * a session cookie there is nothing to challenge, and a session that has already
 * satisfied MFA is sent on to its dashboard.
 */
export default async function MfaChallengePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.mfaEnabled || session.mfaSatisfied) redirect(homeForRole(session.role));

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-14 h-14 rounded-2xl neo-inset flex items-center justify-center mb-6">
        <ShieldCheck className="h-7 w-7 text-primary" />
      </div>
      <MfaChallengeForm email={session.email} role={session.role} />
      <Link href="/login" className="text-sm text-muted-foreground hover:text-primary mt-6">
        Sign in as someone else
      </Link>
    </main>
  );
}
