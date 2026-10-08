'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Loader2, ShieldCheck, ShieldOff, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

/**
 * Two-factor enrolment.
 *
 * The secret and the recovery codes are shown exactly once each, because the
 * server stores only an encrypted secret and hashes of the codes — neither can
 * be retrieved again. The UI is built around that: it refuses to move past the
 * recovery codes without an explicit acknowledgement.
 *
 * Nothing here is the security boundary. Enrolment is not active until the
 * server verifies a generated code, and every subsequent login re-checks MFA
 * server-side regardless of what this component renders.
 */

type Stage = 'idle' | 'scanning' | 'codes' | 'disabling';

interface Challenge {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

export function MfaSettings({
  enabled, confirmedAt, unusedRecoveryCodes,
}: {
  enabled: boolean;
  confirmedAt: string | null;
  unusedRecoveryCodes: number;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('idle');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function begin() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/mfa/setup', {
        method: 'POST',
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not start setup.');
        return;
      }
      setChallenge(data as Challenge);
      setStage('scanning');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const code = String(new FormData(event.currentTarget).get('code') ?? '');
    try {
      const res = await fetch('/api/auth/mfa/setup', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'That code was not accepted.');
        return;
      }
      setRecoveryCodes(data.recoveryCodes ?? []);
      setChallenge(null); // the secret must not linger in memory once confirmed
      setStage('codes');
      toast.success('Two-factor authentication enabled.');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  async function disable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const password = String(new FormData(event.currentTarget).get('password') ?? '');
    try {
      const res = await fetch('/api/auth/mfa/setup', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not disable two-factor authentication.');
        return;
      }
      // Disabling invalidates every session, so the user must sign in again.
      toast.success('Two-factor disabled. Please sign in again.');
      router.push('/login');
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  function copyCodes() {
    navigator.clipboard?.writeText(recoveryCodes.join('\n')).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
      () => toast.error('Could not copy. Please write the codes down.'),
    );
  }

  function finish() {
    setRecoveryCodes([]);
    setStage('idle');
    router.refresh();
  }

  // ── Recovery codes: shown once, and the only way out is acknowledging them ──
  if (stage === 'codes') {
    return (
      <section className="neo-card p-6 space-y-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Save your recovery codes
        </h2>
        <p className="text-sm text-muted-foreground">
          Each code works once, and they are the only way in if you lose your
          authenticator. They are shown now and never again — only hashes are
          stored.
        </p>

        <ul className="neo-inset rounded-xl p-4 grid grid-cols-2 gap-2 font-mono text-sm text-foreground">
          {recoveryCodes.map((code) => <li key={code}>{code}</li>)}
        </ul>

        <div className="flex gap-3">
          <Button variant="outline" className="neo-flat" onClick={copyCodes}>
            {copied ? <><Check className="h-4 w-4 mr-2" /> Copied</> : <><Copy className="h-4 w-4 mr-2" /> Copy</>}
          </Button>
          <Button className="neo-btn bg-primary text-primary-foreground flex-1" onClick={finish}>
            I have saved these codes
          </Button>
        </div>
      </section>
    );
  }

  // ── Enrolment: scan, then prove possession ─────────────────────────────────
  if (stage === 'scanning' && challenge) {
    return (
      <section className="neo-card p-6 space-y-5">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Set up your authenticator
        </h2>
        <p className="text-sm text-muted-foreground">
          Scan this with Google Authenticator, Microsoft Authenticator, Authy or
          1Password, then enter the 6-digit code it shows.
        </p>

        <div className="flex justify-center">
          {/* Data URI from the server; unoptimized because there is no remote asset. */}
          <Image
            src={challenge.qrDataUrl}
            alt="QR code for two-factor authentication setup"
            width={200}
            height={200}
            unoptimized
            className="rounded-xl bg-white p-2"
          />
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Can&apos;t scan? Enter this key manually
          </summary>
          <code className="mt-2 block neo-inset rounded-lg p-3 font-mono text-xs break-all text-foreground">
            {challenge.secret}
          </code>
        </details>

        <form onSubmit={confirm} className="space-y-3" noValidate>
          <div>
            <Label htmlFor="code" className="text-foreground">6-digit code</Label>
            <Input
              id="code" name="code" inputMode="numeric" autoComplete="one-time-code"
              autoFocus required placeholder="000000" maxLength={6}
              className="neo-inset text-center text-xl tracking-[0.3em] font-mono"
            />
          </div>

          {error && <p role="alert" className="text-destructive text-sm">{error}</p>}

          <div className="flex gap-3">
            <Button
              type="button" variant="outline" className="neo-flat"
              onClick={() => { setStage('idle'); setChallenge(null); setError(null); }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="neo-btn bg-primary text-primary-foreground flex-1">
              {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying…</> : 'Verify and enable'}
            </Button>
          </div>
        </form>
      </section>
    );
  }

  // ── Disabling requires the password, so a hijacked session cannot do it ────
  if (stage === 'disabling') {
    return (
      <section className="neo-card p-6 space-y-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Turn off two-factor authentication
        </h2>
        <p className="text-sm text-muted-foreground">
          Confirm your password. This signs you out of all devices.
        </p>

        <form onSubmit={disable} className="space-y-3" noValidate>
          <div>
            <Label htmlFor="password" className="text-foreground">Password</Label>
            <Input
              id="password" name="password" type="password" required
              autoComplete="current-password" className="neo-inset"
            />
          </div>

          {error && <p role="alert" className="text-destructive text-sm">{error}</p>}

          <div className="flex gap-3">
            <Button
              type="button" variant="outline" className="neo-flat"
              onClick={() => { setStage('idle'); setError(null); }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy} variant="outline"
              className="flex-1 border-destructive text-destructive hover:bg-destructive/10">
              {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Disabling…</> : 'Disable two-factor'}
            </Button>
          </div>
        </form>
      </section>
    );
  }

  // ── Status ─────────────────────────────────────────────────────────────────
  return (
    <section className="neo-card p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground flex items-center gap-2">
            {enabled
              ? <><ShieldCheck className="h-5 w-5 text-fresh" /> Two-factor is on</>
              : <><ShieldOff className="h-5 w-5 text-muted-foreground" /> Two-factor is off</>}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {enabled
              ? `Enabled ${confirmedAt ?? ''} · ${unusedRecoveryCodes} recovery code${unusedRecoveryCodes === 1 ? '' : 's'} remaining`
              : 'Add a code from an authenticator app to your sign-in.'}
          </p>
        </div>

        {enabled ? (
          <Button
            variant="outline"
            className="neo-flat text-destructive"
            onClick={() => { setStage('disabling'); setError(null); }}
          >
            Turn off
          </Button>
        ) : (
          <Button
            onClick={begin}
            disabled={busy}
            className="neo-btn bg-primary text-primary-foreground"
          >
            {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting…</> : 'Set up'}
          </Button>
        )}
      </div>

      {enabled && unusedRecoveryCodes === 0 && (
        <p className="text-sm text-destructive neo-inset rounded-xl p-3">
          You have no recovery codes left. If you lose your authenticator you
          will be locked out — turn two-factor off and on again to issue a new set.
        </p>
      )}

      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    </section>
  );
}
