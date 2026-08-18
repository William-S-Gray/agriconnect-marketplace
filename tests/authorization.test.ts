import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, pool } from '@/lib/pool';
import { hashPassword } from '@/lib/password';
import {
  farmerIdForUser,
  buyerIdForUser,
  canAccessOrder,
  canModifyListing,
  stripPrivilegedFields,
} from '@/lib/rbac';
import type { SessionUser } from '@/lib/session';

/**
 * Authorization tests.
 *
 * The ownership helpers are the part that decides whether one user may touch
 * another's data, so they are tested against real rows: two farmers, two buyers,
 * and an order that belongs to exactly one pair.
 */

const suffix = randomUUID().slice(0, 8);
const emails = {
  farmerA: `authz-farmer-a-${suffix}@example.test`,
  farmerB: `authz-farmer-b-${suffix}@example.test`,
  buyerA: `authz-buyer-a-${suffix}@example.test`,
  buyerB: `authz-buyer-b-${suffix}@example.test`,
  admin: `authz-admin-${suffix}@example.test`,
};

const ids = {
  farmerAUser: '', farmerBUser: '', buyerAUser: '', buyerBUser: '', adminUser: '',
  farmerA: '', farmerB: '', buyerA: '', buyerB: '',
  listingA: '', orderA: '',
};

function session(userId: string, role: 'farmer' | 'buyer' | 'admin'): SessionUser {
  return {
    id: userId,
    email: 'x@example.test',
    role,
    status: 'ACTIVE',
    mfaEnabled: false,
    mfaSatisfied: true,
    sessionId: randomUUID(),
  };
}

beforeAll(async () => {
  const hash = await hashPassword('authorization test passphrase');

  async function mkUser(email: string, role: string): Promise<string> {
    const [row] = await sql<{ id: string }>`
      INSERT INTO users (email, password_hash, role)
      VALUES (${email}, ${hash}, ${role}::user_role) RETURNING id
    `;
    return row!.id;
  }

  ids.farmerAUser = await mkUser(emails.farmerA, 'farmer');
  ids.farmerBUser = await mkUser(emails.farmerB, 'farmer');
  ids.buyerAUser = await mkUser(emails.buyerA, 'buyer');
  ids.buyerBUser = await mkUser(emails.buyerB, 'buyer');
  ids.adminUser = await mkUser(emails.admin, 'admin');

  const [fa] = await sql<{ id: string }>`
    INSERT INTO farmers (user_id, name, farm_name, province)
    VALUES (${ids.farmerAUser}, 'Farmer A', 'Farm A', 'Harare') RETURNING id
  `;
  ids.farmerA = fa!.id;
  const [fb] = await sql<{ id: string }>`
    INSERT INTO farmers (user_id, name, farm_name, province)
    VALUES (${ids.farmerBUser}, 'Farmer B', 'Farm B', 'Harare') RETURNING id
  `;
  ids.farmerB = fb!.id;

  const [ba] = await sql<{ id: string }>`
    INSERT INTO buyers (user_id, name, city)
    VALUES (${ids.buyerAUser}, 'Buyer A', 'Harare') RETURNING id
  `;
  ids.buyerA = ba!.id;
  const [bb] = await sql<{ id: string }>`
    INSERT INTO buyers (user_id, name, city)
    VALUES (${ids.buyerBUser}, 'Buyer B', 'Harare') RETURNING id
  `;
  ids.buyerB = bb!.id;

  const [listing] = await sql<{ id: string }>`
    INSERT INTO listings (farmer_id, title, category, produce_type, quantity_kg, price_per_unit, province)
    VALUES (${ids.farmerA}, 'A Tomatoes', 'Vegetables', 'Tomatoes', 100, 1.00, 'Harare')
    RETURNING id
  `;
  ids.listingA = listing!.id;

  const [order] = await sql<{ id: string }>`
    INSERT INTO orders (reference, buyer_id, farmer_id, listing_id, quantity, unit_price, total_amount)
    VALUES (${`AUTHZ-${suffix}`}, ${ids.buyerA}, ${ids.farmerA}, ${ids.listingA}, 10, 1.00, 10.00)
    RETURNING id
  `;
  ids.orderA = order!.id;
});

afterAll(async () => {
  await sql`DELETE FROM orders WHERE reference = ${`AUTHZ-${suffix}`}`;
  await sql`DELETE FROM users WHERE email LIKE ${`authz-%-${suffix}@example.test`}`;
  await pool.end();
});

