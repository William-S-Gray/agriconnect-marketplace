'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import type { OrderAction } from '@/lib/order-lifecycle';

/**
 * Buttons for advancing an order.
 *
 * `actions` is computed server-side from the order's status and the viewer's
 * relationship to it, so this component never decides what is permitted -- it
 * renders what it was given, and the API re-checks every request anyway.
 */

const LABELS: Record<OrderAction, string> = {
  confirm: 'Confirm order',
  dispatch: 'Mark dispatched',
  mark_delivered: 'Mark delivered',
  confirm_receipt: 'Confirm receipt',
  cancel: 'Cancel',
  raise_dispute: 'Raise a problem',
  resolve_release: 'Release to farmer',
  resolve_refund: 'Refund buyer',
};

/** Actions that need a second look before they fire. */
const DESTRUCTIVE = new Set<OrderAction>(['cancel', 'resolve_refund']);
const PRIMARY = new Set<OrderAction>(['confirm', 'dispatch', 'mark_delivered', 'confirm_receipt']);

export function OrderActions({
  orderId,
  actions,
}: {
  orderId: string;
  actions: OrderAction[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<OrderAction | null>(null);
  const [disputing, setDisputing] = useState(false);

  if (actions.length === 0) return null;

  async function run(action: OrderAction, extra: Record<string, string> = {}) {
    setBusy(action);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // 409 means someone else moved the order first; refreshing shows the
        // real state rather than leaving a stale set of buttons on screen.
        toast.error(data.error ?? 'Could not update the order.');
        if (res.status === 409) router.refresh();
        return;
      }

      toast.success(messageFor(action));
      setDisputing(false);
      router.refresh();
    } catch {
      toast.error('Could not reach the server.');
    } finally {
      setBusy(null);
    }
  }

  if (disputing) {
    return (
      <form
        className="neo-inset rounded-xl p-4 space-y-3 mt-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void run('raise_dispute', {
            reason: String(form.get('reason') ?? ''),
            description: String(form.get('description') ?? ''),
          });
        }}
      >
        <div>
          <Label htmlFor="reason" className="text-foreground">What went wrong?</Label>
          <Input
            id="reason" name="reason" required maxLength={160}
            placeholder="Quality not as described"
            className="neo-flat"
          />
        </div>
        <div>
          <Label htmlFor="description" className="text-foreground">Details (optional)</Label>
          <Textarea id="description" name="description" rows={3} className="neo-flat" />
        </div>
        <div className="flex gap-2">
          <Button
            type="button" variant="outline" size="sm"
            className="neo-flat"
            onClick={() => setDisputing(false)}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={busy !== null}
            className="flex-1 border-destructive text-destructive hover:bg-destructive/10" variant="outline">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Submit problem'}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {actions.map((action) => (
        <Button
          key={action}
          size="sm"
          disabled={busy !== null}
          variant={PRIMARY.has(action) ? 'default' : 'outline'}
          className={
            PRIMARY.has(action)
              ? 'neo-btn bg-primary text-primary-foreground text-xs'
              : DESTRUCTIVE.has(action)
                ? 'neo-flat text-xs text-destructive'
                : 'neo-flat text-xs'
          }
          onClick={() => {
            if (action === 'raise_dispute') { setDisputing(true); return; }
            if (DESTRUCTIVE.has(action) && !confirmDestructive(action)) return;
            void run(action);
          }}
        >
          {busy === action ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
          {LABELS[action]}
        </Button>
      ))}
    </div>
  );
}

function confirmDestructive(action: OrderAction): boolean {
  const text = action === 'cancel'
    ? 'Cancel this order? The stock goes back on sale and the payment is refunded.'
    : 'Refund the buyer? This closes the dispute in their favour.';
  return window.confirm(text);
}

function messageFor(action: OrderAction): string {
  switch (action) {
    case 'confirm': return 'Order confirmed.';
    case 'dispatch': return 'Marked as dispatched.';
    case 'mark_delivered': return 'Marked as delivered.';
    case 'confirm_receipt': return 'Receipt confirmed — payment released to the farmer.';
    case 'cancel': return 'Order cancelled and refunded.';
    case 'raise_dispute': return 'Problem reported. An administrator will review it.';
    case 'resolve_release': return 'Dispute resolved — payment released.';
    case 'resolve_refund': return 'Dispute resolved — buyer refunded.';
  }
}
