import Link from 'next/link';
import { Leaf } from 'lucide-react';
import { ForgotPasswordForm } from './forgot-form';

export const metadata = { title: 'Reset your password — AgriConnect' };

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <Leaf className="h-7 w-7 text-primary" />
        <span className="font-heading text-2xl font-bold text-foreground">AgriConnect</span>
      </Link>
      <ForgotPasswordForm />
    </main>
  );
}
