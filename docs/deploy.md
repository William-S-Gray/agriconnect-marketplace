# Deploying AgriConnect

Checklist for taking a release to production. The app is a Next.js server
plus Postgres (Neon) and, optionally, Redis. It ships on **Vercel** (Node 22,
Fluid Compute); `vercel.json` holds the cron schedule and pins functions to
`fra1` (Frankfurt), next to the database and the closest region to Zimbabwe.

**Current setup:** Vercel project `agriconnect-marketplace`, connected to this
GitHub repo. Neon project `agriconnect-production` (`lingering-block-14622199`,
aws-eu-central-1): branch `main` is production, branch `preview` serves preview
deployments with seeded demo data.

## First-time Vercel setup

1. `vercel link` in the repo, then connect the GitHub repo in the dashboard so
   pushes to `main` deploy to production and pull requests get previews.
2. **Database per environment.** Install the Neon integration from the Vercel
   Marketplace with preview branching, or set `DATABASE_URL` per environment by
   hand. Never give Preview the production `DATABASE_URL`: previews run real
   code against whatever database they are given.
3. Set the variables below with `vercel env add <NAME> production` (and
   `preview` where noted). Generate secrets with `openssl rand -base64 32`.
4. Run the migrations against the preview database once
   (`DATABASE_URL=<preview> npm run db:migrate`). Production builds migrate
   on their own (see Release steps).
5. Add the custom domain, then set `APP_URL` to it and redeploy.

## Environment

| Variable | Production value |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `MFA_ENCRYPTION_KEY` | 32+ random bytes (`openssl rand -base64 32`). Never rotate casually: it invalidates every enrolled authenticator. |
| `APP_URL` | The public origin, e.g. `https://agriconnect.co.zw` — **required**; the server refuses to start without it. |
| `SIMULATED_PAYMENTS` | **Unset.** Only demo/preview environments set `true`. Unset, checkout returns 503 until a payment provider is integrated. |
| `REDIS_URL` | Optional. Rate-limit counters; falls back to Postgres. |
| `ANOMALY_TRUSTED_PROXY` | `vercel`. |
| `CRON_SECRET` | 16+ random characters. Vercel Cron sends it to `/api/cron/prune`; unset, the route refuses every call and nothing is pruned. |
| `SMTP_URL`, `MAIL_FROM` | Your mail provider. Unset, password reset cannot work. |

Preview needs `DATABASE_URL` (its own), `MFA_ENCRYPTION_KEY` and, for the demo
checkout, `SIMULATED_PAYMENTS=true`. `APP_URL` can stay unset on Preview: it
falls back to the deployment's branch URL.

## Release steps

1. **Merge to `main`.** Vercel runs `npm run vercel-build`, which applies
   pending migrations before `next build` on production deployments only.
   Each file applies in a transaction under an advisory lock, so a failure
   leaves nothing half-applied, fails the build, and the previous deployment
   keeps serving. Keep migrations backwards compatible: the old deployment
   serves against the new schema until the new one is live.
2. **Watch the deployment** (`vercel inspect <url> --logs`). To roll back,
   `vercel rollback` — a rollback does not undo migrations.
3. **Check health.** `curl -fsS https://<host>/api/health` → `{"ok":true}`. A 503 means the database is unreachable.
4. **Smoke test** in a browser: home, browse, a listing page, `/prices` (the chart should draw), sign in.

Never run `npm run db:seed` against production. It refuses when
`NODE_ENV`/`VERCEL_ENV` is `production`, but that guard cannot see a
production `DATABASE_URL` used from a laptop.

## One-time, after the security hardening release (#20)

- Every **admin** enrols two-factor authentication at `/settings/security`.
  Admin pages and APIs refuse an admin without it.
- The daily prune (expired sessions, spent reset tokens, old audit rows) runs
  from Vercel Cron at 03:00 UTC once `CRON_SECRET` is set. `npm run db:prune`
  does the same by hand.

## Admin accounts

Admins are never created through sign-up. Create one from a shell, with the
production `DATABASE_URL` set for that command only:

```
DATABASE_URL="$(npx neon@latest connection-string main --project-id lingering-block-14622199 --pooled)" \
  DB_PINNED_HOST_IP= npm run admin:create -- you@example.com
```

The password is typed at a hidden prompt and must pass the sign-up policy.
On first sign-in the admin is sent to `/settings/security` to enrol 2FA.

## Backups

Neon's scheduled snapshots aren't available on the current plan, so
`.github/workflows/backup.yml` dumps production nightly (02:00 UTC), encrypts
the dump, and keeps it 30 days as an Actions artifact. It needs two repository
secrets:

```
npx neon@latest connection-string main --project-id lingering-block-14622199 --pooled | gh secret set PROD_DATABASE_URL
gh secret set BACKUP_PASSPHRASE   # paste a long passphrase; keep it in your password manager
```

Without the passphrase the backups cannot be decrypted. To restore, download
the artifact, then:

```
openssl enc -d -aes-256-cbc -pbkdf2 -in backup.dump.enc -out backup.dump
pg_restore --clean --no-owner -d "$DATABASE_URL" backup.dump
```

Restore into a new Neon branch first and check it before pointing production
at it.

## Monitoring

`.github/workflows/uptime.yml` checks `/api/health` every 3 hours; GitHub
emails you when a scheduled run fails. For checks every few minutes, point a
free uptime service (UptimeRobot, Better Stack) at the same URL.

Logs are one JSON object per line. Alert on:

- `"event":"security.*"` — anomaly detector findings
- `"event":"checkout_failed"`, `"order_update_failed"`, `"review_failed"`
- `"event":"ratelimit_redis_fallback"` — Redis down (limiting continues on Postgres)
- `"event":"health_db_unreachable"`
- `"event":"prune_failed"`

Open security events are also listed for admins at `/admin/security`.
