import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { generateSecret, generateSync } from 'otplib';
import { sql, pool } from '@/lib/pool';
import { hashPassword } from '@/lib/password';
import {
  encryptSecret,
  decryptSecret,
  verifyTotp,
  beginEnrolment,
  confirmEnrolment,
  verifyUserTotp,
  regenerateRecoveryCodes,
  consumeRecoveryCode,
  disableMfa,
} from '@/lib/mfa';

const suffix = randomUUID().slice(0, 8);
const email = `mfa-${suffix}@example.test`;
let userId: string;

beforeAll(async () => {
  const hash = await hashPassword('mfa test passphrase here');
  const [row] = await sql<{ id: string }>`
    INSERT INTO users (email, password_hash, role)
    VALUES (${email}, ${hash}, 'buyer') RETURNING id
  `;
  userId = row!.id;
});

afterAll(async () => {
  await sql`DELETE FROM users WHERE email = ${email}`;
  await pool.end();
});

/**
 * Waits for the start of the next TOTP step when the current one is nearly
 * over, so a test that generates a code and then verifies it twice cannot have
 * the step roll underneath it.
 */
async function awaitFreshTimeStep(minimumRemainingSeconds = 20): Promise<void> {
  const period = 30_000;
  const remaining = period - (Date.now() % period);
  if (remaining >= minimumRemainingSeconds * 1000) return;
  await new Promise((resolve) => setTimeout(resolve, remaining + 250));
}

/** Starts enrolment from a clean slate; beginEnrolment refuses an enabled account. */
async function freshEnrolment() {
  await disableMfa(userId);
  const challenge = await beginEnrolment(userId, email);
  if (!challenge) throw new Error('enrolment unexpectedly refused');
  return challenge;
}

const codeFor = (secret: string) => generateSync({ secret, digits: 6, period: 30 });

