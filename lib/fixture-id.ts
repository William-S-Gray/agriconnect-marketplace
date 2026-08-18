import { createHash } from 'node:crypto';

/**
 * Derives a stable UUID from a fixture identifier.
 *
 * The seed script originally assigned listings a randomUUID(), which meant a
 * second run inserted a whole new catalogue rather than conflicting with the
 * first — despite the file documenting itself as idempotent. Deriving the id
 * from the fixture key makes re-seeding an upsert, so the claim holds.
 *
 * The output is UUIDv5-shaped (SHA-1 with the version and variant bits set) but
 * the namespace is a plain string: it only has to be stable across runs, not
 * interoperable with other UUIDv5 producers.
 */
export function fixtureId(kind: string, key: string): string {
  const digest = createHash('sha1').update(`agriconnect:${kind}:${key}`).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16),
    hex.slice(16, 20), hex.slice(20),
  ].join('-');
}
