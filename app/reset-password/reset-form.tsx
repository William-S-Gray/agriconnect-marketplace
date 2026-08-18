'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  if (!token) {
    return (
      <div className="w-full max-w-md neo-card p-8 text-center space-y-4">
        <h1 className="font-heading text-xl font-bold text-foreground">Invalid reset link</h1>
        <p className="text-sm text-muted-foreground">
          This link is missing its token. Request a new one.
        </p>
        <Link href="/forgot-password" className="text-sm text-primary hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors([]);

    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    if (password !== String(form.get('confirm') ?? '')) {
      setErrors(['Passwords do not match.']);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrors(data.details ?? [data.error ?? 'Could not reset the password.']);
        return;
      }

      // Every session was invalidated server-side, so the user must sign in again.
      toast.success('Password updated. Please sign in.');
      router.push('/login');
    } catch {
      setErrors(['Could not reach the server. Please try again.']);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md neo-card p-6 md:p-8 space-y-5">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-bold text-foreground">Set a new password</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Signing you out of all other devices.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="password" className="text-foreground">New password</Label>
          <Input
            id="password" name="password" type="password" required
            autoComplete="new-password" className="neo-inset border-none"
          />
          <p className="text-xs text-muted-foreground mt-1">At least 12 characters.</p>
        </div>
        <div>
          <Label htmlFor="confirm" className="text-foreground">Confirm password</Label>
          <Input
            id="confirm" name="confirm" type="password" required
            autoComplete="new-password" className="neo-inset border-none"
          />
        </div>

        {errors.length > 0 && (
          <ul role="alert" className="text-destructive text-sm space-y-1">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}

        <Button type="submit" disabled={submitting} className="w-full neo-btn bg-primary text-primary-foreground">
          {submitting ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating…</>
          ) : (
            'Update password'
          )}
        </Button>
      </form>
    </div>
  );
}
