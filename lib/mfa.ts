import 'server-only';
import { generateSecret, generateSync, verifySync, generateURI } from 'otplib';
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'crypto';
import QRCode from 'qrcode';
import { sql } from './db';
import { env } from './env';

/**
 * TOTP two-factor authentication (RFC 6238), compatible with Google
 * Authenticator, Microsoft Authenticator, Authy, 1Password, etc.
 *
 * Secret handling:
 *   * generated server-side with crypto randomness
 *   * encrypted at rest with AES-256-GCM before it touches the database, so a
 *     database dump does not yield working second factors
 *   * returned to the client exactly once, during enrolment, and only to the
 *     authenticated owner
 *   * MFA is not active until the user proves possession with a valid code
 *
 * Replay: TOTP codes are inherently reusable inside their acceptance window,
 * so each accepted code is recorded in mfa_used_totp and refused a second time.
 */

const ISSUER = 'AgriConnect';
const DIGITS = 6;
const PERIOD_SECONDS = 30;
/**
 * Accept one step either side, to tolerate clock drift without widening the
 * window enough to matter for brute force. otplib v13 expresses this in
 * seconds, not steps.
 */
const EPOCH_TOLERANCE_SECONDS = PERIOD_SECONDS;
/** Longer than any window in which one code can verify (3 steps). */
const REPLAY_WINDOW_SECONDS = PERIOD_SECONDS * 4;

// ─── Secret encryption at rest ────────────────────────────────────────────────

