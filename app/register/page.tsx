import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Leaf } from 'lucide-react';
import { optionalPageUser, homeForRole } from '@/lib/page-guard';
import { RegisterForm } from './register-form';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const session = await optionalPageUser();
  if (session) redirect(homeForRole(session.role));

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <Leaf className="h-7 w-7 text-primary" />
        <span className="font-heading text-2xl font-bold text-foreground">AgriConnect</span>
      </Link>
      <RegisterForm />
    </main>
  );
}
