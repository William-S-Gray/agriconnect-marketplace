'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** "Send me a new link" — the server answers the same whether or not the address exists. */
export function ResendVerification({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function resend() {
    setState('sending');
    try {
      const res = await fetch('/api/auth/verify/resend', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setState('error');
        setMessage(`Too many requests. Try again in ${data.retryAfterSeconds ?? 60} seconds.`);
        return;
      }
      setState(res.ok ? 'sent' : 'error');
      setMessage(res.ok ? 'A new link is on its way — check your inbox and spam folder.' : 'Could not send a new link. Please try again.');
    } catch {
      setState('error');
      setMessage('Could not reach the server. Please try again.');
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" className="neo-flat w-full" onClick={resend}
        disabled={state === 'sending' || state === 'sent' || !email}>
        {state === 'sending' ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden /> Sending…</> : 'Send a new link'}
      </Button>
      {message && (
        <p role="status" className={`text-sm ${state === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>{message}</p>
      )}
    </div>
  );
}