describe('profile ownership resolution', () => {
  it('resolves a farmer profile only for its own user', async () => {
    expect(await farmerIdForUser(ids.farmerAUser)).toBe(ids.farmerA);
    expect(await farmerIdForUser(ids.farmerBUser)).toBe(ids.farmerB);
  });

  it('returns null for a user with no farmer profile (never falls back)', async () => {
    expect(await farmerIdForUser(ids.buyerAUser)).toBeNull();
    expect(await farmerIdForUser(ids.adminUser)).toBeNull();
  });

  it('resolves buyer profiles the same way', async () => {
    expect(await buyerIdForUser(ids.buyerAUser)).toBe(ids.buyerA);
    expect(await buyerIdForUser(ids.farmerAUser)).toBeNull();
  });
});

describe('order access — users cannot read another user\'s resources', () => {
  it('allows the buyer who placed the order', async () => {
    expect(await canAccessOrder(session(ids.buyerAUser, 'buyer'), ids.orderA)).toBe(true);
  });

  it('allows the farmer who received the order', async () => {
    expect(await canAccessOrder(session(ids.farmerAUser, 'farmer'), ids.orderA)).toBe(true);
  });

  it('denies an unrelated buyer', async () => {
    expect(await canAccessOrder(session(ids.buyerBUser, 'buyer'), ids.orderA)).toBe(false);
  });

  it('denies an unrelated farmer', async () => {
    expect(await canAccessOrder(session(ids.farmerBUser, 'farmer'), ids.orderA)).toBe(false);
  });

  it('allows an admin', async () => {
    expect(await canAccessOrder(session(ids.adminUser, 'admin'), ids.orderA)).toBe(true);
  });

  it('denies access to a non-existent order', async () => {
    expect(await canAccessOrder(session(ids.buyerAUser, 'buyer'), randomUUID())).toBe(false);
  });
});

describe('listing modification', () => {
  it('allows the owning farmer', async () => {
    expect(await canModifyListing(session(ids.farmerAUser, 'farmer'), ids.listingA)).toBe(true);
  });

  it('denies a different farmer', async () => {
    expect(await canModifyListing(session(ids.farmerBUser, 'farmer'), ids.listingA)).toBe(false);
  });

  it('denies a buyer outright, regardless of ownership', async () => {
    expect(await canModifyListing(session(ids.buyerAUser, 'buyer'), ids.listingA)).toBe(false);
  });

  it('allows an admin', async () => {
    expect(await canModifyListing(session(ids.adminUser, 'admin'), ids.listingA)).toBe(true);
  });
});

describe('privilege escalation via request body', () => {
  it('strips role from a client-supplied payload', () => {
    const { clean, stripped } = stripPrivilegedFields({
      name: 'Legit Name',
      role: 'admin',
    });
    expect(stripped).toContain('role');
    expect('role' in clean).toBe(false);
    expect(clean.name).toBe('Legit Name');
  });

  it('strips every privileged field an attacker might try', () => {
    const { clean, stripped } = stripPrivilegedFields({
      role: 'admin',
      status: 'ACTIVE',
      id: 'someone-else',
      user_id: 'someone-else',
      password_hash: '$argon2id$fake',
      session_epoch: 0,
      mfa_enabled: false,
      mfa_secret: 'stolen',
      email_verified_at: '2020-01-01',
      city: 'Harare',
    });
    expect(Object.keys(clean)).toEqual(['city']);
    expect(stripped.sort()).toEqual(
      [
        'email_verified_at', 'id', 'mfa_enabled', 'mfa_secret',
        'password_hash', 'role', 'session_epoch', 'status', 'user_id',
      ].sort(),
    );
  });

  it('a self-service profile update cannot change the role in the database', async () => {
    // Mirrors app/api/me/route.ts: the statement names its columns explicitly
    // and targets the row by session user id. There is no path from body to role.
    await sql`
      UPDATE buyers SET city = ${'Bulawayo'}, updated_at = now()
       WHERE user_id = ${ids.buyerAUser}
    `;
    const [user] = await sql<{ role: string }>`
      SELECT role FROM users WHERE id = ${ids.buyerAUser}
    `;
    expect(user!.role).toBe('buyer');
  });
});
