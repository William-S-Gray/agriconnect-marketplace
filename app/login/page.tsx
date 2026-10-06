import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Leaf } from 'lucide-react';
import { optionalPageUser, homeForRole, safeNextPath } from '@/lib/page-guard';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

/**
 * Server component: an already-authenticated visitor is redirected away before
 * the form is ever rendered.
 */
export default async function LoginPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const session = await optionalPageUser();
  if (session) redirect(homeForRole(session.role));

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <Leaf className="h-7 w-7 text-primary" />
        <span className="font-heading text-2xl font-bold text-foreground">AgriConnect</span>
      </Link>
      <LoginForm nextPath={safeNextPath(searchParams.next)} />
    </main>
  );
}
