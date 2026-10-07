'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ResendVerification } from '@/components/ResendVerification';

/**
 * Login form.
 *
 * Note what it does not do: it receives no token, stores nothing, and does not
 * decide where the user may go. It posts credentials, and the server sets an
 * HttpOnly cookie the JavaScript here cannot read. The redirect below is
 * convenience only — the destination page re-checks the session server-side.
 */
export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setError(
          `Too many attempts. Try again in ${data.retryAfterSeconds ?? 60} seconds.`,
        );
        return;
      }
      if (!res.ok) {
        // The server returns one generic message for unknown-account and
        // wrong-password; it is shown verbatim rather than elaborated on.
        setError(data.error ?? 'Invalid email or password.');
        setUnverified(data.code === 'email_unverified');
        return;
      }

      if (data.mfaRequired) {
        router.push('/login/mfa');
        return;
      }

      toast.success('Signed in.');
      router.push(nextPath ?? destinationFor(data.user?.role));
      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md neo-card p-6 md:p-8 space-y-6">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-bold text-foreground">Sign In</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome back to AgriConnect
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email" className="text-foreground">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.co.zw"
            className="neo-inset border-none"
          />
        </div>

        <div>
          <Label htmlFor="password" className="text-foreground">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="neo-inset border-none pr-10"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {error && (
          <p role="alert" className="text-destructive text-sm">{error}</p>
        )}
        {unverified && <ResendVerification email={email} />}

        <Button
          type="submit"
          disabled={submitting}
          className="w-full neo-btn bg-primary text-primary-foreground"
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in…</>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground text-center">
        No account?{' '}
        <Link href="/register" className="text-primary font-medium hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}

function destinationFor(role?: string): string {
  if (role === 'farmer') return '/farm/dashboard';
  if (role === 'admin') return '/admin';
  return '/buyer/dashboard';
}
