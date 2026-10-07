'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function ConfirmEmailButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ token }),
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
    <div className="space-y-3">
      <Button onClick={confirm} disabled={busy} className="w-full neo-btn bg-primary text-primary-foreground">
        {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden /> Confirming…</> : 'Confirm email and sign in'}
      </Button>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
