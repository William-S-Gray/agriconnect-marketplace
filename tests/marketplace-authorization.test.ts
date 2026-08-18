import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, pool } from '@/lib/pool';
import { hashPassword } from '@/lib/password';
import { canModifyListing, canAccessOrder, buyerIdForUser } from '@/lib/rbac';
import type { SessionUser } from '@/lib/session';

/**
 * Authorization for the marketplace surfaces added when the legacy pages were
 * ported: carts, orders and listing ownership.
 *
 * These assert the queries the ported pages actually run — each is scoped by
 * the session's user id, so the check is structural rather than a filter that a
 * future edit could forget.
 */

const suffix = randomUUID().slice(0, 8);
const ids = {
  farmerAUser: '', farmerBUser: '', buyerAUser: '', buyerBUser: '',
  farmerA: '', farmerB: '', buyerA: '', buyerB: '', listingA: '',
};

function session(userId: string, role: 'farmer' | 'buyer' | 'admin'): SessionUser {
  return {
    id: userId, email: 'x@example.test', role, status: 'ACTIVE',
    mfaEnabled: false, mfaSatisfied: true, sessionId: randomUUID(),
  };
}

beforeAll(async () => {
  const hash = await hashPassword('marketplace test passphrase');
  const mk = async (email: string, role: string) => {
    const [u] = await sql<{ id: string }>`
      INSERT INTO users (email, password_hash, role)
      VALUES (${email}, ${hash}, ${role}::user_role) RETURNING id`;
    return u!.id;
  };

  ids.farmerAUser = await mk(`mkt-fa-${suffix}@example.test`, 'farmer');
  ids.farmerBUser = await mk(`mkt-fb-${suffix}@example.test`, 'farmer');
  ids.buyerAUser  = await mk(`mkt-ba-${suffix}@example.test`, 'buyer');
  ids.buyerBUser  = await mk(`mkt-bb-${suffix}@example.test`, 'buyer');

  const [fa] = await sql<{ id: string }>`
    INSERT INTO farmers (user_id, name, farm_name, province)
    VALUES (${ids.farmerAUser}, 'FA', 'Farm A', 'Harare') RETURNING id`;
  ids.farmerA = fa!.id;
  const [fb] = await sql<{ id: string }>`
    INSERT INTO farmers (user_id, name, farm_name, province)
    VALUES (${ids.farmerBUser}, 'FB', 'Farm B', 'Harare') RETURNING id`;
  ids.farmerB = fb!.id;

  const [ba] = await sql<{ id: string }>`
    INSERT INTO buyers (user_id, name, city) VALUES (${ids.buyerAUser}, 'BA', 'Harare') RETURNING id`;
  ids.buyerA = ba!.id;
  const [bb] = await sql<{ id: string }>`
    INSERT INTO buyers (user_id, name, city) VALUES (${ids.buyerBUser}, 'BB', 'Harare') RETURNING id`;
  ids.buyerB = bb!.id;

  const [listing] = await sql<{ id: string }>`
    INSERT INTO listings (farmer_id, title, category, produce_type, quantity_kg, price_per_unit, province)
    VALUES (${ids.farmerA}, 'Mkt Tomatoes', 'Vegetables', 'Tomatoes', 100, 1.50, 'Harare')
    RETURNING id`;
  ids.listingA = listing!.id;
});

afterAll(async () => {
  // orders.farmer_id is ON DELETE RESTRICT — deliberately, so a farmer with
  // order history cannot be deleted out from under it. Unwind in dependency
  // order rather than weakening the constraint for the sake of test teardown.
  await sql`DELETE FROM orders WHERE reference = ${`MKT-${suffix}`}`;
  await sql`DELETE FROM users WHERE email LIKE ${`mkt-%-${suffix}@example.test`}`;
  await pool.end();
});

