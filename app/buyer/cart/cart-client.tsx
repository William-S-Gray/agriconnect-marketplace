'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Minus, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EcoCashModal } from '@/components/EcoCashModal';
import { toast } from 'sonner';

interface CartItem {
  listingId: string;
  title: string;
  farmName: string;
  unit: string;
  quantity: number;
  pricePerUnit: number;
  maxAvailable: number;
}

const PRODUCE_EMOJIS: Record<string, string> = {
  Tomatoes: '🍅', Maize: '🌽', Butternut: '🎃', Lettuce: '🥬', Onions: '🧅',
  Eggs: '🥚', Milk: '🥛', Peas: '🫛',
};

function emojiFor(title: string): string {
  const found = Object.entries(PRODUCE_EMOJIS).find(([k]) =>
    title.toLowerCase().includes(k.toLowerCase()),
  );
  return found ? found[1] : '🥬';
}

/**
 * Cart interactions. Quantity edits and checkout both go through the API, which
 * re-reads price and stock from the listing row — the numbers rendered here are
 * display only and are never sent back as the source of truth.
 */
export function CartClient({
  items, total, feePercent,
}: { items: CartItem[]; total: number; feePercent: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  async function setQuantity(listingId: string, quantity: number) {
    setBusy(true);
    try {
      const res = await fetch('/api/buyer/cart', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ listingId, quantity }),
      });
      if (!res.ok) {
        toast.error('Could not update the cart.');
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onPaymentAuthorised() {
    const res = await fetch('/api/buyer/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ deliveryMethod: 'DELIVERY' }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      toast.error(data.error ?? 'Checkout failed.');
      return false;
    }
    toast.success(`Order ${data.references?.[0] ?? ''} placed. Payment held in escrow.`);
    router.push('/buyer/orders');
    router.refresh();
    return true;
  }

  return (
    <>
      <div className="space-y-4 mb-8">
        {items.map((item) => (
          <div key={item.listingId} className="neo-card p-4 flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl neo-inset flex items-center justify-center shrink-0 text-3xl">
              {emojiFor(item.title)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-heading font-semibold text-foreground text-sm line-clamp-1">{item.title}</h3>
              <p className="text-xs text-muted-foreground">{item.farmName}</p>
              <p className="price-display text-sm mt-1">
                ${item.pricePerUnit.toFixed(2)} / {item.unit}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="icon" disabled={busy}
                className="h-8 w-8 neo-flat border-none" aria-label="Decrease quantity"
                onClick={() => setQuantity(item.listingId, Math.max(1, item.quantity - 1))}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="font-mono text-sm w-10 text-center text-foreground">{item.quantity}</span>
              <Button
                variant="outline" size="icon" disabled={busy}
                className="h-8 w-8 neo-flat border-none" aria-label="Increase quantity"
                onClick={() => setQuantity(item.listingId, Math.min(item.maxAvailable, item.quantity + 1))}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="text-right">
              <p className="font-mono font-bold text-foreground">
                ${(item.quantity * item.pricePerUnit).toFixed(2)}
              </p>
              <button
                onClick={() => setQuantity(item.listingId, 0)}
                disabled={busy}
                aria-label={`Remove ${item.title}`}
                className="text-destructive hover:text-destructive/80 mt-1 transition-colors"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="neo-card p-6">
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Subtotal ({items.length} item{items.length !== 1 ? 's' : ''})
            </span>
            <span className="font-mono text-foreground">${total.toFixed(2)}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Platform fee ({feePercent}%) is deducted from the farmer payout — not added to your total.
          </div>
          <div className="border-t border-border/50 pt-2 flex justify-between items-center">
            <span className="font-semibold text-foreground">You Pay</span>
            <span className="font-mono text-2xl font-bold text-accent">${total.toFixed(2)}</span>
          </div>
        </div>

        <Button className="w-full btn-gold text-lg py-3 h-auto" onClick={() => setCheckoutOpen(true)}>
          📱 Pay with EcoCash
        </Button>
      </div>

      <EcoCashModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        amount={total}
        itemCount={items.length}
        onSuccess={() => { void onPaymentAuthorised(); }}
      />
    </>
  );
}
