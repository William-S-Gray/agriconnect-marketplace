import { requirePageRole } from '@/lib/page-guard';
import { sql } from '@/lib/db';
import { formatDate, iso, num, paymentLabel, deliveryLabel } from '@/lib/serialize';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { FarmShell } from '../farm-shell';
import { OrderTimeline } from '@/components/OrderTimeline';
import { OrderActions } from '@/components/OrderActions';
import { availableActions, type OrderStatus } from '@/lib/order-lifecycle';

export const dynamic = 'force-dynamic';

export default async function FarmerOrdersPage() {
  const session = await requirePageRole(['farmer'], '/farm/orders');

  const [profile] = await sql<{ name: string; farm_name: string; status: string }>`
    SELECT name, farm_name, status FROM farmers WHERE user_id = ${session.id}
  `;

  // Scoped through farmers.user_id — a farmer sees only orders placed with them.
  const orders = await sql<{
    id: string; reference: string; status: string; payment_status: string;
    quantity: string; unit_price: string; total_amount: string; farmer_payout: string;
    created_at: Date; buyer_name: string; listing_title: string;
    delivery_method: string; delivery_address: string | null; notes: string | null; buyer_phone: string;
  }>`
    SELECT o.id, o.reference, o.status, o.payment_status, o.quantity, o.unit_price,
           o.total_amount, o.farmer_payout, o.created_at,
           b.name AS buyer_name, l.title AS listing_title,
           o.delivery_method, o.delivery_address, o.notes, b.phone AS buyer_phone
      FROM orders o
      JOIN farmers  f ON f.id = o.farmer_id
      JOIN buyers   b ON b.id = o.buyer_id
      JOIN listings l ON l.id = o.listing_id
     WHERE f.user_id = ${session.id}
     ORDER BY o.created_at DESC
     LIMIT 100 -- ponytail: newest 100; add pagination when accounts outgrow it
  `;

  return (
    <FarmShell name={profile?.name ?? ''} farmName={profile?.farm_name ?? ''} status={profile?.status ?? 'PENDING'}>
      <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Orders</h1>

      {orders.length === 0 ? (
        <p className="text-muted-foreground">No orders yet.</p>
      ) : (
        <ul className="space-y-4 max-w-3xl">
          {orders.map((o) => (
            <li key={o.id} className="neo-card p-5">
              <div className="flex justify-between items-start flex-wrap gap-3">
                <div>
                  <p className="font-heading font-semibold text-foreground">{o.listing_title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {o.reference} · {o.buyer_name} · {formatDate(o.created_at)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {num(o.quantity)} × ${num(o.unit_price).toFixed(2)}
                  </p>
                  {/* Without these the farmer could not tell a pickup from a
                      delivery, where to deliver, or how to reach the buyer. */}
                  <p className="text-xs text-foreground mt-2">
                    <span className="font-semibold">{deliveryLabel(o.delivery_method)}</span>
                    {o.delivery_method === 'DELIVERY' && o.delivery_address ? ` to ${o.delivery_address}` : ''}
                    {o.buyer_phone ? <> · <a href={`tel:${o.buyer_phone}`} className="text-primary underline underline-offset-2">{o.buyer_phone}</a></> : null}
                  </p>
                  {o.notes && <p className="text-xs text-muted-foreground mt-1">Note: {o.notes}</p>}
                </div>
                <div className="sm:text-right">
                  <p className="tabular-nums font-bold text-foreground">
                    ${num(o.total_amount).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You receive ${num(o.farmer_payout).toFixed(2)}
                  </p>
                  <div className="mt-1 flex items-center sm:justify-end gap-2">
                      <OrderStatusBadge status={o.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Payment: {paymentLabel(o.payment_status)}</p>
                </div>
              </div>
              <div className="mt-4">
                <OrderTimeline status={o.status} />
              </div>
              {/* Computed server-side from the order's state and this farmer's
                  relationship to it; the API re-checks on every request. */}
              <OrderActions
                orderId={o.id}
                actions={availableActions(o.status as OrderStatus, 'farmer')}
              />
            </li>
          ))}
        </ul>
      )}
    </FarmShell>
  );
}
