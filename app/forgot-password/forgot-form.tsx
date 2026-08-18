'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Password reset request.
 *
 * The success state is shown for every submission that reaches the server,
 * whether or not the account exists — matching the API, which returns one
 * generic response. Showing "no such account" here would reintroduce the
 * enumeration the endpoint is designed to prevent.
 */
export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const email = new FormData(event.currentTarget).get('email');

    try {
      const res = await fetch('/api/auth/password/forgot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setError(`Too many requests. Try again in ${data.retryAfterSeconds ?? 60}s.`);
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="w-full max-w-md neo-card p-8 text-center space-y-4">
        <div className="neo-flat w-16 h-16 rounded-full flex items-center justify-center mx-auto">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-heading text-xl font-bold text-foreground">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          If an account exists for that email, a password reset link has been sent.
          The link expires in 30 minutes and can be used once.
        </p>
        <Link href="/login" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md neo-card p-6 md:p-8 space-y-5">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-bold text-foreground">Forgot password</h1>
        <p className="text-sm text-muted-foreground mt-1">
          We&apos;ll send you a link to set a new one.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email" className="text-foreground">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.co.zw"
            className="neo-inset border-none"
          />
        </div>

        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}

        <Button type="submit" disabled={submitting} className="w-full neo-btn bg-primary text-primary-foreground">
          {submitting ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</>
          ) : (
            'Send reset link'
          )}
        </Button>
      </form>

      <Link href="/login" className="text-sm text-muted-foreground hover:text-primary block text-center">
        Back to sign in
      </Link>
    </div>
  );
}
