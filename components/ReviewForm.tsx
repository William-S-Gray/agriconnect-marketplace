'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MAX_COMMENT_LENGTH } from '@/lib/reviews';

/**
 * Leaves a review for a completed order.
 *
 * Rendered only where the server has already decided the order is reviewable;
 * the endpoint re-checks the same rules, so this is presentation only.
 */
export function ReviewForm({
  orderId,
  farmName,
  existing,
}: {
  orderId: string;
  farmName: string;
  /** A review already left for this order, if any. */
  existing?: { rating: number; comment: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (existing) {
    return (
      <div className="mt-4 neo-inset rounded-xl p-3">
        <p className="text-xs text-muted-foreground mb-1">Your review</p>
        <Stars value={existing.rating} readOnly />
        {existing.comment && (
          <p className="text-sm text-foreground mt-2">{existing.comment}</p>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="neo-flat text-xs mt-4"
        onClick={() => setOpen(true)}
      >
        <Star className="h-3.5 w-3.5 mr-1" /> Review {farmName}
      </Button>
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating === 0) {
      setError('Choose a star rating.');
      return;
    }

    setBusy(true);
    setError(null);
    const comment = String(new FormData(event.currentTarget).get('comment') ?? '');

    try {
      const res = await fetch(`/api/orders/${orderId}/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ rating, comment }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? 'Could not save your review.');
        // 409 means the state moved underneath us; refresh to show reality.
        if (res.status === 409) router.refresh();
        return;
      }

      toast.success('Thank you — your review is published.');
      setOpen(false);
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 neo-inset rounded-xl p-4 space-y-3" noValidate>
      <div>
        <Label className="text-foreground">How was it?</Label>
        <div className="mt-1">
          <Stars
            value={hover || rating}
            onSelect={setRating}
            onHover={setHover}
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`comment-${orderId}`} className="text-foreground">
          Comment (optional)
        </Label>
        <Textarea
          id={`comment-${orderId}`}
          name="comment"
          rows={3}
          maxLength={MAX_COMMENT_LENGTH}
          placeholder={`What was the produce from ${farmName} like?`}
          className="neo-flat"
        />
      </div>

      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}

      <div className="flex gap-2">
        <Button
          type="button" size="sm" variant="outline"
          className="neo-flat"
          onClick={() => { setOpen(false); setError(null); }}
        >
          Cancel
        </Button>
        <Button
          type="submit" size="sm" disabled={busy}
          className="flex-1 neo-btn bg-primary text-primary-foreground"
        >
          {busy ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Saving…</> : 'Publish review'}
        </Button>
      </div>
    </form>
  );
}

function Stars({
  value, onSelect, onHover, readOnly,
}: {
  value: number;
  onSelect?: (n: number) => void;
  onHover?: (n: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div
      className="flex gap-1"
      onMouseLeave={() => onHover?.(0)}
      role={readOnly ? 'img' : 'radiogroup'}
      aria-label={readOnly ? `Rated ${value} out of 5` : 'Star rating'}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          aria-checked={!readOnly && value === n}
          role={readOnly ? undefined : 'radio'}
          onClick={() => onSelect?.(n)}
          onMouseEnter={() => onHover?.(n)}
          className={readOnly ? 'cursor-default' : 'cursor-pointer transition-transform hover:scale-110'}
        >
          <Star
            className={`h-5 w-5 ${n <= value ? 'text-accent fill-accent' : 'text-muted-foreground'}`}
          />
        </button>
      ))}
    </div>
  );
}
