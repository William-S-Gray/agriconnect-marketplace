/**
 * Applies SQL files from migrations/ in filename order.
 *
 * Deliberately minimal: it records applied filenames in a schema_migrations
 * table and skips them next run, so it is safe to re-run and safe to point at
 * production. It does not roll back — forward-only migrations are easier to
 * reason about than reversible ones for a schema this small.
 *
 * Run with:  npm run db:migrate
 * Target a different database by setting DATABASE_URL for the invocation.
 */
import { sql, query, pool } from '../lib/pool';
import { describeError, connectionHint } from '../lib/describe-error';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const dir = join(process.cwd(), 'migrations');

/** Splits a file into statements, ignoring semicolons inside line comments. */
function statements(text: string): string[] {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const applied = new Set(
    ((await sql`SELECT filename FROM schema_migrations`) as { filename: string }[])
      .map((r) => r.filename),
  );

  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  let ran = 0;

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  skip    ${file} (already applied)`);
      continue;
    }
    console.log(`  apply   ${file}`);
    for (const stmt of statements(readFileSync(join(dir, file), 'utf8'))) {
      await query(stmt);
    }
    await sql`INSERT INTO schema_migrations (filename) VALUES (${file})`;
    ran++;
  }

  console.log(ran === 0 ? 'Nothing to apply.' : `Applied ${ran} migration(s).`);
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    await pool.end().catch(() => {});
    // describeError unwraps AggregateError (whose own message is empty) and
    // redacts credentials, so a connection failure is diagnosable from CI logs
    // without leaking DATABASE_URL.
    console.error('Migration failed:', describeError(err));
    const hint = connectionHint(err);
    if (hint) console.error(hint);
    process.exit(1);
  });