describe('secret encryption at rest', () => {
  it('round-trips a secret', () => {
    const secret = generateSecret({ length: 20 });
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it('ciphertext does not contain the plaintext', () => {
    const secret = generateSecret({ length: 20 });
    expect(encryptSecret(secret)).not.toContain(secret);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const secret = generateSecret({ length: 20 });
    expect(encryptSecret(secret)).not.toBe(encryptSecret(secret));
  });

  it('returns null on tampered ciphertext rather than leaking a partial secret', () => {
    const encrypted = encryptSecret(generateSecret({ length: 20 }));
    const tampered = `${encrypted.slice(0, -4)}AAAA`;
    expect(decryptSecret(tampered)).toBeNull();
    expect(decryptSecret('garbage')).toBeNull();
  });
});

describe('TOTP verification', () => {
  it('accepts a valid current code', () => {
    const secret = generateSecret({ length: 20 });
    expect(verifyTotp(secret, generateSync({ secret, digits: 6, period: 30 }))).toBe(true);
  });

  it('rejects an incorrect code', () => {
    const secret = generateSecret({ length: 20 });
    const otherSecret = generateSecret({ length: 20 });
    const wrong = generateSync({ secret: otherSecret, digits: 6, period: 30 });
    expect(verifyTotp(secret, wrong)).toBe(false);
  });

  it('rejects malformed input', () => {
    const secret = generateSecret({ length: 20 });
    expect(verifyTotp(secret, '')).toBe(false);
    expect(verifyTotp(secret, '12345')).toBe(false);
    expect(verifyTotp(secret, 'abcdef')).toBe(false);
  });

  it('rejects a code from a distant time step (expired)', () => {
    const secret = generateSecret({ length: 20 });
    // A code generated ~5 minutes ago is far outside the ±1 step window.
    const past = generateSync({ secret, digits: 6, period: 30 });
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 5 * 60 * 1000;
      expect(verifyTotp(secret, past)).toBe(false);
    } finally {
      Date.now = realNow;
    }
  });
});

describe('enrolment', () => {
  it('does not enable MFA until a code is confirmed', async () => {
    await freshEnrolment();
    const [before] = await sql<{ mfa_enabled: boolean; mfa_secret: string | null }>`
      SELECT mfa_enabled, mfa_secret FROM users WHERE id = ${userId}
    `;
    expect(before!.mfa_enabled).toBe(false);
    expect(before!.mfa_secret).not.toBeNull();
  });

  it('stores the secret encrypted, not in plaintext', async () => {
    const challenge = await freshEnrolment();
    const [row] = await sql<{ mfa_secret: string }>`
      SELECT mfa_secret FROM users WHERE id = ${userId}
    `;
    expect(row!.mfa_secret).not.toBe(challenge.secret);
    expect(row!.mfa_secret).not.toContain(challenge.secret);
    expect(row!.mfa_secret.startsWith('v1.')).toBe(true);
  });

  it('rejects confirmation with a wrong code', async () => {
    await freshEnrolment();
    expect((await confirmEnrolment(userId, '000000')).ok).toBe(false);
    const [row] = await sql<{ mfa_enabled: boolean }>`
      SELECT mfa_enabled FROM users WHERE id = ${userId}
    `;
    expect(row!.mfa_enabled).toBe(false);
  });

  it('enables MFA and issues recovery codes on a valid code', async () => {
    const challenge = await freshEnrolment();
    const result = await confirmEnrolment(
      userId,
      generateSync({ secret: challenge.secret, digits: 6, period: 30 }),
    );
    expect(result.ok).toBe(true);
    expect(result.recoveryCodes).toHaveLength(10);

    const [row] = await sql<{ mfa_enabled: boolean }>`
      SELECT mfa_enabled FROM users WHERE id = ${userId}
    `;
    expect(row!.mfa_enabled).toBe(true);
  });

  it('provides a scannable otpauth URI and QR image', async () => {
    const challenge = await freshEnrolment();
    expect(challenge.otpauthUrl).toContain('otpauth://totp/');
    expect(challenge.otpauthUrl).toContain('AgriConnect');
    expect(challenge.qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });
});

describe('code reuse', () => {
  it('accepts a code once and refuses the same code again', async () => {
    const challenge = await freshEnrolment();
    await confirmEnrolment(userId, generateSync({ secret: challenge.secret, digits: 6, period: 30 }));

    // Both verifications must land in the step the code was generated for, and
    // each one costs an Argon2 hash and a round trip — enough to cross a 30s
    // boundary if the step is nearly over. Start on a fresh step instead of
    // racing the clock.
    await awaitFreshTimeStep();

    const code = generateSync({ secret: challenge.secret, digits: 6, period: 30 });
    expect(await verifyUserTotp(userId, code)).toBe(true);
    // Replay inside the same time step must fail.
    expect(await verifyUserTotp(userId, code)).toBe(false);
  }, 60_000);

  it('refuses any code when MFA is not enabled', async () => {
    const challenge = await freshEnrolment(); // leaves mfa_enabled false
    expect(await verifyUserTotp(userId, generateSync({ secret: challenge.secret, digits: 6, period: 30 }))).toBe(false);
  });
});

describe('an enabled factor cannot be replaced or re-confirmed (F-001, F-002)', () => {
  it('beginEnrolment refuses an account with MFA on, and leaves the secret alone', async () => {
    const challenge = await freshEnrolment();
    await confirmEnrolment(userId, codeFor(challenge.secret));
    const [before] = await sql<{ mfa_secret: string }>`SELECT mfa_secret FROM users WHERE id = ${userId}`;

    expect(await beginEnrolment(userId, email)).toBeNull();

    const [after] = await sql<{ mfa_secret: string; mfa_enabled: boolean }>`
      SELECT mfa_secret, mfa_enabled FROM users WHERE id = ${userId}`;
    expect(after!.mfa_secret).toBe(before!.mfa_secret);
    expect(after!.mfa_enabled).toBe(true);
  });

  it('confirmEnrolment refuses once MFA is on, so it cannot answer a login challenge', async () => {
    const challenge = await freshEnrolment();
    const first = await confirmEnrolment(userId, codeFor(challenge.secret));
    expect(first.ok).toBe(true);

    // A valid code for the live secret: the old code accepted this and minted
    // fresh recovery codes, with no rate limit.
    const again = await confirmEnrolment(userId, codeFor(challenge.secret));
    expect(again).toEqual({ ok: false });
  });
});

describe('replay across the tolerance window (F-009)', () => {
  it('refuses a code reused after the clock ticks into the next step', async () => {
    const challenge = await freshEnrolment();
    await confirmEnrolment(userId, codeFor(challenge.secret));

    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const stepStart = Math.floor(Date.now() / 30_000) * 30_000;
      vi.setSystemTime(stepStart + 5_000);
      const code = codeFor(challenge.secret);
      expect(await verifyUserTotp(userId, code)).toBe(true);

      // Next step: the code still verifies under the one-step tolerance, so
      // only the replay marker stands between it and a second login.
      vi.setSystemTime(stepStart + 35_000);
      expect(verifyTotp(challenge.secret, code)).toBe(true);
      expect(await verifyUserTotp(userId, code)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets exactly one of two concurrent uses of a code through', async () => {
    const challenge = await freshEnrolment();
    await confirmEnrolment(userId, codeFor(challenge.secret));
    const code = codeFor(challenge.secret);
    const results = await Promise.all([verifyUserTotp(userId, code), verifyUserTotp(userId, code)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});

describe('recovery codes', () => {
  it('each code works exactly once', async () => {
    const codes = await regenerateRecoveryCodes(userId);
    const code = codes[0]!;
    expect(await consumeRecoveryCode(userId, code)).toBe(true);
    expect(await consumeRecoveryCode(userId, code)).toBe(false);
  });

  it('rejects an unknown code', async () => {
    await regenerateRecoveryCodes(userId);
    expect(await consumeRecoveryCode(userId, 'AAAAA-BBBBB')).toBe(false);
  });

  it('stores only hashes, never the plaintext codes', async () => {
    const codes = await regenerateRecoveryCodes(userId);
    const stored = await sql<{ code_hash: string }>`
      SELECT code_hash FROM mfa_recovery_codes WHERE user_id = ${userId}
    `;
    const hashes = stored.map((r) => r.code_hash);
    for (const code of codes) {
      expect(hashes).not.toContain(code);
    }
  });

  it('regenerating invalidates the previous unused codes', async () => {
    const first = await regenerateRecoveryCodes(userId);
    await regenerateRecoveryCodes(userId);
    expect(await consumeRecoveryCode(userId, first[0]!)).toBe(false);
  });
});

describe('disabling MFA', () => {
  it('clears the secret and all recovery codes', async () => {
    const challenge = await freshEnrolment();
    await confirmEnrolment(userId, generateSync({ secret: challenge.secret, digits: 6, period: 30 }));

    await disableMfa(userId);

    const [row] = await sql<{ mfa_enabled: boolean; mfa_secret: string | null }>`
      SELECT mfa_enabled, mfa_secret FROM users WHERE id = ${userId}
    `;
    expect(row!.mfa_enabled).toBe(false);
    expect(row!.mfa_secret).toBeNull();

    const codes = await sql`SELECT id FROM mfa_recovery_codes WHERE user_id = ${userId}`;
    expect(codes).toHaveLength(0);
  });
});
