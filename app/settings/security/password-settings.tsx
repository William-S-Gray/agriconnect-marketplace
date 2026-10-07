'use client';

import { useState } from 'react';
import { Loader2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordStrengthMeter } from '@/components/PasswordStrengthMeter';
import { toast } from 'sonner';

/** Change your own password. The server re-checks everything shown here. */
export function PasswordSettings() {
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors([]);
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    if (newPassword !== String(form.get('confirm') ?? '')) {
      setErrors(['New passwords do not match.']);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/me/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ currentPassword: String(form.get('current') ?? ''), newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.details ?? [data.error ?? 'Could not change the password.']);
        return;
      }
      formEl.reset();
      setNewPassword('');
      toast.success(data.message ?? 'Password changed.');
    } catch {
      setErrors(['Could not reach the server. Please try again.']);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="neo-card p-6 space-y-4 mb-6">
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-primary" />
        <h2 className="font-heading text-lg font-semibold text-foreground">Password</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Changing it signs you out on every other device.
      </p>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="current" className="text-foreground">Current password</Label>
          <Input id="current" name="current" type="password" required
            autoComplete="current-password" className="neo-inset border-none" />
        </div>
        <div>
          <Label htmlFor="new-password" className="text-foreground">New password</Label>
          <Input id="new-password" name="new" type="password" required
            autoComplete="new-password" className="neo-inset border-none"
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <PasswordStrengthMeter password={newPassword} />
          <p className="text-xs text-muted-foreground mt-1">At least 12 characters.</p>
        </div>
        <div>
          <Label htmlFor="confirm" className="text-foreground">Confirm new password</Label>
          <Input id="confirm" name="confirm" type="password" required
            autoComplete="new-password" className="neo-inset border-none" />
        </div>

        {errors.length > 0 && (
          <ul role="alert" className="text-destructive text-sm space-y-1">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}

        <Button type="submit" disabled={submitting} className="neo-btn bg-primary text-primary-foreground">
          {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Changing…</> : 'Change password'}
        </Button>
      </form>
    </section>
  );
}
