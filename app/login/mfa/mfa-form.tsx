'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Second factor entry. Supports a TOTP code or a one-time recovery code.
 *
 * Attempts are rate limited server-side per account and per IP, so this form
 * deliberately has no client-side attempt counter to work around.
 */
export function MfaChallengeForm({ email, role }: { email: string; role: string }) {
  const router = useRouter();
  const [useRecovery, setUseRecovery] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const code = String(new FormData(event.currentTarget).get('code') ?? '');

    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ code, recovery: useRecovery }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setError(`Too many attempts. Try again in ${data.retryAfterSeconds ?? 60}s.`);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? 'Invalid or expired code.');
        return;
      }

      router.push(role === 'farmer' ? '/farm/dashboard' : role === 'admin' ? '/admin' : '/buyer/dashboard');
      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-sm neo-card p-6 md:p-8 space-y-5">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-bold text-foreground">Two-factor</h1>
        <p className="text-sm text-muted-foreground mt-1 break-all">{email}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="code" className="text-foreground">
            {useRecovery ? 'Recovery code' : '6-digit code'}
          </Label>
          <Input
            id="code"
            name="code"
            inputMode={useRecovery ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            autoFocus
            required
            placeholder={useRecovery ? 'XXXXX-XXXXX' : '000000'}
            className="neo-inset border-none text-center text-xl tracking-[0.3em] font-mono"
          />
        </div>

        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}

        <Button type="submit" disabled={submitting} className="w-full neo-btn bg-primary text-primary-foreground">
          {submitting ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying…</>
          ) : (
            'Verify'
          )}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => { setUseRecovery((v) => !v); setError(null); }}
        className="text-xs text-muted-foreground hover:text-primary w-full text-center"
      >
        {useRecovery ? 'Use an authenticator code instead' : 'Use a recovery code instead'}
      </button>
    </div>
  );
}
