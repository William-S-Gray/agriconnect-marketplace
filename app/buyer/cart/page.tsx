import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { requirePageRole } from '@/lib/page-guard';
import { sql } from '@/lib/db';
import { num } from '@/lib/serialize';
import { PLATFORM_FEE_PERCENT } from '@/lib/mock-data';
import { SiteNav } from '@/components/SiteNav';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { CartClient } from './cart-client';

export const dynamic = 'force-dynamic';

/**
 * The cart is server state now, read straight from cart_items. Nothing about it
 * lives in the browser, so it survives a device change and cannot be edited by
 * hand to change prices — the totals below are computed from the listing rows.
 */
export default async function CartPage() {
  const session = await requirePageRole(['buyer'], '/buyer/cart');

  const items = await sql<{
    listing_id: string; quantity: string; title: string;
    price_per_unit: string; quantity_unit: string; max_available: string; farm_name: string;
  }>`
    SELECT c.listing_id, c.quantity, l.title, l.price_per_unit,
           l.quantity_unit, l.quantity_kg AS max_available, f.farm_name
      FROM cart_items c
      JOIN buyers   b ON b.id = c.buyer_id
      JOIN listings l ON l.id = c.listing_id
      JOIN farmers  f ON f.id = l.farmer_id
     WHERE b.user_id = ${session.id}
     ORDER BY c.created_at
  `;

  const cart = items.map((i) => ({
    listingId: i.listing_id,
    title: i.title,
    farmName: i.farm_name,
    unit: i.quantity_unit,
    quantity: num(i.quantity),
    pricePerUnit: num(i.price_per_unit),
    maxAvailable: num(i.max_available),
  }));

  const total = cart.reduce((sum, i) => sum + i.quantity * i.pricePerUnit, 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav cartCount={cart.length} />
      <main className="container mx-auto px-4 py-8 flex-1 max-w-3xl">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Your Cart</h1>

        {cart.length === 0 ? (
          <div className="text-center py-20">
            <div className="neo-card w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-4">Your cart is empty.</p>
            <Link href="/browse">
              <Button className="neo-btn bg-primary text-primary-foreground">Browse Produce</Button>
            </Link>
          </div>
        ) : (
          <CartClient items={cart} total={total} feePercent={PLATFORM_FEE_PERCENT} />
        )}
      </main>
      <Footer />
    </div>
  );
}
