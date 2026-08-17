/**
 * Demo credential store.
 *
 * This app has no backend — authentication is simulated entirely in the browser.
 * Even so, login must actually *verify* something, otherwise the account-lockout
 * and rate-limit features are dead code and the admin role is reachable by anyone.
 *
 * Rules:
 *  - A login only succeeds for an email that exists as a demo account.
 *  - The password must match DEMO_PASSWORD (or the account's own password, for
 *    accounts created through the registration form during this session).
 *  - Admin is an exact-match allowlist. Never a substring test.
 */
import type { Farmer, Buyer } from '@/lib/mock-data';
import { SEED_FARMERS, SEED_BUYERS } from '@/lib/seed-data';

/** The shared password for every pre-seeded demo account. */
export const DEMO_PASSWORD = 'Demo@1234';

/** Emails permitted to hold the admin role — exact match only. */
const ADMIN_EMAILS = ['admin@agriconnect.co.zw'] as const;

export const DEMO_ADMIN_EMAIL = ADMIN_EMAILS[0];

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Accounts registered through the sign-up form during this browser session.
 * Kept separate from the seed data so the demo's register → login flow works.
 */
type RegisteredFarmer = { kind: 'farmer'; password: string; profile: Farmer };
type RegisteredBuyer = { kind: 'buyer'; password: string; profile: Buyer };
type RegisteredAccount = RegisteredFarmer | RegisteredBuyer;

const registered = new Map<string, RegisteredAccount>();

export function registerDemoFarmer(profile: Farmer, password: string): void {
  registered.set(normaliseEmail(profile.email), { kind: 'farmer', password, profile });
}

export function registerDemoBuyer(profile: Buyer, password: string): void {
  registered.set(normaliseEmail(profile.email), { kind: 'buyer', password, profile });
}

export function isEmailTaken(email: string): boolean {
  const key = normaliseEmail(email);
  if (registered.has(key)) return true;
  if (SEED_FARMERS.some(f => normaliseEmail(f.email) === key)) return true;
  if (SEED_BUYERS.some(b => normaliseEmail(b.email) === key)) return true;
  return ADMIN_EMAILS.includes(key as (typeof ADMIN_EMAILS)[number]);
}

/** Verifies a farmer login. Returns the profile on success, otherwise null. */
export function verifyFarmer(email: string, password: string): Farmer | null {
  const key = normaliseEmail(email);

  const custom = registered.get(key);
  if (custom?.kind === 'farmer') {
    return custom.password === password ? custom.profile : null;
  }

  const seeded = SEED_FARMERS.find(f => normaliseEmail(f.email) === key);
  if (!seeded) return null;
  return password === DEMO_PASSWORD ? seeded : null;
}

/** Verifies a buyer login. Returns the profile on success, otherwise null. */
export function verifyBuyer(email: string, password: string): Buyer | null {
  const key = normaliseEmail(email);

  const custom = registered.get(key);
  if (custom?.kind === 'buyer') {
    return custom.password === password ? custom.profile : null;
  }

  const seeded = SEED_BUYERS.find(b => normaliseEmail(b.email) === key);
  if (!seeded) return null;
  return password === DEMO_PASSWORD ? seeded : null;
}

/** Verifies an admin login against the exact-match allowlist. */
export function verifyAdmin(email: string, password: string): boolean {
  const key = normaliseEmail(email);
  if (!ADMIN_EMAILS.includes(key as (typeof ADMIN_EMAILS)[number])) return false;
  return password === DEMO_PASSWORD;
}
