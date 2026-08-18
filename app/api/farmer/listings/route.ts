import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { requireRole, farmerIdForUser, canModifyListing } from '@/lib/rbac';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';

export const runtime = 'nodejs';

const createSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().min(2).max(60),
  produce_type: z.string().trim().min(2).max(60),
  quantity_kg: z.coerce.number().positive().max(1_000_000),
  quantity_unit: z.string().trim().min(1).max(20),
  price_per_unit: z.coerce.number().nonnegative().max(1_000_000),
  min_order_qty: z.coerce.number().positive().max(1_000_000).default(1),
  harvest_date: z.string().trim().max(10).optional(),
  available_until: z.string().trim().max(10).optional(),
  province: z.string().trim().min(2).max(80),
  district: z.string().trim().max(80).default(''),
  is_organic: z.boolean().default(false),
  delivery_options: z.array(z.string().max(40)).max(10).default([]),
});

/**
 * Creates a listing for the signed-in farmer.
 *
 * farmer_id comes from the session's farmer profile, never from the body — a
 * farmer cannot create a listing attributed to someone else.
 */
export async function POST(request: Request) {
  const csrf = verifyOrigin('POST');
  if (!csrf.ok) return csrfFailure();

  const auth = await requireRole('farmer');
  if (!auth.ok) return auth.response;

  const farmerId = await farmerIdForUser(auth.user.id);
  if (!farmerId) {
    return NextResponse.json({ error: 'No farmer profile.', code: 'no_profile' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Please check the listing details.', code: 'validation_failed',
        fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const rows = await sql<{ id: string }>`
    INSERT INTO listings
      (farmer_id, title, description, category, produce_type, quantity_kg, quantity_unit,
       price_per_unit, min_order_qty, harvest_date, available_until, province, district,
       is_organic, delivery_options, status)
    VALUES
      (${farmerId}, ${d.title}, ${d.description ?? null}, ${d.category}, ${d.produce_type},
       ${d.quantity_kg}, ${d.quantity_unit}, ${d.price_per_unit}, ${d.min_order_qty},
       ${d.harvest_date || null}, ${d.available_until || null}, ${d.province}, ${d.district},
       ${d.is_organic}, ${d.delivery_options}, 'ACTIVE')
    RETURNING id
  `;

  return NextResponse.json({ ok: true, id: rows[0]!.id });
}

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['ACTIVE', 'SOLD_OUT', 'EXPIRED', 'REMOVED']).optional(),
  price_per_unit: z.coerce.number().nonnegative().max(1_000_000).optional(),
  quantity_kg: z.coerce.number().nonnegative().max(1_000_000).optional(),
});

/** Updates a listing. Ownership is checked before anything is written. */
export async function PATCH(request: Request) {
  const csrf = verifyOrigin('PATCH');
  if (!csrf.ok) return csrfFailure();

  const auth = await requireRole('farmer', 'admin');
  if (!auth.ok) return auth.response;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid update.', code: 'bad_request' }, { status: 400 });
  }

  // 403 rather than 404: the listing may well exist, it just is not theirs.
  if (!(await canModifyListing(auth.user, parsed.data.id))) {
    return NextResponse.json(
      { error: 'You do not have permission to modify this listing.', code: 'forbidden' },
      { status: 403 },
    );
  }

  const d = parsed.data;
  await sql`
    UPDATE listings
       SET status         = COALESCE(${d.status ?? null}::listing_status, status),
           price_per_unit = COALESCE(${d.price_per_unit ?? null}, price_per_unit),
           quantity_kg    = COALESCE(${d.quantity_kg ?? null}, quantity_kg),
           updated_at     = now()
     WHERE id = ${d.id}
  `;
  return NextResponse.json({ ok: true });
}
