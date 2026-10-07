# Deploying AgriConnect

Checklist for taking a release to production. The app is a Next.js server
plus Postgres (Neon) and, optionally, Redis.

## Environment

| Variable | Production value |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `MFA_ENCRYPTION_KEY` | 32+ random bytes (`openssl rand -base64 32`). Never rotate casually: it invalidates every enrolled authenticator. |
| `APP_URL` | The public origin, e.g. `https://agriconnect.co.zw` — **required**; the server refuses to start without it. |
| `SIMULATED_PAYMENTS` | **Unset.** Only demo/preview environments set `true`. Unset, checkout returns 503 until a payment provider is integrated. |
| `REDIS_URL` | Optional. Rate-limit counters; falls back to Postgres. |
| `ANOMALY_TRUSTED_PROXY` | `vercel` or `cloudflare` if deployed behind one, else unset. |

## Release steps

1. **Migrate first.** `DATABASE_URL=<production> npm run db:migrate`
   Each file applies in a transaction under an advisory lock, so a failure
   leaves nothing half-applied and two concurrent deploys cannot double-apply.
2. **Deploy the build** (`npm run build && npm run start`, or your platform's equivalent).
3. **Check health.** `curl -fsS https://<host>/api/health` → `{"ok":true}`. A 503 means the database is unreachable.
4. **Smoke test** in a browser: home, browse, a listing page, `/prices` (the chart should draw), sign in.

Never run `npm run db:seed` against production. It refuses when
`NODE_ENV`/`VERCEL_ENV` is `production`, but that guard cannot see a
production `DATABASE_URL` used from a laptop.

## One-time, after the security hardening release (#20)

- Every **admin** enrols two-factor authentication at `/settings/security`.
  Admin pages and APIs refuse an admin without it.
- Schedule **`npm run db:prune`** daily (Vercel Cron, a GitHub Actions
  schedule, or system cron). It deletes expired sessions, spent reset tokens
  and old audit rows.

## Monitoring

Logs are one JSON object per line. Alert on:

- `"event":"security.*"` — anomaly detector findings
- `"event":"checkout_failed"`, `"order_update_failed"`, `"review_failed"`
- `"event":"ratelimit_redis_fallback"` — Redis down (limiting continues on Postgres)
- `"event":"health_db_unreachable"`

Open security events are also listed for admins at `/admin/security`.
