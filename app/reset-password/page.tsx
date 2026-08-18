import Link from 'next/link';
import { Leaf } from 'lucide-react';
import { ResetPasswordForm } from './reset-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Set a new password — AgriConnect' };

/**
 * The token arrives in the query string. It is passed to the client component
 * only so it can be posted back; it is never stored, and the server validates
 * it by hash on submission.
 */
export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <Leaf className="h-7 w-7 text-primary" />
        <span className="font-heading text-2xl font-bold text-foreground">AgriConnect</span>
      </Link>
      <ResetPasswordForm token={searchParams.token ?? ''} />
    </main>
  );
}
