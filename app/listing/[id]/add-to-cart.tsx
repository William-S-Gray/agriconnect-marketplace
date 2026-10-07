'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ShoppingCart, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/**
 * Add-to-cart control.
 *
 * `canBuy` only decides what to render. The API independently requires a buyer
 * session and re-reads the price and stock from the listing row, so a farmer or
 * an anonymous visitor calling it directly is rejected regardless of this UI.
 */
export function AddToCart({
  listingId, title, unit, pricePerUnit, minOrder, maxAvailable, farmName, canBuy, isAuthenticated,
}: {
  listingId: string;
  title: string;
  unit: string;
  pricePerUnit: number;
  minOrder: number;
  maxAvailable: number;
  farmName: string;
  canBuy: boolean;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(Math.max(1, minOrder));
  const [submitting, setSubmitting] = useState(false);

  // Reachable by direct link even when stock runs out; say so instead of
  // offering a button the server will refuse.
  if (maxAvailable <= 0) {
    return <p className="text-sm text-muted-foreground neo-flat rounded-xl p-3">Sold out for now.</p>;
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Sign in as a buyer to order.</p>
        <Link href={`/login?next=${encodeURIComponent(`/listing/${listingId}`)}`}>
          <Button className="w-full neo-btn bg-primary text-primary-foreground">Sign in to order</Button>
        </Link>
      </div>
    );
  }

  if (!canBuy) {
    return (
      <p className="text-sm text-muted-foreground neo-flat rounded-xl p-3">
        You are signed in with an account that cannot place orders. Only buyer
        accounts can purchase from {farmName}.
      </p>
    );
  }

  async function addToCart() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/buyer/cart', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ listingId, quantity }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data.error ?? 'Could not add to cart.');
        return;
      }
      toast.success(`${title} added to your cart.`);
      router.refresh();
    } catch {
      toast.error('Could not reach the server.');
    } finally {
      setSubmitting(false);
    }
  }

  const total = (quantity * pricePerUnit).toFixed(2);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button
          variant="outline" size="icon" className="h-9 w-9 neo-flat"
          aria-label="Decrease quantity"
          onClick={() => setQuantity((q) => Math.max(minOrder, q - 1))}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="tabular-nums text-foreground w-20 text-center">
          {quantity} {unit}
        </span>
        <Button
          variant="outline" size="icon" className="h-9 w-9 neo-flat"
          aria-label="Increase quantity"
          onClick={() => setQuantity((q) => Math.min(maxAvailable, q + 1))}
        >
          <Plus className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">
          Total <strong className="text-foreground tabular-nums">${total}</strong>
        </span>
      </div>

      <Button onClick={addToCart} disabled={submitting} className="w-full btn-gold">
        {submitting ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding…</>
        ) : (
          <><ShoppingCart className="h-4 w-4 mr-2" /> Add to cart</>
        )}
      </Button>
    </div>
  );
}
