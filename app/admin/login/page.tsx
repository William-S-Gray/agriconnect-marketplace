import { redirect } from 'next/navigation';
import { Shield } from 'lucide-react';
import { optionalPageUser, homeForRole } from '@/lib/page-guard';
import { LoginForm } from '../../login/login-form';

export const dynamic = 'force-dynamic';

/**
 * Unlisted admin entry point. It is a separate route, but NOT a separate
 * security mechanism: it posts to the same /api/auth/login endpoint, and the
 * admin role comes from the user's database row. Reaching this page grants
 * nothing.
 */
export default async function AdminLoginPage() {
  const session = await optionalPageUser();
  if (session) redirect(homeForRole(session.role));

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-14 h-14 rounded-2xl neo-inset flex items-center justify-center mb-6">
        <Shield className="h-7 w-7 text-primary" />
      </div>
      <p className="text-xs text-muted-foreground mb-6">This page is not publicly listed.</p>
      <LoginForm nextPath="/admin" />
    </main>
  );
}
