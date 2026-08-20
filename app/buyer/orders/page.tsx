import Link from 'next/link';
import { requirePageRole } from '@/lib/page-guard';
import { sql } from '@/lib/db';
import { num, iso } from '@/lib/serialize';
import { SiteNav } from '@/components/SiteNav';
import { Footer } from '@/components/Footer';
import { OrderTimeline } from '@/components/OrderTimeline';
import { OrderActions } from '@/components/OrderActions';
import { ReviewForm } from '@/components/ReviewForm';
import { availableActions, type OrderStatus } from '@/lib/order-lifecycle';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function BuyerOrdersPage() {
  const session = await requirePageRole(['buyer'], '/buyer/orders');

  // Joined through buyers.user_id: the query cannot return another buyer's
  // orders, so there is no post-filtering to get wrong.
  const orders = await sql<{
    id: string; reference: string; status: string; payment_status: string;
    quantity: string; unit_price: string; total_amount: string; created_at: Date;
    listing_title: string; farm_name: string; farmer_id: string;
    review_rating: number | null; review_comment: string | null;
  }>`
    SELECT o.id, o.reference, o.status, o.payment_status, o.quantity, o.unit_price,
           o.total_amount, o.created_at, l.title AS listing_title,
           f.farm_name, f.id AS farmer_id,
           r.rating AS review_rating, r.comment AS review_comment
      FROM orders o
      JOIN buyers   b ON b.id = o.buyer_id
      JOIN listings l ON l.id = o.listing_id
      JOIN farmers  f ON f.id = o.farmer_id
      LEFT JOIN reviews r ON r.order_id = o.id
     WHERE b.user_id = ${session.id}
     ORDER BY o.created_at DESC
  `;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />
      <main className="container mx-auto px-4 py-8 flex-1 max-w-3xl">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-6">My Orders</h1>

        {orders.length === 0 ? (
          <div className="neo-card p-12 text-center">
            <p className="text-muted-foreground mb-4">You have not placed any orders yet.</p>
            <Link href="/browse">
              <Button className="neo-btn bg-primary text-primary-foreground">Browse produce</Button>
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {orders.map((o) => (
              <li key={o.id} className="neo-card p-5">
                <div className="flex justify-between items-start flex-wrap gap-3">
                  <div>
                    <p className="font-heading font-semibold text-foreground">{o.listing_title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {o.reference} ·{' '}
                      <Link href={`/farmer/${o.farmer_id}`} className="hover:text-primary">
                        {o.farm_name}
                      </Link>{' '}
                      · {iso(o.created_at).slice(0, 10)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {num(o.quantity)} × ${num(o.unit_price).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-foreground">
                      ${num(o.total_amount).toFixed(2)}
                    </p>
                    <p className="text-xs text-accent mt-1">{o.payment_status.replace('_', ' ')}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <OrderTimeline status={o.status} />
                </div>
                <OrderActions
                  orderId={o.id}
                  actions={availableActions(o.status as OrderStatus, 'buyer')}
                />
                {/* Only a completed order is reviewable; the endpoint enforces
                    the same rule, so this only decides what to render. */}
                {o.status === 'COMPLETED' && (
                  <ReviewForm
                    orderId={o.id}
                    farmName={o.farm_name}
                    existing={
                      o.review_rating !== null
                        ? { rating: o.review_rating, comment: o.review_comment ?? '' }
                        : null
                    }
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}
