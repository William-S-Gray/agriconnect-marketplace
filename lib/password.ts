import 'server-only';
import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id password hashing and server-side strength validation.
 *
 * Argon2id is the OWASP-recommended default. Parameters follow the OWASP
 * Password Storage Cheat Sheet minimum for Argon2id (19 MiB, t=2, p=1); raise
 * memoryCost if the deployment has headroom.
 *
 * Strength policy favours length and a blocklist over character-class rules,
 * per NIST SP 800-63B: long passphrases beat short complex ones, and complexity
 * rules mostly push users toward predictable substitutions.
 */

const ARGON2_OPTIONS = {
  // Algorithm.Argon2id. Written as a literal because @node-rs/argon2 declares
  // it as an ambient const enum, which isolatedModules cannot read.
  algorithm: 2 as const,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128; // bound the work an attacker can force

/**
 * Passwords rejected outright. A production system should additionally check
 * Have I Been Pwned's k-anonymity range API; this local list covers the
 * credential-stuffing staples without adding a network dependency to login.
 */
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'passw0rd', 'p@ssword', 'p@ssw0rd',
  '123456', '1234567', '12345678', '123456789', '1234567890', '12345',
  'qwerty', 'qwerty123', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
  'letmein', 'welcome', 'welcome1', 'admin', 'administrator', 'root', 'toor',
  'iloveyou', 'monkey', 'dragon', 'sunshine', 'princess', 'football',
  'baseball', 'superman', 'batman', 'trustno1', 'starwars', 'whatever',
  'abc123', 'abcd1234', 'aa123456', 'a1b2c3d4', '1q2w3e4r', '1qaz2wsx',
  'changeme', 'secret', 'default', 'test', 'test123', 'guest',
  'zimbabwe', 'harare', 'agriconnect', 'ecocash', 'farmer', 'farming',
  'demo', 'demo123', 'demopassword',
]);

export interface PasswordCheck {
  ok: boolean;
  /** Reasons the password was rejected; safe to show the user. */
  errors: string[];
}

/**
 * Server-side strength validation. The client may mirror this for instant
 * feedback, but this function is the authority — every write path calls it.
 */
export function validatePassword(
  password: string,
  context: { email?: string; name?: string } = {},
): PasswordCheck {
  const errors: string[] = [];

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Must be at most ${MAX_PASSWORD_LENGTH} characters.`);
  }

  const normalised = password.toLowerCase().trim();

  // Exact match, plus the far more common shape: a blocklisted word with
  // decoration bolted on ("Password123!", "Welcome2026!"). Stripping the
  // non-letters exposes the real base word, so trivial mutations of a weak
  // password are rejected rather than sailing through a character-class check.
  const letterCore = normalised.replace(/[^a-z]/g, '');
  if (COMMON_PASSWORDS.has(normalised) || COMMON_PASSWORDS.has(letterCore)) {
    errors.push('This password is too common. Choose something less predictable.');
  }

  // A long password made of one repeated character is long but not strong.
  if (password.length > 0 && new Set(password).size < 5) {
    errors.push('Too repetitive. Use a more varied passphrase.');
  }

  // Straight runs like "abcdefghijkl" or "123456789012".
  if (hasLongSequentialRun(normalised)) {
    errors.push('Avoid long sequences of consecutive characters.');
  }

  // Password must not embed the account identifier.
  const localPart = context.email?.split('@')[0]?.toLowerCase();
  if (localPart && localPart.length >= 3 && normalised.includes(localPart)) {
    errors.push('Must not contain your email address.');
  }
  if (context.name) {
    for (const part of context.name.toLowerCase().split(/\s+/)) {
      if (part.length >= 4 && normalised.includes(part)) {
        errors.push('Must not contain your name.');
        break;
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function hasLongSequentialRun(value: string, runLength = 6): boolean {
  let ascending = 1;
  let descending = 1;
  for (let i = 1; i < value.length; i++) {
    const delta = value.charCodeAt(i) - value.charCodeAt(i - 1);
    ascending = delta === 1 ? ascending + 1 : 1;
    descending = delta === -1 ? descending + 1 : 1;
    if (ascending >= runLength || descending >= runLength) return true;
  }
  return false;
}

/** Hashes a password with Argon2id. Returns a self-describing PHC string. */
export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/**
 * Verifies a password against a stored hash. Returns false rather than throwing
 * on a malformed hash, so a corrupt row cannot leak details via a 500.
 */
export async function verifyPassword(
  storedHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}

/**
 * Constant-ish-time dummy verification, used when no user matches so that a
 * missing account and a wrong password take comparable time. Without this,
 * response timing reveals which emails are registered.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZXg$8fZ0lTBbGmxKZ7VfKZ0ZlqQe0mQe1kZ8YQ0Zk1Zk1Zk';

export async function fakeVerify(password: string): Promise<void> {
  try {
    await verify(DUMMY_HASH, password);
  } catch {
    /* expected — the point is spending comparable CPU, not the result */
  }
}
