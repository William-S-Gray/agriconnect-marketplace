'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/**
 * A single listing with its status control.
 *
 * The API re-checks ownership on every call, so this row being rendered is not
 * what authorises the change — it only makes it convenient.
 */
export function ListingRow({
  id, title, status, price, quantity, unit, views,
}: {
  id: string; title: string; status: string;
  price: number; quantity: number; unit: string; views: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(next: 'ACTIVE' | 'REMOVED') {
    setBusy(true);
    try {
      const res = await fetch('/api/farmer/listings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id, status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Could not update the listing.');
        return;
      }
      toast.success(next === 'ACTIVE' ? 'Listing published.' : 'Listing removed.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="neo-card p-4 flex items-center gap-4 flex-wrap">
      <div className="flex-1 min-w-[200px]">
        <Link href={`/listing/${id}`} className="font-heading font-semibold text-foreground hover:text-primary">
          {title}
        </Link>
        <p className="text-xs text-muted-foreground mt-1">
          ${price.toFixed(2)} / {unit} · {quantity} {unit} available
        </p>
      </div>
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Eye className="h-3 w-3" /> {views}
      </span>
      <span className="text-xs text-muted-foreground w-20">{status}</span>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        className="neo-flat text-xs"
        onClick={() => setStatus(status === 'REMOVED' ? 'ACTIVE' : 'REMOVED')}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : status === 'REMOVED' ? 'Republish' : 'Remove'}
      </Button>
    </li>
  );
}
