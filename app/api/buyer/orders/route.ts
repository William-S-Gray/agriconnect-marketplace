import { NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { logError } from '@/lib/log';
import { sql, pool } from '@/lib/db';
import { requireRole, buyerIdForUser } from '@/lib/rbac';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';
import { PLATFORM_FEE_PERCENT } from '@/lib/mock-data';
import { newOrderReference } from '@/lib/order-lifecycle';

export const runtime = 'nodejs';

const schema = z.object({
  deliveryMethod: z.enum(['PICKUP', 'DELIVERY']).default('PICKUP'),
  deliveryAddress: z.string().trim().max(240).optional(),
  notes: z.string().trim().max(500).optional(),
});

/**
 * Checkout: turns the server-side cart into orders.
 *
 * Money is computed here from the listing rows, not from anything the client
 * sends — the request body carries only delivery preferences. The whole thing
 * runs in one transaction so a partial failure cannot leave orders without the
 * matching stock decrement.
 */
export async function POST(request: Request) {
  const csrf = await verifyOrigin('POST');
  if (!csrf.ok) return csrfFailure();

  // No payment provider is integrated. Recording an order as HELD_ESCROW means
  // telling the farmer "the money is held, ship it" — that is only acceptable
  // in an explicitly simulated deployment.
  if (!env.SIMULATED_PAYMENTS) {
    return NextResponse.json(
      { error: 'Payments are not available yet.', code: 'payments_unavailable' },
      { status: 503 },
    );
  }

  const auth = await requireRole('buyer');
  if (!auth.ok) return auth.response;

  const buyerId = await buyerIdForUser(auth.user.id);
  if (!buyerId) {
    return NextResponse.json({ error: 'No buyer profile.', code: 'no_profile' }, { status: 403 });
  }

  let body: unknown = {};
  try { body = await request.json(); } catch { /* empty body is fine */ }
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid checkout details.' }, { status: 400 });
  }
  const { deliveryMethod, deliveryAddress, notes } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the listings so two concurrent checkouts cannot oversell stock.
    const { rows: items } = await client.query(
      `SELECT c.listing_id, c.quantity, l.price_per_unit, l.quantity_kg, l.farmer_id, l.status,
              l.is_available, f.status AS farmer_status
         FROM cart_items c
         JOIN listings l ON l.id = c.listing_id
         JOIN farmers  f ON f.id = l.farmer_id
        WHERE c.buyer_id = $1
        FOR UPDATE OF l`,
      [buyerId],
    );

    if (items.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Your cart is empty.', code: 'empty_cart' }, { status: 400 });
    }

    const references: string[] = [];
    for (const item of items) {
      const quantity = Number(item.quantity);
      const available = Number(item.quantity_kg);

      if (item.status !== 'ACTIVE' || !item.is_available
          || item.farmer_status === 'SUSPENDED' || quantity > available) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'A listing in your cart is no longer available.', code: 'unavailable' },
          { status: 409 },
        );
      }

      const unitPrice = Number(item.price_per_unit);
      const total = +(quantity * unitPrice).toFixed(2);
      const fee = +((total * PLATFORM_FEE_PERCENT) / 100).toFixed(2);
      const payout = +(total - fee).toFixed(2);
      const reference = newOrderReference();

      await client.query(
        `INSERT INTO orders
           (reference, buyer_id, farmer_id, listing_id, quantity, unit_price, total_amount,
            platform_fee, farmer_payout, delivery_method, delivery_address, notes,
            status, payment_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'PENDING','HELD_ESCROW')`,
        [reference, buyerId, item.farmer_id, item.listing_id, quantity, unitPrice,
         total, fee, payout, deliveryMethod, deliveryAddress ?? null, notes ?? null],
      );

      await client.query(
        `UPDATE listings
            SET quantity_kg = quantity_kg - $1,
                status = CASE WHEN quantity_kg - $1 <= 0 THEN 'SOLD_OUT'::listing_status ELSE status END,
                updated_at = now()
          WHERE id = $2`,
        [quantity, item.listing_id],
      );

      references.push(reference);
    }

    await client.query('DELETE FROM cart_items WHERE buyer_id = $1', [buyerId]);
    await client.query('COMMIT');

    return NextResponse.json({ ok: true, references });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    // The driver error never reaches the client (it can carry connection
    // details); it is logged redacted instead of being swallowed.
    logError('checkout_failed', error, { buyerId });
    return NextResponse.json(
      { error: 'Checkout failed. Please try again.', code: 'checkout_failed' },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
