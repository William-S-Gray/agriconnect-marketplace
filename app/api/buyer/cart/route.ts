import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { requireRole, buyerIdForUser } from '@/lib/rbac';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';

export const runtime = 'nodejs';

/**
 * Cart operations.
 *
 * Every statement is scoped by the buyer id resolved from the session, never
 * from the request body — so there is no cart id a caller could substitute to
 * read or modify someone else's cart.
 */

async function buyerContext() {
  const auth = await requireRole('buyer');
  if (!auth.ok) return { ok: false as const, response: auth.response };

  const buyerId = await buyerIdForUser(auth.user.id);
  if (!buyerId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'No buyer profile for this account.', code: 'no_profile' },
        { status: 403 },
      ),
    };
  }
  return { ok: true as const, buyerId };
}

export async function GET() {
  const ctx = await buyerContext();
  if (!ctx.ok) return ctx.response;

  const items = await sql`
    SELECT c.id, c.listing_id, c.quantity,
           l.title, l.price_per_unit, l.quantity_unit, l.quantity_kg AS max_available,
           f.farm_name
      FROM cart_items c
      JOIN listings l ON l.id = c.listing_id
      JOIN farmers  f ON f.id = l.farmer_id
     WHERE c.buyer_id = ${ctx.buyerId}
     ORDER BY c.created_at
  `;
  return NextResponse.json({ items });
}

const addSchema = z.object({
  listingId: z.string().uuid(),
  quantity: z.coerce.number().positive().max(1_000_000),
});

export async function POST(request: Request) {
  const csrf = await verifyOrigin('POST');
  if (!csrf.ok) return csrfFailure();

  const ctx = await buyerContext();
  if (!ctx.ok) return ctx.response;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid cart item.', code: 'bad_request' }, { status: 400 });
  }

  // Price and stock come from the listing row, never from the client — a
  // tampered price in the request body has nowhere to land.
  const listing = await sql<{ quantity_kg: string; min_order_qty: string; status: string }>`
    SELECT l.quantity_kg, l.min_order_qty, l.status FROM listings l
      JOIN farmers f ON f.id = l.farmer_id
     WHERE l.id = ${parsed.data.listingId} AND l.is_available = TRUE
       AND f.status <> 'SUSPENDED'
     LIMIT 1
  `;
  const row = listing[0];
  if (!row || row.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'This listing is unavailable.', code: 'unavailable' }, { status: 409 });
  }

  const available = Number(row.quantity_kg);
  const minOrder = Number(row.min_order_qty);
  const requested = parsed.data.quantity;

  if (requested < minOrder) {
    return NextResponse.json(
      { error: `Minimum order is ${minOrder}.`, code: 'below_minimum' },
      { status: 400 },
    );
  }

  await sql`
    INSERT INTO cart_items (buyer_id, listing_id, quantity)
    VALUES (${ctx.buyerId}, ${parsed.data.listingId}, ${Math.min(requested, available)})
    ON CONFLICT (buyer_id, listing_id) DO UPDATE
      SET quantity = LEAST(cart_items.quantity + EXCLUDED.quantity, ${available}),
          updated_at = now()
  `;
  return NextResponse.json({ ok: true });
}

const patchSchema = z.object({
  listingId: z.string().uuid(),
  quantity: z.coerce.number().min(0).max(1_000_000),
});

export async function PATCH(request: Request) {
  const csrf = await verifyOrigin('PATCH');
  if (!csrf.ok) return csrfFailure();

  const ctx = await buyerContext();
  if (!ctx.ok) return ctx.response;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid quantity.', code: 'bad_request' }, { status: 400 });
  }

  if (parsed.data.quantity === 0) {
    await sql`
      DELETE FROM cart_items
       WHERE buyer_id = ${ctx.buyerId} AND listing_id = ${parsed.data.listingId}
    `;
    return NextResponse.json({ ok: true, removed: true });
  }

  await sql`
    UPDATE cart_items c
       SET quantity = LEAST(${parsed.data.quantity}, l.quantity_kg), updated_at = now()
      FROM listings l
     WHERE l.id = c.listing_id
       AND c.buyer_id = ${ctx.buyerId}
       AND c.listing_id = ${parsed.data.listingId}
  `;
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const csrf = await verifyOrigin('DELETE');
  if (!csrf.ok) return csrfFailure();

  const ctx = await buyerContext();
  if (!ctx.ok) return ctx.response;

  const url = new URL(request.url);
  const listingId = url.searchParams.get('listingId');

  if (listingId) {
    if (!/^[0-9a-f-]{36}$/i.test(listingId)) {
      return NextResponse.json({ error: 'Invalid listing.' }, { status: 400 });
    }
    await sql`DELETE FROM cart_items WHERE buyer_id = ${ctx.buyerId} AND listing_id = ${listingId}`;
  } else {
    await sql`DELETE FROM cart_items WHERE buyer_id = ${ctx.buyerId}`;
  }
  return NextResponse.json({ ok: true });
}
