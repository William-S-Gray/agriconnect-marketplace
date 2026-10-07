import Link from 'next/link';
import { Leaf, MailCheck, MailX } from 'lucide-react';
import { peekVerificationToken } from '@/lib/email-verification';
import { ConfirmEmailButton } from './confirm-button';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Confirm your email — AgriConnect' };

/**
 * Landing page for the verification link. Opening it changes nothing: the
 * account is confirmed only when the person presses the button (see
 * /api/auth/verify for why). It names the address being confirmed, so nobody
 * is unknowingly signed into someone else's account.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = '' } = await searchParams;
  const pending = token.length >= 20 && token.length <= 200 ? await peekVerificationToken(token) : null;
  const email = pending?.email ?? null;

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <Leaf className="h-7 w-7 text-primary" />
        <span className="font-heading text-2xl font-bold text-foreground">AgriConnect</span>
      </Link>
      <div className="w-full max-w-md neo-card p-6 md:p-8 space-y-5 text-center">
        {email ? (
          <>
            <MailCheck className="h-10 w-10 text-primary mx-auto" aria-hidden />
            <h1 className="font-heading text-2xl font-bold text-foreground">Confirm your email</h1>
            <p className="text-sm text-muted-foreground">
              You’re confirming <span className="font-semibold text-foreground">{email}</span> for a new
              AgriConnect account. Enter the password you chose when you signed up.
            </p>
            <ConfirmEmailButton token={token} />
          </>
        ) : (
          <>
            <MailX className="h-10 w-10 text-muted-foreground mx-auto" aria-hidden />
            <h1 className="font-heading text-2xl font-bold text-foreground">This link has expired</h1>
            <p className="text-sm text-muted-foreground">
              Confirmation links work once, for 24 hours. Try signing in — you can ask for a new link
              there.
            </p>
            <Link href="/login" className="text-primary font-medium hover:underline">Go to sign in</Link>
          </>
        )}
      </div>
    </main>
  );
}