function encryptionKey(): Buffer {
  // scrypt-derive a fixed-length key from the configured secret.
  return scryptSync(env.MFA_ENCRYPTION_KEY, 'agriconnect-mfa-v1', 32);
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`;
}

export function decryptSecret(stored: string): string | null {
  try {
    const [version, ivB64, tagB64, dataB64] = stored.split('.');
    if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) return null;
    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      Buffer.from(ivB64, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

// ─── Enrolment ────────────────────────────────────────────────────────────────

export interface EnrolmentChallenge {
  /** Base32 secret, shown once so the user can type it manually. */
  secret: string;
  /** otpauth:// URI, rendered as a QR code for the authenticator app. */
  otpauthUrl: string;
  qrDataUrl: string;
}

/**
 * Begins enrolment: generates a secret, stores it encrypted, and leaves
 * mfa_enabled FALSE until a code is verified.
 *
 * Returns null when MFA is already enabled. Re-enrolling used to overwrite the
 * live secret and switch MFA off, which let any signed-in session strip the
 * second factor without the password that DELETE demands.
 */
export async function beginEnrolment(
  userId: string,
  email: string,
): Promise<EnrolmentChallenge | null> {
  const secret = generateSecret({ length: 20 }); // 160-bit, per RFC 4226
  const otpauthUrl = generateURI({
    issuer: ISSUER,
    label: email,
    secret,
    digits: DIGITS,
    period: PERIOD_SECONDS,
  });

  const updated = await sql`
    UPDATE users
       SET mfa_secret = ${encryptSecret(secret)},
           mfa_confirmed_at = NULL,
           updated_at = now()
     WHERE id = ${userId} AND mfa_enabled = FALSE
     RETURNING id
  `;
  if (updated.length === 0) return null;

  return {
    secret,
    otpauthUrl,
    qrDataUrl: await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 }),
  };
}

/**
 * Completes a *pending* enrolment. Requires a valid code, so a user cannot lock
 * themselves out with a secret they never actually stored.
 *
 * Refuses when MFA is already enabled: otherwise this was an unthrottled way
 * to answer the login MFA challenge — and it minted fresh recovery codes for
 * whoever guessed right.
 *
 * Enabling MFA and issuing the recovery codes is one statement, so a failure
 * cannot leave MFA on with no recovery codes.
 */
export async function confirmEnrolment(
  userId: string,
  code: string,
): Promise<{ ok: boolean; recoveryCodes?: string[] }> {
  const rows = (await sql`
    SELECT mfa_secret FROM users WHERE id = ${userId} AND mfa_enabled = FALSE LIMIT 1
  `) as { mfa_secret: string | null }[];

  const encrypted = rows[0]?.mfa_secret;
  if (!encrypted) return { ok: false };

  const secret = decryptSecret(encrypted);
  if (!secret || !verifyTotp(secret, code)) return { ok: false };

  const codes = newRecoveryCodes();
  const enabled = await sql`
    WITH u AS (
      UPDATE users
         SET mfa_enabled = TRUE, mfa_confirmed_at = now(), updated_at = now()
       WHERE id = ${userId} AND mfa_enabled = FALSE AND mfa_secret = ${encrypted}
       RETURNING id
    ),
    cleared AS (
      DELETE FROM mfa_recovery_codes
       WHERE user_id IN (SELECT id FROM u) AND used_at IS NULL
    )
    INSERT INTO mfa_recovery_codes (user_id, code_hash)
    SELECT u.id, h FROM u, unnest(${codes.map(hashRecoveryCode)}::text[]) AS h
    RETURNING id
  `;
  // Zero rows: a concurrent request enabled it, or the secret was replaced.
  if (enabled.length === 0) return { ok: false };
  return { ok: true, recoveryCodes: codes };
}

/** Verifies a TOTP code against a decrypted secret. */
export function verifyTotp(secret: string, code: string): boolean {
  const normalised = code.replace(/\D/g, '');
  if (normalised.length !== DIGITS) return false;
  try {
    return verifySync({
      secret,
      token: normalised,
      digits: DIGITS,
      period: PERIOD_SECONDS,
      epochTolerance: EPOCH_TOLERANCE_SECONDS,
    }).valid;
  } catch {
    return false;
  }
}

/**
 * Verifies a code for a user, rejecting replay of an already-used code inside
 * its time step.
 */
export async function verifyUserTotp(
  userId: string,
  code: string,
): Promise<boolean> {
  const rows = (await sql`
    SELECT mfa_secret, mfa_enabled FROM users WHERE id = ${userId} LIMIT 1
  `) as { mfa_secret: string | null; mfa_enabled: boolean }[];

  const row = rows[0];
  if (!row?.mfa_enabled || !row.mfa_secret) return false;

  const secret = decryptSecret(row.mfa_secret);
  if (!secret || !verifyTotp(secret, code)) return false;

  // Single use across the whole acceptance window. The tolerance accepts a code
  // for up to ~90s (the previous, current and next step), so the marker is
  // keyed on the code itself, not on the current step — a step-keyed marker
  // let the same code through again once the clock ticked into the next step.
  //
  // One atomic statement: a fresh insert, or reclaiming a marker old enough to
  // be a genuinely new occurrence of the same six digits, returns a row; a
  // replay (or a concurrent duplicate) returns none.
  const codeHash = createHash('sha256')
    .update(`${userId}:${code.replace(/\D/g, '')}`)
    .digest('hex');
  const accepted = await sql`
    INSERT INTO mfa_used_totp (user_id, code_hash, used_at)
    VALUES (${userId}, ${codeHash}, now())
    ON CONFLICT (user_id, code_hash) DO UPDATE SET used_at = now()
      WHERE mfa_used_totp.used_at < now() - make_interval(secs => ${REPLAY_WINDOW_SECONDS})
    RETURNING 1
  `;
  if (accepted.length === 0) return false;

  // Opportunistic pruning keeps the table bounded per user.
  await sql`
    DELETE FROM mfa_used_totp
     WHERE user_id = ${userId}
       AND used_at < now() - make_interval(secs => ${REPLAY_WINDOW_SECONDS})
  `;
  return true;
}

// ─── Recovery codes ───────────────────────────────────────────────────────────

function hashRecoveryCode(code: string): string {
  return createHash('sha256')
    .update(`${code.toUpperCase().replace(/[^A-Z0-9]/g, '')}:${env.MFA_ENCRYPTION_KEY}`)
    .digest('hex');
}

function newRecoveryCodes(): string[] {
  return Array.from({ length: 10 }, () => {
    const raw = randomBytes(5).toString('hex').toUpperCase(); // 10 hex chars
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

/**
 * Issues ten fresh single-use recovery codes, replacing any unused ones.
 * Returned in plaintext exactly once; only hashes are stored. One statement,
 * so the old codes are never deleted without the new ones landing.
 */
export async function regenerateRecoveryCodes(userId: string): Promise<string[]> {
  const codes = newRecoveryCodes();
  await sql`
    WITH cleared AS (
      DELETE FROM mfa_recovery_codes WHERE user_id = ${userId} AND used_at IS NULL
    )
    INSERT INTO mfa_recovery_codes (user_id, code_hash)
    SELECT ${userId}::uuid, unnest(${codes.map(hashRecoveryCode)}::text[])
  `;
  return codes;
}

/** Consumes a recovery code. Each works at most once. */
export async function consumeRecoveryCode(
  userId: string,
  code: string,
): Promise<boolean> {
  const rows = (await sql`
    UPDATE mfa_recovery_codes
       SET used_at = now()
     WHERE user_id = ${userId}
       AND code_hash = ${hashRecoveryCode(code)}
       AND used_at IS NULL
     RETURNING id
  `) as { id: string }[];
  return rows.length > 0;
}

/**
 * Disables MFA. Requires the caller to have already re-authenticated (the route
 * enforces a fresh password check) — otherwise a hijacked session could strip
 * the second factor.
 */
export async function disableMfa(userId: string): Promise<void> {
  await sql`
    UPDATE users
       SET mfa_enabled = FALSE, mfa_secret = NULL, mfa_confirmed_at = NULL,
           updated_at = now()
     WHERE id = ${userId}
  `;
  await sql`DELETE FROM mfa_recovery_codes WHERE user_id = ${userId}`;
  await sql`DELETE FROM mfa_used_totp WHERE user_id = ${userId}`;
}
