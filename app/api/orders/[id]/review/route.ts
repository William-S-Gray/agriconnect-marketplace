import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql, pool } from '@/lib/db';
import { requireUser } from '@/lib/rbac';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';
import { logError } from '@/lib/log';
import {
  checkReviewEligibility,
  RECALCULATE_FARMER_RATING,
  MIN_RATING,
  MAX_RATING,
  MAX_COMMENT_LENGTH,
} from '@/lib/reviews';
import type { OrderStatus } from '@/lib/order-lifecycle';

export const runtime = 'nodejs';

const schema = z.object({
  rating: z.coerce.number().int().min(MIN_RATING).max(MAX_RATING),
  comment: z.string().trim().max(MAX_COMMENT_LENGTH).optional(),
});

/**
 * Leaves a review for a completed order.
 *
 * The farmer and buyer are taken from the order row, never from the request, so
 * a review cannot be attributed to a different farmer than the one who actually
 * fulfilled it.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const csrf = verifyOrigin('POST');
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

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Choose a rating between ${MIN_RATING} and ${MAX_RATING} stars.`, code: 'bad_request' },
      { status: 400 },
    );
  }

  const rows = await sql<{
    id: string; status: OrderStatus; farmer_id: string; buyer_id: string;
    is_buyer: boolean; reviewed: boolean;
  }>`
    SELECT o.id, o.status, o.farmer_id, o.buyer_id,
           (b.user_id = ${auth.user.id}) AS is_buyer,
           EXISTS (SELECT 1 FROM reviews r WHERE r.order_id = o.id) AS reviewed
      FROM orders o
      JOIN buyers b ON b.id = o.buyer_id
     WHERE o.id = ${params.id}
     LIMIT 1
  `;

  const order = rows[0];
  // A non-party is told nothing about whether the order exists.
  if (!order || (!order.is_buyer && auth.user.role !== 'admin')) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const eligibility = checkReviewEligibility({
    isBuyer: order.is_buyer,
    status: order.status,
    alreadyReviewed: order.reviewed,
  });

  if (!eligibility.ok) {
    // not_buyer is an authorization failure; the others are conflicts with the
    // order's current state.
    const status = eligibility.reason === 'not_buyer' ? 403 : 409;
    return NextResponse.json(
      { error: eligibility.message, code: eligibility.reason },
      { status },
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // reviews.order_id is UNIQUE, so a concurrent duplicate loses here rather
    // than creating a second review and double-counting the rating.
    const inserted = await client.query(
      `INSERT INTO reviews (order_id, farmer_id, buyer_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (order_id) DO NOTHING
       RETURNING id`,
      [order.id, order.farmer_id, order.buyer_id,
       parsed.data.rating, parsed.data.comment ?? ''],
    );

    if (inserted.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'You have already reviewed this order.', code: 'already_reviewed' },
        { status: 409 },
      );
    }

    await client.query(RECALCULATE_FARMER_RATING, [order.farmer_id]);
    await client.query('COMMIT');

    const [farmer] = await sql<{ rating: string; total_reviews: number }>`
      SELECT rating, total_reviews FROM farmers WHERE id = ${order.farmer_id}
    `;

    return NextResponse.json({
      ok: true,
      farmerRating: Number(farmer?.rating ?? 0),
      farmerReviews: farmer?.total_reviews ?? 0,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    logError('review_failed', error, { orderId: order.id });
    return NextResponse.json(
      { error: 'Could not save your review. Please try again.', code: 'review_failed' },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
