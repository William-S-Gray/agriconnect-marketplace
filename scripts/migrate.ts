/**
 * Applies SQL files from migrations/ in filename order.
 *
 * Deliberately minimal: it records applied filenames in a schema_migrations
 * table and skips them next run, so it is safe to re-run and safe to point at
 * production. Forward-only — no down migrations.
 *
 * Each file runs in one transaction together with its schema_migrations row,
 * so a failure halfway leaves nothing behind (Postgres DDL is transactional).
 * The file is sent whole — the simple query protocol accepts many statements —
 * rather than split on ';', which broke on any semicolon inside a string or
 * function body. An advisory lock stops two concurrent runs (two deploys)
 * from applying the same file twice.
 *
 * Run with:  npm run db:migrate
 * Target a different database by setting DATABASE_URL for the invocation.
 */
import { sql, pool } from '../lib/pool';
import { describeError, connectionHint } from '../lib/describe-error';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const dir = join(process.cwd(), 'migrations');

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
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('agriconnect:migrate'))`);
      // Re-check under the lock: a concurrent run may have just applied it.
      const done = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
      if (done.rowCount === 0) {
        await client.query(readFileSync(join(dir, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        ran++;
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
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
