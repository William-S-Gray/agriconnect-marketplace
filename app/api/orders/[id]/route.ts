import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql, pool } from '@/lib/db';
import { requireUser } from '@/lib/rbac';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';
import {
  checkTransition,
  availableActions,
  type OrderStatus,
  type Party,
} from '@/lib/order-lifecycle';

export const runtime = 'nodejs';

const patchSchema = z.object({
  action: z.string().min(1).max(40),
  /** Required when raising a dispute. */
  reason: z.string().trim().min(3).max(160).optional(),
  description: z.string().trim().max(2000).optional(),
  /** Admin note recorded when resolving a dispute. */
  resolution: z.string().trim().max(2000).optional(),
});

interface OrderRow {
  id: string;
  status: OrderStatus;
  payment_status: string;
  quantity: string;
  listing_id: string;
  farmer_id: string;
  buyer_id: string;
  farmer_payout: string;
  is_buyer: boolean;
  is_farmer: boolean;
}

/**
 * Loads the order together with the caller's relationship to it, in one query.
 *
 * The party flags come from joins on user_id, so a caller can only ever be a
 * party to orders they are genuinely on -- there is no id in the request that
 * could make them one.
 */
async function loadOrder(orderId: string, userId: string): Promise<OrderRow | null> {
  const rows = await sql<OrderRow>`
    SELECT o.id, o.status, o.payment_status, o.quantity, o.listing_id,
           o.farmer_id, o.buyer_id, o.farmer_payout,
           (b.user_id = ${userId}) AS is_buyer,
           (f.user_id = ${userId}) AS is_farmer
      FROM orders o
      JOIN buyers  b ON b.id = o.buyer_id
      JOIN farmers f ON f.id = o.farmer_id
     WHERE o.id = ${orderId}
     LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const order = await loadOrder(params.id, auth.user.id);
  if (!order) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const party = partyFor(order, auth.user.role);
  // An admin is a party to every order; anyone else must be on it.
  if (!party) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  return NextResponse.json({
    order: {
      id: order.id,
      status: order.status,
      paymentStatus: order.payment_status,
    },
    availableActions: availableActions(order.status, party),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const csrf = verifyOrigin('PATCH');
  if (!csrf.ok) return csrfFailure();

  if (!/^[0-9a-f-]{36}$/i.test(params.id)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request.', code: 'bad_request' },
      { status: 400 },
    );
  }

  const order = await loadOrder(params.id, auth.user.id);
  // 404 rather than 403 for a non-party: whether an order exists is itself
  // information they are not entitled to.
  if (!order) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const party = partyFor(order, auth.user.role);
  if (!party) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const check = checkTransition(parsed.data.action, order.status, party);
  if (!check.ok) {
    const status =
      check.code === 'forbidden' ? 403 : check.code === 'invalid_state' ? 409 : 400;
    return NextResponse.json({ error: check.message, code: check.code }, { status });
  }

  const t = check.transition;
  if (t.opensDispute && !parsed.data.reason) {
    return NextResponse.json(
      { error: 'A reason is required to raise a dispute.', code: 'reason_required' },
      { status: 400 },
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Re-read under a row lock and re-check: without this, two concurrent
    // requests could both pass the check above and apply conflicting
    // transitions to the same order.
    const { rows: locked } = await client.query(
      'SELECT status FROM orders WHERE id = $1 FOR UPDATE',
      [order.id],
    );
    const currentStatus = locked[0]?.status as OrderStatus | undefined;
    if (!currentStatus) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }
    const recheck = checkTransition(parsed.data.action, currentStatus, party);
    if (!recheck.ok) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: recheck.message, code: recheck.code },
        { status: recheck.code === 'forbidden' ? 403 : 409 },
      );
    }

    await client.query(
      `UPDATE orders
          SET status = $1::order_status,
              payment_status = COALESCE($2::payment_status, payment_status),
              buyer_confirmed = COALESCE($3::boolean, buyer_confirmed),
              updated_at = now()
        WHERE id = $4`,
      [t.to, t.payment ?? null, t.setsBuyerConfirmed ? true : null, order.id],
    );

    if (t.restoresStock) {
      // Cancelled and refunded orders put the reserved quantity back, and a
      // listing that had sold out becomes available again.
      await client.query(
        `UPDATE listings
            SET quantity_kg = quantity_kg + $1,
                status = CASE WHEN status = 'SOLD_OUT' THEN 'ACTIVE'::listing_status ELSE status END,
                updated_at = now()
          WHERE id = $2`,
        [order.quantity, order.listing_id],
      );
    }

    if (t.creditsFarmer) {
      // total_sales tracks released payouts, so it only moves when escrow does.
      await client.query(
        `UPDATE farmers
            SET total_sales = total_sales + $1, updated_at = now()
          WHERE id = $2`,
        [Math.round(Number(order.farmer_payout)), order.farmer_id],
      );
    }

    if (t.opensDispute) {
      await client.query(
        `INSERT INTO disputes (order_id, raised_by, reason, description, status)
         VALUES ($1, $2::dispute_party, $3, $4, 'OPEN')`,
        [order.id, party === 'farmer' ? 'FARMER' : 'BUYER',
         parsed.data.reason, parsed.data.description ?? ''],
      );
    }

    if (t.closesDispute) {
      await client.query(
        `UPDATE disputes
            SET status = $1::dispute_status,
                resolution = COALESCE($2, resolution),
                updated_at = now()
          WHERE order_id = $3 AND status IN ('OPEN', 'INVESTIGATING')`,
        [t.closesDispute, parsed.data.resolution ?? null, order.id],
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({
      ok: true,
      status: t.to,
      paymentStatus: t.payment ?? order.payment_status,
      availableActions: availableActions(t.to, party),
    });
  } catch {
    await client.query('ROLLBACK').catch(() => {});
    // The driver error is swallowed: it can carry connection details.
    return NextResponse.json(
      { error: 'Could not update the order. Please try again.', code: 'update_failed' },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

function partyFor(order: OrderRow, role: string): Party | null {
  if (order.is_buyer) return 'buyer';
  if (order.is_farmer) return 'farmer';
  if (role === 'admin') return 'admin';
  return null;
}
