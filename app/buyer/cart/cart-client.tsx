'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Minus, Plus, Loader2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EcoCashModal } from '@/components/EcoCashModal';
import { toast } from 'sonner';
import { ProduceArt } from '@/components/ProduceArt';

interface CartItem {
  listingId: string;
  title: string;
  category: string;
  produceType: string;
  farmName: string;
  unit: string;
  quantity: number;
  pricePerUnit: number;
  maxAvailable: number;
  minOrder: number;
}

/**
 * Cart interactions. Quantity edits and checkout both go through the API, which
 * re-reads price and stock from the listing row — the numbers rendered here are
 * display only and are never sent back as the source of truth.
 */
export function CartClient({
  items, total, feePercent,
  defaultAddress, paymentsEnabled,
}: { items: CartItem[]; total: number; feePercent: number; defaultAddress: string; paymentsEnabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [delivery, setDelivery] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [address, setAddress] = useState(defaultAddress);
  const needsAddress = delivery === 'DELIVERY' && address.trim().length < 5;

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

  async function onPaymentAuthorised(): Promise<string | null> {
    const res = await fetch('/api/buyer/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        deliveryMethod: delivery,
        ...(delivery === 'DELIVERY' ? { deliveryAddress: address.trim() } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const reason = data.error ?? 'Checkout failed. Please try again.';
      toast.error(reason);
      return reason;
    }
    toast.success(`Order ${data.references?.[0] ?? ''} placed. Payment held in escrow.`);
    router.push('/buyer/orders');
    router.refresh();
    return null;
  }

  return (
    <>
      <div className="space-y-4 mb-8">
        {items.map((item) => (
          <div key={item.listingId} className="neo-card p-4 flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
              <ProduceArt category={item.category} produceType={item.produceType} size="sm" />
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
                variant="outline" size="icon"
                className="h-8 w-8 neo-flat" aria-label="Decrease quantity"
                disabled={busy || item.quantity - 1 < item.minOrder}
                title={item.quantity - 1 < item.minOrder ? `Minimum order is ${item.minOrder}` : undefined}
                onClick={() => setQuantity(item.listingId, item.quantity - 1)}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="tabular-nums text-sm w-10 text-center text-foreground">{item.quantity}</span>
              <Button
                variant="outline" size="icon" disabled={busy}
                className="h-8 w-8 neo-flat" aria-label="Increase quantity"
                onClick={() => setQuantity(item.listingId, Math.min(item.maxAvailable, item.quantity + 1))}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="text-right">
              <p className="tabular-nums font-bold text-foreground">
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
            <span className="tabular-nums text-foreground">${total.toFixed(2)}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Platform fee ({feePercent}%) is deducted from the farmer payout — not added to your total.
          </div>
          <div className="border-t border-border/50 pt-2 flex justify-between items-center">
            <span className="font-semibold text-foreground">You Pay</span>
            <span className="tabular-nums text-2xl font-bold text-foreground">${total.toFixed(2)}</span>
          </div>
        </div>

        <fieldset className="mb-4 space-y-3">
          <legend className="text-sm font-semibold text-foreground mb-2">How do you want it?</legend>
          <div className="grid grid-cols-2 gap-3">
            {([['PICKUP', 'Pick up from the farm'], ['DELIVERY', 'Deliver to me']] as const).map(([value, label]) => (
              <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-xl p-3 text-sm ${delivery === value ? 'neo-inset text-foreground font-medium' : 'neo-flat text-muted-foreground'}`}>
                <input type="radio" name="delivery" value={value} checked={delivery === value}
                  onChange={() => setDelivery(value)} className="accent-primary" />
                {label}
              </label>
            ))}
          </div>
          {delivery === 'DELIVERY' && (
            <div>
              <label htmlFor="delivery-address" className="text-sm text-foreground">Delivery address</label>
              <textarea id="delivery-address" rows={2} maxLength={240} value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 w-full rounded-xl neo-inset bg-transparent p-3 text-sm text-foreground"
                placeholder="Street, suburb and town" />
            </div>
          )}
        </fieldset>

        {paymentsEnabled ? (
          <Button className="w-full btn-gold text-lg py-3 h-auto" onClick={() => setCheckoutOpen(true)} disabled={needsAddress}>
            <Smartphone className="h-5 w-5 mr-2" aria-hidden /> Pay with EcoCash
          </Button>
        ) : (
          // Checkout is refused server-side until a payment provider is
          // connected; say so here rather than after the buyer fills the form.
          <p role="status" className="rounded-lg border border-border bg-secondary/60 p-4 text-sm text-foreground">
            <strong className="font-semibold">Online payment is coming soon.</strong>{' '}
            <span className="text-muted-foreground">Your cart is saved, so you can check out as soon as it opens.</span>
          </p>
        )}
      </div>

      <EcoCashModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        amount={total}
        itemCount={items.length}
        onSuccess={onPaymentAuthorised}
      />
    </>
  );
}
