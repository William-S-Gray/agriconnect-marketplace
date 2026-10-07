# AgriConnect — notes for working in this repo

Next.js 15 (App Router, React 18) + Postgres (raw SQL via `lib/pool.ts`) +
optional Redis. Tailwind 4 with the theme in `app/globals.css`; shadcn/ui in
`components/ui`.

## Commands

- `npm run ci` — the full gate CI runs (migrate, seed, typecheck, lint, tests,
  build, audit, secret scan) against throwaway Docker containers. Run it before
  pushing; it never touches the Neon dev database.
- `npm test` uses `TEST_DATABASE_URL`, else `DATABASE_URL` — the tests write
  and delete rows, so do not point them at a database people use.

## Invariants (tests enforce most of these)

- Cron routes (`app/api/cron/*`, scheduled in `vercel.json`) check
  `cronAuthorized` first.
- Every mutating route handler calls `await verifyOrigin()` and, unless it is a
  public auth route, `requireUser`/`requireRole`/`requireAdmin`
  (`tests/route-guards.test.ts`).
- Identity and role come only from `getSession()`; never from the request body.
- Admins need an enrolled second factor; `requireUser` enforces it. Only the
  MFA enrolment endpoints pass `allowUnenrolledAdmin`.
- Login and MFA verification use `chargeAttempt`/`settleAttempt` (charge first),
  not `checkRateLimit`/`recordAttempt` — the latter races under concurrency.
- Multi-row writes that must commit together are a single SQL statement (CTE)
  or an explicit transaction.
- `React.lazy` and recharts only in client components
  (`tests/client-boundaries.test.ts`); server pages pass only serializable
  props to client components — no functions.
- No raw enums or ISO dates in the UI: `OrderStatusBadge`, `paymentLabel`,
  `deliveryLabel`, `formatDate` (Africa/Harare).
- Default-palette colours used in classes are pinned in `@theme`; add a line
  there when introducing a new one.

## Gotchas

- npm 10 (bundled with Node 22) crashes resolving some peer sets
  (`Cannot read properties of null (reading 'edgesOut')`). Use
  `npx npm@11 install` when changing dependencies; `npm ci` on npm 10 is fine.
- Migrations run inside a transaction: `CREATE INDEX CONCURRENTLY` and similar
  cannot be used in a migration file.
- Never seed production. See `docs/deploy.md` for release steps.
