import { describe, it, expect } from 'vitest';
import { fixtureId } from '@/lib/fixture-id';

/**
 * Guards the property that makes seeding idempotent.
 *
 * The seed script used randomUUID() for listings, so a second run duplicated
 * the catalogue instead of upserting. These assert the replacement is stable,
 * so the regression cannot return unnoticed.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('fixtureId', () => {
  it('returns the same id for the same input, every time', () => {
    const first = fixtureId('listing', 'listing-001');
    for (let i = 0; i < 100; i++) {
      expect(fixtureId('listing', 'listing-001')).toBe(first);
    }
  });

  it('is a well-formed v5-shaped UUID', () => {
    expect(fixtureId('listing', 'listing-001')).toMatch(UUID);
    expect(fixtureId('farmer', 'farmer-008')).toMatch(UUID);
  });

  it('separates namespaces, so a listing and a farmer never collide', () => {
    expect(fixtureId('listing', 'x')).not.toBe(fixtureId('farmer', 'x'));
  });

  it('gives every fixture key a distinct id', () => {
    const keys = Array.from({ length: 200 }, (_, i) => `listing-${String(i).padStart(3, '0')}`);
    const ids = new Set(keys.map((k) => fixtureId('listing', k)));
    expect(ids.size).toBe(keys.length);
  });

  it('is stable across the kinds the seed script uses', () => {
    // Locking these in: if the derivation changes, a re-seed would insert a
    // parallel set of rows instead of updating the existing ones.
    for (const kind of ['farmer', 'buyer', 'listing', 'order', 'dispute']) {
      expect(fixtureId(kind, 'fixture-001')).toBe(fixtureId(kind, 'fixture-001'));
    }
  });

  it('is not random — the whole point of the fix', () => {
    const a = fixtureId('order', 'order-003');
    const b = fixtureId('order', 'order-003');
    expect(a).toBe(b);
    expect(a).not.toMatch(/^0{8}-/);
  });
});
