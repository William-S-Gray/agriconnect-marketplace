/**
 * Creates an admin account:  npm run admin:create -- you@example.com
 *
 * The password is typed at a hidden prompt, so it never lands in shell history
 * or in this repository, and must pass the same policy as sign-up. The admin
 * is asked to enrol two-factor authentication on first sign-in; admin pages
 * refuse them until they do.
 *
 * Point it at production by setting DATABASE_URL in the shell; that wins over
 * .env.local.
 */
import { createInterface } from 'node:readline';
import { sql, pool } from '../lib/pool';
import { validatePassword, hashPassword } from '../lib/password';
import { describeError } from '../lib/describe-error';

/**
 * Hidden prompts. One readline for the whole run: a second interface would
 * miss input the first had already buffered.
 */
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: Boolean(process.stdin.isTTY),
});
let muted = false;
(rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => {
  if (!muted) process.stdout.write(s);
};
// Buffers lines from the start, so input that arrives (or ends) while the
// database is still being queried is not lost.
const lines = rl[Symbol.asyncIterator]();
async function askHidden(question: string): Promise<string> {
  muted = false;
  rl.setPrompt(question);
  rl.prompt();
  muted = true; // the prompt is written; hide what is typed
  const { value } = await lines.next();
  process.stdout.write('\n');
  return value ?? '';
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Usage: npm run admin:create -- you@example.com');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set.');

  const existing = await sql`SELECT 1 FROM users WHERE email = ${email}`;
  if (existing.length) throw new Error(`An account for ${email} already exists.`);

  const password = await askHidden('Password (12+ characters): ');
  const check = validatePassword(password, { email });
  if (!check.ok) throw new Error(check.errors.join(' '));
  if ((await askHidden('Repeat password: ')) !== password) {
    throw new Error('Passwords do not match.');
  }

  // ON CONFLICT covers a sign-up racing this script between the check and here.
  const rows = await sql`
    INSERT INTO users (email, password_hash, role, email_verified_at)
    VALUES (${email}, ${await hashPassword(password)}, 'admin', now())
    ON CONFLICT (email) DO NOTHING
    RETURNING id`;
  if (!rows.length) throw new Error(`An account for ${email} already exists.`);
  console.log(`Admin ${email} created. Sign in, then enrol two-factor authentication.`);
}

main()
  .then(() => { rl.close(); return pool.end(); })
  .catch(async (err) => {
    rl.close();
    await pool.end().catch(() => {});
    console.error('Failed:', err instanceof Error && !('code' in err) ? err.message : describeError(err));
    process.exit(1);
  });