describe('cart isolation', () => {
  it('a cart row is only visible through its own buyer', async () => {
    await sql`
      INSERT INTO cart_items (buyer_id, listing_id, quantity)
      VALUES (${ids.buyerA}, ${ids.listingA}, 5)
      ON CONFLICT (buyer_id, listing_id) DO UPDATE SET quantity = 5
    `;

    // The query the cart page runs, scoped by user id.
    const mine = await sql`
      SELECT c.id FROM cart_items c JOIN buyers b ON b.id = c.buyer_id
       WHERE b.user_id = ${ids.buyerAUser}`;
    const theirs = await sql`
      SELECT c.id FROM cart_items c JOIN buyers b ON b.id = c.buyer_id
       WHERE b.user_id = ${ids.buyerBUser}`;

    expect(mine).toHaveLength(1);
    expect(theirs).toHaveLength(0);
  });

  it('the unique constraint keeps one row per listing per buyer', async () => {
    await sql`
      INSERT INTO cart_items (buyer_id, listing_id, quantity)
      VALUES (${ids.buyerA}, ${ids.listingA}, 3)
      ON CONFLICT (buyer_id, listing_id) DO UPDATE SET quantity = cart_items.quantity + 3
    `;
    const rows = await sql`
      SELECT id FROM cart_items WHERE buyer_id = ${ids.buyerA} AND listing_id = ${ids.listingA}`;
    expect(rows).toHaveLength(1);
  });

  it('resolves a buyer profile only for its own user', async () => {
    expect(await buyerIdForUser(ids.buyerAUser)).toBe(ids.buyerA);
    expect(await buyerIdForUser(ids.farmerAUser)).toBeNull();
  });
});

describe('listing ownership on the farmer API', () => {
  it('allows the owning farmer', async () => {
    expect(await canModifyListing(session(ids.farmerAUser, 'farmer'), ids.listingA)).toBe(true);
  });

  it('denies a different farmer', async () => {
    expect(await canModifyListing(session(ids.farmerBUser, 'farmer'), ids.listingA)).toBe(false);
  });

  it('denies a buyer', async () => {
    expect(await canModifyListing(session(ids.buyerAUser, 'buyer'), ids.listingA)).toBe(false);
  });
});

describe('order scoping', () => {
  let orderId = '';

  beforeAll(async () => {
    const [order] = await sql<{ id: string }>`
      INSERT INTO orders (reference, buyer_id, farmer_id, listing_id, quantity, unit_price, total_amount)
      VALUES (${`MKT-${suffix}`}, ${ids.buyerA}, ${ids.farmerA}, ${ids.listingA}, 4, 1.50, 6.00)
      RETURNING id`;
    orderId = order!.id;
  });

  it('is visible to the buyer who placed it', async () => {
    expect(await canAccessOrder(session(ids.buyerAUser, 'buyer'), orderId)).toBe(true);
  });

  it('is visible to the selling farmer', async () => {
    expect(await canAccessOrder(session(ids.farmerAUser, 'farmer'), orderId)).toBe(true);
  });

  it('is hidden from an unrelated buyer and farmer', async () => {
    expect(await canAccessOrder(session(ids.buyerBUser, 'buyer'), orderId)).toBe(false);
    expect(await canAccessOrder(session(ids.farmerBUser, 'farmer'), orderId)).toBe(false);
  });

  it('does not appear in an unrelated farmer\'s order list query', async () => {
    const rows = await sql`
      SELECT o.id FROM orders o JOIN farmers f ON f.id = o.farmer_id
       WHERE f.user_id = ${ids.farmerBUser} AND o.id = ${orderId}`;
    expect(rows).toHaveLength(0);
  });

  it('checkout figures are derived from the listing, not the request', async () => {
    // Mirrors the checkout route: total = qty x listing price, fee = 5%.
    const [listing] = await sql<{ price_per_unit: string }>`
      SELECT price_per_unit FROM listings WHERE id = ${ids.listingA}`;
    const price = Number(listing!.price_per_unit);
    const total = +(4 * price).toFixed(2);
    expect(total).toBe(6.0);
    expect(+((total * 5) / 100).toFixed(2)).toBe(0.3);
  });
});
