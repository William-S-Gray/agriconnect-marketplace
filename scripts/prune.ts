/** Manual run of the daily prune (see lib/prune.ts):  npm run db:prune */
import { pool } from '../lib/pool';
import { prune } from '../lib/prune';
import { describeError } from '../lib/describe-error';

prune()
  .then(async (deleted) => {
    for (const [table, n] of Object.entries(deleted)) console.log(`  ${table}: ${n} deleted`);
    await pool.end();
  })
  .catch(async (err) => {
    await pool.end().catch(() => {});
    console.error('Prune failed:', describeError(err));
    process.exit(1);
  });
