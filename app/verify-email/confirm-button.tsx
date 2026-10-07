'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ConfirmEmailButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not confirm your email.');
        return;
      }
      toast.success('Email confirmed. Welcome to AgriConnect.');
      router.push(data.next ?? '/');
      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={confirm} className="space-y-3 text-left">
      <div>
        <Label htmlFor="password" className="text-foreground">Password</Label>
        <Input id="password" type="password" autoComplete="current-password" required value={password}
          onChange={(e) => setPassword(e.target.value)} className="neo-inset" />
      </div>
      <Button type="submit" disabled={busy || !password} className="w-full neo-btn bg-primary text-primary-foreground">
        {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden /> Confirming…</> : 'Confirm email and sign in'}
      </Button>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    </form>
  );
}
