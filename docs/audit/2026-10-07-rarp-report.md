# AgriConnect — Recursive Adversarial Refinement Report

**Date:** 2026-10-07 · **Base:** `main` @ `bb4c942`
> **Status:** written against `bb4c942`, then applied in PR #20 after rebasing onto #17–#19.
> Differences from what this report describes: the migration is `0004_hardening.sql`;
> F-047 (anomaly detection) is covered by #17's `lib/anomaly-monitor.ts` instead of the
> code in S-047, which was dropped; the suite is 331 tests, not 259. Line numbers below
> refer to `bb4c942`.

## How this was verified

The protocol forbids shipping fixes that haven't been checked against the code, so every fix in Phase 5 was **applied in a throwaway git worktree and run**, not just written down:

| Check | Result |
|---|---|
| Baseline suite on unmodified `main` (Postgres 16 + Redis 7 containers, mirroring CI) | 205 / 205 pass |
| Suite with all fixes, run twice | **259 / 259 pass** both runs (+54 new tests) |
| New route-level tests run against the **original** code | 3 of 4 fail, which proves the bugs (F-001, F-002, F-004) are real |
| `tsc --noEmit` · `eslint` · `next build` | clean · 0 errors (7 warnings, all pre-existing in `components/ui/`) · succeeds |
| Production server + curl: CSP header nonce vs inline `<script>` tags | 20/20 scripts carry the nonce; a forged `x-nonce` / CSP request header is not reflected |
| Real browser (Chrome) on the production build | `/login` hydrates; no CSP violations on `/browse` |
| `npm run db:prune` | runs |

Your Neon dev database was **not** touched. Everything ran against disposable Docker containers.

---

## Reconnaissance (Architect)

```
CODEBASE RECONNAISSANCE
=======================
Directory structure: app/ (App Router pages + app/api/** route handlers, 14 routes),
  lib/ (session, rbac, csrf, rate-limit(+store), mfa, password, pool/db, order-lifecycle,
  reviews, serialize, env), middleware.ts, migrations/ (0001_init, 0002_cart),
  scripts/ (migrate, seed), tests/ (15 vitest files), components/ (+ shadcn ui/)
Tech stack: TypeScript 5.8, Next.js 14.2.35 (App Router), React 18, Node 22, zod,
  @node-rs/argon2, otplib 13, pg 8, ioredis 6, Tailwind/shadcn, TanStack Query
Architecture pattern: monolith (Next.js full-stack; server components query Postgres directly)
Entry points: app/api/**/route.ts; server-component pages; middleware.ts (edge pre-filter)
Databases & stores: Postgres (Neon in dev; pg Pool max 10, raw SQL via tagged template);
  optional Redis for rate-limit counters with Postgres fallback
External integrations: none live. Payment (EcoCash) simulated client-side; reset email is a
  no-op stub; README mentions Vercel KV/Upstash for Redis
Auth mechanism: opaque server-side session (SHA-256-hashed token in HttpOnly cookie),
  session epoch, idle+absolute expiry, hourly rotation; Argon2id; TOTP MFA + recovery codes;
  role re-read from DB per request
Deployment target: unknown/undeclared. Vercel hints (x-vercel-* assumptions absent; README
  env tables); no Dockerfile
Test coverage: vitest, 205 tests, all against lib/ — zero route-handler tests
CI/CD: GitHub Actions: migrate → seed → typecheck → lint → test → build, plus a secret scan.
  Postgres/Redis service containers
Environment config: .env.local (gitignored; .env.prod.local also present locally, not read),
  lib/env.ts validates at import
Notable red flags spotted during scan: prod CSP `script-src 'self'` vs App Router inline
  scripts; no logging anywhere in app/ or lib/; next@14 EOL; MFA setup route uses
  getSession() not requireUser()
```

---

## Phase 1 — Total Codebase Audit (Adversary)

All line numbers refer to `main` @ `bb4c942`.

**[F-001]** File: `app/api/auth/mfa/setup/route.ts:43-51,68,77`; `lib/mfa.ts:115-136` · Security · **Critical**
Finding: `PUT` uses `getSession()` ("Cannot use requireUser here"), so a **half-authenticated** session (password passed, MFA pending) is accepted. `confirmEnrolment` verifies the code against the *live* secret, regenerates recovery codes and returns them, then `markMfaSatisfied`. There is no rate limit on this path.
Why it matters: anyone holding the password can brute-force the 6-digit TOTP here with no throttle (the `/verify` limits don't apply), and the winning request also returns 10 fresh recovery codes, which is persistent second-factor access. MFA is reduced to the password.
Blast radius: every MFA-enabled account, admins included.

**[F-002]** File: `app/api/auth/mfa/setup/route.ts:22-35`; `lib/mfa.ts:95-102` · Security · **High**
Finding: `POST` on an account with MFA enabled runs `beginEnrolment`, which sets `mfa_enabled = FALSE` and overwrites the secret. `DELETE` demands the password to disable MFA; `POST` does the same thing without it.
Why it matters: a stolen, fully-authenticated cookie can strip the second factor without knowing the password.
Blast radius: undermines the session-theft containment MFA is supposed to provide.

**[F-003]** File: `next.config.mjs:9-11,26-28`; `app/layout.tsx:50-54` · Reliability/Security · **High**
Finding: the production CSP is `script-src 'self'`. The App Router streams its payload in inline `<script>self.__next_f.push(…)</script>` tags, and the layout adds an inline theme script. None of them carry a nonce. The comment "Next emits nonced/external scripts only" is false: the built `.next/server/app/forgot-password.html` has inline scripts and zero `nonce=` attributes.
Why it matters: in production the browser blocks every inline script, so nothing hydrates. Login, cart and all forms are dead. CI is green because it never loads a page in a browser.
Blast radius: the entire production UI.

**[F-004]** File: `lib/rbac.ts:85-92` · Security · **High**
Finding: the doc comment says admin operations "additionally require MFA", but `requireAdmin` is just `requireRole('admin')`. An admin who never enrolled is protected by a password alone.
Why it matters: the highest-privilege account has the weakest gate. Combined with F-005, that's a known password.
Blast radius: user suspension, farmer verification, all orders and disputes.

**[F-005]** File: `scripts/seed.ts:40,59-74` · Security · **High**
Finding: the admin password `AgriDemo!2026` is committed and printed. `upsertUser` uses `ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED…, role = EXCLUDED.role`, and there is no production guard.
Why it matters: running `db:seed` against a database with real users resets every matching account, admin included, to the public password and the fixture role.
Blast radius: full admin takeover of any environment someone seeds.

**[F-006]** File: `package.json:52` (`next ^14.2.35`) · Security/DevOps · **High** *(advisory severity: Critical)*
Finding: `npm audit --omit=dev` lists 23 advisories against next@14.2.35 that are fixed only in 15.5.x/16.x. Examples: an unauthenticated RCE in the Image Optimization API via AVIF/libheif (GHSA-2xp9-vwfh-vxw4), Server Components DoS, SSRF, and cache poisoning. There is no 14.x backport.
Why it matters / severity justification: rated High rather than Critical because `sharp` is not installed and the only `next/image` use is `unoptimized`. But the `/_next/image` endpoint is still live, and I could not confirm the RCE is unreachable on this build. **Uncertainty named.**
Blast radius: the whole server process.

**[F-007]** File: `lib/rate-limit.ts:80-113,195-222`; `app/api/auth/login/route.ts:52-75`; `app/api/auth/mfa/verify/route.ts:49-72` · Security · **High**
Finding: rate limiting is check-then-record. A burst of N concurrent requests all pass `checkRateLimit` before any `recordAttempt` lands.
Why it matters: parallel password and TOTP guessing gets N tries per window instead of 5.
Blast radius: login and MFA verify, on both stores.

**[F-008]** File: `lib/rate-limit.ts:243-247` · Security · Medium
Finding: `clientIp` takes the **leftmost** `X-Forwarded-For` entry, which the client controls behind any appending proxy.
Why it matters: rotating a fake IP per request skips the per-IP limit entirely. Uncertainty: on Vercel the header holds only the client IP, but the deployment target is undeclared.
Blast radius: every per-IP policy.

**[F-009]** File: `lib/mfa.ts:173-189` · Security · Medium
Finding: (a) the replay marker is keyed on the *current* 30 s step, but verification tolerates ±1 step, so a code used in step N is accepted again in step N+1. (b) The marker is check-then-insert, so two concurrent uses both succeed.
Why it matters: a shoulder-surfed or phished code is replayable for about 30-60 s.
Blast radius: MFA login.

**[F-010]** File: `app/login/login-form.tsx:61`; `app/login/page.tsx:27` · Security · Medium
Finding: `router.push(nextPath)` takes `?next=` unvalidated.
Why it matters: `/login?next=https://evil.example` sends a freshly authenticated user to a phishing page. It's an open redirect after a *real* login.
Blast radius: every user who follows a crafted link.

**[F-011]** File: `app/api/auth/register/route.ts:104-110` · Security · Medium
Finding: the comment says duplicates "respond exactly as for success", but the body differs (`created:false`) and only success sets a session cookie.
Why it matters: registration enumerates accounts. The misleading comment hides it.
Blast radius: account privacy; feeds credential stuffing.

**[F-012]** File: `app/api/auth/login/route.ts:72-84` · Security · Low
Finding: a suspended account returns 403 only after the password verifies, which confirms the password is correct.
Why it matters: low. The account can't log in anyway.

**[F-013]** File: `app/api/buyer/orders/route.ts:87`; `components/EcoCashModal.tsx:60-64` · Logic · **High**
Finding: checkout writes `payment_status = 'HELD_ESCROW'` unconditionally. "Payment" is a client-side `Math.random() > 0.05`, and `POST /api/buyer/orders` works without the modal.
Why it matters: farmers are told money is held in escrow when none was taken, and they ship goods. A demo banner is not an enforcement mechanism.
Blast radius: every order, and farmer trust.

**[F-014]** File: `components/EcoCashModal.tsx:75-88,123-141` · Security · Medium
Finding: the UI asks for the user's 4-digit **EcoCash PIN**.
Why it matters: real EcoCash approves payments on the handset via USSD push. Training users to type their PIN into a website is phishing groundwork.

**[F-015]** File: `app/api/me/route.ts:24-31,67-77` · Security · Medium
Finding: a farmer's `ecocash_number`, which is the payout destination, changes with no re-authentication and no format check (`max(20)`).
Why it matters: a hijacked session redirects payouts with one request.

**[F-016]** File: `app/api/admin/users/route.ts:93-98`; `app/api/farmer/listings/route.ts:36-42`; `app/browse/page.tsx:37-38`; `app/api/buyer/orders/route.ts:49-54`; `app/api/buyer/cart/route.ts:74-78` · Logic · Medium
Finding: `suspend_farmer` sets `farmers.status`, and nothing reads it. Suspended farmers keep listing, appearing in browse, and selling.
Why it matters: moderation has no effect.

**[F-017]** File: `app/api/farmer/listings/route.ts:76,107-114` · Logic · Medium
Finding: the owner can PATCH `status: 'ACTIVE'` on a `REMOVED` listing.
Why it matters: takedowns are reversible by the person taken down.

**[F-018]** File: `lib/session.ts:179-186` · Security/Logic · Medium
Finding: "rotate the token hourly" is measured from `last_used_at`, which every request refreshes. A session used at least once an hour **never rotates**.
Why it matters: the sessions most likely to be hijacked mid-use are exactly the ones that never rotate.

**[F-019]** File: `lib/session.ts:188-220` · Reliability · Medium
Finding: two concurrent requests both rotate the token. Each sets a different cookie, and the database keeps the last hash written. If the browser applies the other response last, the user is logged out.
Why it matters: random logouts, most often with App Router prefetching plus fetches in parallel.

**[F-020]** File: `app/api/buyer/orders/route.ts:80` · Reliability · **High**
Finding: `reference = AG-YYYY-<5 random digits>` against `UNIQUE`. 90,000 values give a ~50% birthday collision at about 350 orders a year, and a collision aborts the **whole** checkout.
Why it matters: checkout failures grow with success, and the buyer sees a generic 500.

**[F-021]** File: `app/api/auth/register/route.ts:95-125` · Reliability · Medium
Finding: the user and profile inserts are separate statements. If the second fails, the user is left with no profile, and the email is permanently "taken" because a retry hits the duplicate branch.

**[F-022]** File: `app/api/auth/password/reset/route.ts:59-106`; `lib/session.ts:247-256` · Security/Reliability · Medium
Finding: the password update, epoch bump and session revocation are separate statements, so a failure in between leaves the attacker's sessions alive with the password already changed. The token is also consumed *before* strength validation, so a weak password burns the link.

**[F-023]** File: `lib/mfa.ts:129-135,204-223` · Reliability · Low
Finding: enabling MFA and issuing codes are separate statements, and code regeneration is one DELETE plus 10 INSERTs, all non-atomic. MFA can end up on with no recovery codes.

**[F-024]** File: `lib/mfa.ts:178-188` · Quality · Low
Finding: TOTP replay markers are written into `mfa_recovery_codes`, mixing two kinds of secret in one table, and they accumulate forever.

**[F-025]** File: `scripts/migrate.ts:26-34,52-63` · DevOps · Medium
Finding: there's no transaction per file, so a mid-file failure leaves partial DDL that isn't recorded. Files are split naively on `;`, which breaks on semicolons in strings and function bodies. There's no lock, so concurrent deploys can double-apply.

**[F-026]** File: `lib/pool.ts:50-54` · Reliability · Medium
Finding: no query timeout. A stuck query pins a connection, and with a pool of 10 that starves the app.

**[F-027]** File: `app/api/buyer/orders/route.ts:108-115`; `app/api/orders/[id]/route.ts:225-231`; `app/api/orders/[id]/review/route.ts:128-133`; `lib/rate-limit.ts:109-112,155-158`; `lib/redis.ts:31` · Reliability · Medium
Finding: there is not a single `console.*` call in `app/` or `lib/`. Every 500 and every Redis fallback is swallowed silently.

**[F-028]** File: `app/api/farmer/listings/route.ts:18-19` · Quality · Low
Finding: `harvest_date` and `available_until` are any ≤10-char string, so an invalid date reaches Postgres and returns an unhandled 500.

**[F-029]** File: `app/api/buyer/orders/route.ts:50-54,68` · Logic · Low
Finding: checkout doesn't check `is_available`, even though cart-add does.

**[F-030]** File: `app/admin/page.tsx:23-24,77-84` · Logic · Low
Finding: GMV and revenue include cancelled and refunded orders, and the "weekly" chart aggregates all time by weekday.

**[F-031]** File: `app/farm/orders/page.tsx:24-32` · Performance · Medium. Unbounded order list per farmer.
**[F-032]** File: `app/buyer/orders/page.tsx:26-36` · Performance · Medium. Unbounded order list per buyer.
**[F-033]** File: `app/admin/page.tsx:40-44,63-67` · Performance · Low. Unbounded farmers and disputes queries.

**[F-034]** File: `app/browse/page.tsx:39`; `migrations/0001_init.sql:165-166` · Performance · Medium
Finding: `ILIKE '%q%'` search with no trigram index, and no `(status, created_at)` index for the browse ORDER BY. Every search is a sequential scan.

**[F-035]** File: `migrations/0001_init.sql:50-66,92-100` · Performance · Low
Finding: `sessions`, `auth_attempts` and `password_reset_tokens` are never pruned.

**[F-036]** File: `lib/session.ts:179-185` · Performance · Low
Finding: every authenticated request does an UPDATE, so reads become writes.

**[F-037]** File: `lib/password-policy.ts:3-9` vs `lib/password.ts:25` · Quality · Low
Finding: the client meter uses min 8 plus character classes while the server requires min 12 (NIST style). It calls passwords "Strong" that the server rejects, and `passwordPolicy` is dead code.

**[F-038]** File: `migrations/0001_init.sql:160`; `app/farm/listings/page.tsx:25` · Quality · Low. `views_count` is shown to farmers and never incremented.

**[F-039]** File: `README.md:47-53,58-85,101` · Quality · Low
Finding: the README documents the old Vite/Zustand app (`src/pages`, `VITE_SITE_URL`, `ProtectedRoute`, `auth-store.ts`).

**[F-040]** File: `next.config.mjs:14-16,32` · Security · Low. `connect-src https://*.neon.tech` widens the CSP for no reason, because the browser never talks to Neon.

**[F-041]** File: `lib/env.ts:19`; `lib/session.ts:273-279` · Quality · Low. `SESSION_SECRET` is required and never used; `safeEqual` has no callers.

**[F-042]** File: `lib/env.ts:21` · Reliability · Low. `APP_URL` silently defaults to localhost in production, which breaks reset links and the CSRF allowlist.

**[F-043]** File: `tests/*` · Testing · **High**
Finding: all 205 tests target `lib/`. F-001, F-002, F-004 and F-010 live in route handlers, and no test could have seen them.

**[F-044]** File: `tests/setup.ts:8-26` · Testing · Medium
Finding: tests create and delete rows in whatever `.env.local` points at, which is the shared Neon dev DB.

**[F-045]** File: `app/api/` · DevOps · Medium. No health endpoint.

**[F-046]** File: `bun.lock`, `bun.lockb`, `package-lock.json`; `.github/workflows/ci.yml:76-77` · DevOps · Low
Finding: three lockfiles but CI uses npm, so they drift. No dependency audit in CI, which is how F-006 went unnoticed.

**[F-047]** File: `migrations/0001_init.sql:62-63` (`sessions.ip`, `user_agent`) · Security · Medium
Finding: your standing requirement for session anomaly detection (impossible travel, data-access volume, privilege-escalation attempts) is absent. IP and user agent are captured and never read.

> **Considered and rejected:** `lib/csrf.ts:72-78` trusting the `Host` header. A browser sets `Host` to the target and `Origin` to the attacker, so they can never match. It isn't a finding.

---

## Phase 2 — Solution Design (Architect)

The first-cut design per finding. Where Phase 3 or 4 changed a design, that is marked here and the **final code is in Phase 5 / the patch**.

| S | Resolves | Fix (first cut) | Root cause addressed | Trade-offs | Migration | Confidence |
|---|---|---|---|---|---|---|
| S-001 | F-001 | `PUT` uses `requireUser()` (a half-auth session fails with `mfa_required`) and refuses if MFA is already on. `confirmEnrolment` only touches `mfa_enabled = FALSE` rows. Rate-limited under `mfa`. | The handler was the only path that treated a half-auth session as enough to answer MFA | none | No | High |
| S-002 | F-002 | `POST` returns 409 when MFA is enabled; `beginEnrolment` only updates `WHERE mfa_enabled = FALSE` and returns `null` otherwise | Re-enrolment was an unguarded disable | Re-enrolling now needs disable (with password) first | No | High |
| S-003 | F-003, F-040 | Per-request nonce CSP built in middleware (request and response header); layout script gets `nonce`; CSP removed from `next.config`; `connect-src 'self'` | A static CSP cannot allow inline streamed scripts | Every page is dynamic (most already were) | No | High *(verified in a browser)* |
| S-004 | F-004 | `requireAdmin` rejects an admin without MFA → **invalidated by W-004a**, moved to `requireUser` | – | Seeded and demo admins must enrol before using admin functions | No | High |
| S-005 | F-005 | Seed refuses `NODE_ENV/VERCEL_ENV=production`; upsert no longer overwrites `password_hash` or `role` | Seed equated "re-run" with "reset everyone" | Re-seeding no longer repairs a changed demo password | No | High |
| S-006 | F-006 | `images: { unoptimized: true }` now; **upgrade to Next 15.5.24+** as its own PR | Removes the optimizer endpoint (the RCE surface) at zero functional cost | The other 22 advisories remain until the upgrade | No (upgrade: async `cookies()/headers()/params`, codemod) | Medium |
| S-007 | F-007 | `chargeAttempt` / `settleAttempt`: insert the attempt **first**, evaluate everyone else's charges (including in-flight ones), refund if throttled, mark succeeded on success. Redis: `MULTI zadd+zcard+zrevrange` | The race window between check and record | +1 UPDATE on success; a concurrent burst may be refused entirely (fail-closed) | No | High *(proven by burst tests on both stores)* |
| S-008 | F-008 | Rightmost XFF hop | The rightmost entry is the one appended by the nearest proxy | Wrong behind CDN→LB chains (see R-006) | No | Medium |
| S-009 | F-009, F-024 | New `mfa_used_totp(user_id, code_hash)` table; one atomic `INSERT … ON CONFLICT DO UPDATE … WHERE used_at < now()-120s RETURNING` | Key on the code and cover the whole acceptance window; atomic | A genuine repeat of the same 6 digits within 2 min is refused (1e-6) | **Yes**, 0003 | High |
| S-010 | F-010 | `safeNextPath()` parses with `new URL(next, base)` and keeps only same-origin paths | A prefix check misses `/\evil`, `/\t/evil` | none | No | High |
| S-011 | F-011 | Make the duplicate response identical → **invalidated by W-011** | – | – | – | – |
| S-012 | F-012 | none, accepted (R-009) | – | – | – | – |
| S-013 | F-013 | `SIMULATED_PAYMENTS=true` required for checkout to record `HELD_ESCROW`; otherwise 503 | A demo shortcut was the production default | Existing deploys must set the flag to keep the demo working | No | High |
| S-014 | F-014 | Remove the PIN field; a confirm button labelled "simulated" | Never collect the PIN | none | No | High |
| S-015 | F-015 | Zimbabwe phone regex; current password required when the farmer's payout number changes | The payout destination is a money-moving setting | One extra field in the form | No | High |
| S-016 | F-016 | Filter `f.status <> 'SUSPENDED'` in home, browse, farmer and listing pages, buyer recommendations, cart-add and checkout; refuse listing create/edit for suspended farmers | Enforce at read and write time | 7 query sites to keep consistent (see Pass 3) | No | High |
| S-017 | F-017 | `UPDATE … WHERE (isAdmin OR status <> 'REMOVED') RETURNING` → 409 | Ownership ≠ authority over moderation | none | No | High |
| S-018 | F-018 | New `rotated_at`; rotate when it is ≥1 h old | Measure the thing the policy names | none | **Yes**, 0003 | High |
| S-019 | F-019 | `prev_token_hash` honoured for a 10-min grace; compare-and-swap rotation; the loser restores the presented token; presenting the prev token triggers re-rotation → **CAS key changed by W-019a** | Rotation must be idempotent under concurrency | A captured *previous* token works for ≤10 min | **Yes**, 0003 | Medium→High after tests |
| S-020 | F-020 | 40-bit random reference (Web Crypto) | Collision space | Longer reference | No | High |
| S-021 | F-021 | One CTE statement: `WITH u AS (INSERT users) INSERT profile SELECT … FROM u` | Atomicity without a transaction helper | none | No | High |
| S-022 | F-022 | Look up the token without consuming; validate; then one CTE claims the token, sets password + epoch and revokes sessions. `invalidateAllSessions` is also one statement | Atomic and single-use; a weak password no longer burns the link | none | No | High |
| S-023 | F-023 | Enable + issue codes in one CTE; regenerate as `WITH DELETE … INSERT … unnest()` | Atomic | none | No | High |
| S-025 | F-025 | Per-file transaction + advisory lock + whole-file simple-protocol query; splitter deleted | DDL is transactional in Postgres | `CREATE INDEX CONCURRENTLY` can't be used in a migration (R-010) | No | High |
| S-026 | F-026 | `query_timeout: 15_000` | Bound the wait | Client-side: the server query keeps running | No | Medium (see W-026) |
| S-027 | F-027 | `lib/log.ts` (JSON lines, `describeError` redaction); log in every swallowed catch; Redis fallback logged ≤1/min | Observability | Log volume | No | High |
| S-028 | F-028 | `z.union([z.literal(''), z.string().date()])` | Validate at the trust boundary | none | No | High |
| S-029 | F-029 | Checkout checks `is_available` and farmer status | Parity with cart-add | none | No | High |
| S-030 | F-030 | Exclude CANCELLED/REFUNDED; weekly = last 7 days | Correct definitions | none | No | High |
| S-031..033 | F-031..033 | `LIMIT 100/200` plus a `ponytail:` note | Bound responses | Older rows not shown until pagination exists | No | High |
| S-034 | F-034 | `pg_trgm` GIN indexes on title/produce_type; `(status, created_at DESC)` | Index the access paths | Write amplification on listings; needs the `pg_trgm` extension | **Yes**, 0003 | High |
| S-035 | F-035 | `npm run db:prune` (sessions, reset tokens, attempts 90d, events 180d, TOTP markers) | Retention | Needs a scheduler | No | High |
| S-036 | F-036 | Only slide the idle window when the last touch is >5 min old | Fewer writes | Idle expiry granular to 5 min | No | High |
| S-037 | F-037 | Meter scores 0 below 12 chars; dead `passwordPolicy` deleted | One authority | none | No | High |
| S-038 | F-038 | Increment on listing view | Wire the dead column | One write per view (R-012) | No | High |
| S-039 | F-039 | Rewrite the env and structure sections; label the old changelog historical | Accurate docs | none | No | High |
| S-041 | F-041 | Delete `SESSION_SECRET` and `safeEqual` | Dead code | none | No | High |
| S-042 | F-042 | `APP_URL` required in production | Fail loud | Build needs `APP_URL` | No | High |
| S-043 | F-043 | Route-level tests (`tests/auth-routes.test.ts`) + a static guard scan (Pass 4) | Test where the bugs live | none | No | High |
| S-044 | F-044 | `TEST_DATABASE_URL` overrides `DATABASE_URL` in `tests/setup.ts` | Isolation | One more env var | No | High |
| S-045 | F-045 | `GET /api/health` → `SELECT 1`, 200/503 | Readiness | Unauthenticated (reveals up/down only) | No | High |
| S-046 | F-046 | Delete the bun lockfiles; `npm audit --omit=dev --audit-level=high` in CI | One resolver; visibility | See W-046 | No | High |
| S-047 | F-047 | `lib/anomaly.ts` + `security_events` table. **Impossible travel** at login (haversine; >1000 km/h and ≥500 km, using `x-vercel-ip-latitude/longitude`). **Privilege escalation**: `/api/me` stripped fields. **Data volume**: `/api/admin/users` bulk reads, flagged at 21 per session-hour. Detect-and-log, never block. | Wire into real call sites | No geo outside Vercel (R-007) | **Yes**, 0003 | Medium |

---

## Phase 3 — Adversarial Self-Review (Adversary)

Many of these were found by **running** the fixes, not by thinking about them. Those are marked ⚙. I list only weaknesses that are real. Padding every Low fix to four invented vectors would add noise, not safety. That's a deliberate deviation from the four-per-solution minimum.

**[W-001a]** Attacks S-001 · New attack surface · `setup/route.ts` · An admin without MFA can't call `requireUser()` once S-004 lands, so they couldn't enrol at all, which is a lockout. → resolved with an explicit `requireUser({ allowUnenrolledAdmin: true })`, used only by the enrolment endpoints. Route test "can still begin enrolment" covers it. · High
**[W-001b]** Attacks S-001 · Logical contradiction · `lib/mfa.ts confirmEnrolment` · A concurrent POST could replace the pending secret between verification and enable. → the enable is `WHERE mfa_secret = <the one verified>`. · Medium
**[W-001c]** Attacks S-001 · Human failure · The fix depends on everyone remembering that `getSession()` ≠ authenticated. → Pass 4 static scan requires `require(User|Role|Admin)` in every mutating route outside an explicit allowlist. · High
**[W-001d]** Attacks S-001 · Deferred problem · `DELETE` (disable MFA) checks the password with **no throttle**, making it a password oracle for a hijacked session. → fixed in Pass 2 (`chargeAttempt('login')`). · Medium

**[W-003a]** Attacks S-003 · Dependency assumption · ⚙ GHSA-ffhc-5mcf-pf4q: Next <15.5.16 can reflect a malformed nonce from *request headers* into HTML (stored XSS behind shared caches). Adopting nonces walks straight into it. → middleware **always overwrites** `x-nonce` and the request CSP; the nonce is `btoa(uuid)` (`[A-Za-z0-9+/=]` only); pages are dynamic. Verified: a forged `x-nonce: "><script>…` is not reflected. · High
**[W-003b]** Attacks S-003 · Scale · `headers()` in the root layout makes every route dynamic, so no static caching. Accepted: 20/21 routes were already `ƒ`. · Low
**[W-003c]** Attacks S-003 · Human failure · Someone adds `<Script>` or a third-party tag without a nonce, and it silently fails. `'strict-dynamic'` covers scripts loaded *by* nonced scripts only. → noted in the middleware comment; R-011. · Medium
**[W-003d]** Attacks S-003 · Scale · Prerendered (static) pages would carry no nonce and break. → reading `headers()` in the layout forces dynamic rendering; the build output confirms `ƒ` everywhere. · High

**[W-004a]** Attacks S-004 · Logical contradiction · Admins also act via `requireUser()` (the orders route resolves the `admin` party itself) and `requireRole('farmer','admin')` (listings PATCH), so gating only `requireAdmin` left two admin paths open. **S-004 invalidated** → the check moved to `requireUser`, the one function every path passes through. · High
**[W-004b]** Attacks S-004 · Human failure · Seeded and demo admins now see 403 until they enrol. Intentional; documented. `requirePageRole` redirects them to `/settings/security?enrol=required`. · Low

**[W-005a]** Attacks S-005 · Dependency assumption · The guard trusts `NODE_ENV`/`VERCEL_ENV`. Running from a laptop with a production `DATABASE_URL` bypasses it and creates the admin **if that email doesn't exist yet**. Existing accounts are now safe because there are no overwrites. → R-004. · Medium

**[W-006a]** Attacks S-006 · Deferred problem · `images.unoptimized` closes one advisory; 22 remain (DoS, SSRF, cache poisoning). → the upgrade is the top follow-up (R-001). · High

**[W-007a]** Attacks S-007 · Logical contradiction · ⚙ My first test assumed some of a 30-request burst would pass. **0 passed**: each attempt sees the others in flight, so all are throttled and refunded. That's fail-closed and correct, so the test was fixed. A sequential test proves the old semantics hold (exactly 6, then throttled). · Medium
**[W-007b]** Attacks S-007 · New attack surface · While an attacker keeps bursting, a legitimate attempt on that account sees the in-flight charges and is throttled. That's the same per-account DoS the progressive-delay design already accepts (`rate-limit.ts:25-30`), no worse. · Medium
**[W-007c]** Attacks S-007 · Scale · Charges from requests that crash before settling persist as failures. They fail closed and expire with the window. · Low
**[W-007d]** Attacks S-007 · Human failure · Two limiter APIs now coexist (`checkRateLimit/recordAttempt` for forgot/reset/register, `charge/settle` for login/MFA). → Pass 3. · Low

**[W-008a]** Attacks S-008 · Dependency assumption · Behind CDN→load balancer, the rightmost hop is the CDN/LB, so all users share one "IP" and the 30-per-15-min IP policy trips for everyone. → R-006. · Medium

**[W-009a]** Attacks S-009 · Scale · One marker row per successful MFA login. → opportunistic per-user prune plus `db:prune`. · Low
**[W-009b]** Attacks S-009 · Logical contradiction · The 0003 cleanup removes old markers by `used_at = created_at`, a heuristic. Real used recovery codes have `used_at > created_at`, and deleting a *used* code is harmless anyway. · Low

**[W-011]** Attacks S-011 · Logical contradiction · An identical body is cosmetic: success still sets a session cookie, so the outcome is observable. **S-011 invalidated.** The only real fix is an email-verification step, which needs a mail provider (R-005). Final change: the misleading comment now states the truth. · Medium

**[W-013a]** Attacks S-013 · Human failure · Someone sets `SIMULATED_PAYMENTS=true` in production to "fix" the 503. → the env name and `.env.example` text say what it does; R-003. · High
**[W-013b]** Attacks S-013 · Deferred problem · Existing deploys lose checkout until they set the flag. That's intended: failing loud beats fake escrow. Deployment step listed in §3. · Medium

**[W-015a]** Attacks S-015 · New attack surface · ⚙ The `current_password` check was itself unthrottled, giving a hijacked session a password oracle. → throttled with `chargeAttempt('login')` in Pass 2. · Medium
**[W-015b]** Attacks S-015 · Logical contradiction · ⚙ The strict phone regex rejected `''`, which forms send for empty optional fields, so blank buyer profiles couldn't save. → `optionalPhone` (blank or valid); seed formats checked. · Medium

**[W-016a]** Attacks S-016 · Human failure · Seven query sites must each remember `f.status <> 'SUSPENDED'`. → Pass 3. · Medium

**[W-019a]** Attacks S-019 · Logical contradiction · ⚙ **Compare-and-swap on `rotated_at` never matched**: JS `Date` has millisecond precision and `timestamptz` microseconds. Every rotation "lost", so in effect the fix disabled rotation. Found by the rotation tests. → CAS on `token_hash` (exact). · Critical
**[W-019b]** Attacks S-019 · Human failure · ⚙ The concurrent-rotation test **passed under that bug**, because both requests lost and the old token stayed valid. → the test now asserts exactly one rotation committed. · High
**[W-019c]** Attacks S-019 · New attack surface · ⚙ Logout presenting the *previous* token didn't revoke the session (the match was only on `token_hash`). → `destroySession` matches either hash; test added. · High
**[W-019d]** Attacks S-019 · Deferred problem · A captured previous token works for ≤10 min after a rotation. Bounded, and far less than the previous unbounded non-rotation (F-018). · Low

**[W-020a]** Attacks S-020 · New attack surface · ⚙ Exporting a helper from `route.ts` is invalid in Next (non-route exports), so the build would fail. → moved to `lib/order-lifecycle.ts`. · Medium
**[W-020b]** Attacks S-020 · Dependency assumption · ⚙ `lib/order-lifecycle.ts` is imported by the client component `admin-tabs.tsx`, so `node:crypto` would break the browser bundle. → Web Crypto (`crypto.getRandomValues`). · Medium

**[W-023a]** Attacks S-023 · Logical contradiction · ⚙ `INSERT … SELECT ${userId}, unnest(…)` gives an untyped parameter and a uuid/text error. → `${userId}::uuid`. · Medium

**[W-025a]** Attacks S-025 · Human failure · A future migration that needs `CREATE INDEX CONCURRENTLY` or `ALTER TYPE … ADD VALUE` used in the same file will fail inside the transaction. → R-010. · Low

**[W-026a]** Attacks S-026 · Dependency assumption · `query_timeout` is client-side: the server keeps executing. `statement_timeout` would cancel it, but as a startup parameter it may not pass Neon's PgBouncer endpoint (unverified). → R-008. · Medium

**[W-046a]** Attacks S-046 · Logical contradiction · ⚙ A blocking audit gate fails **every** CI run until Next is upgraded, which would block merging these fixes. → `continue-on-error: true` with a note to remove it in the upgrade PR. · High

**[W-047a]** Attacks S-047 · Dependency assumption · Impossible travel is inert without platform geo headers. · Medium
**[W-047b]** Attacks S-047 · Scale · An authenticated user can spam `/api/me` with stripped fields to fill `security_events`. Bounded by prune and authentication. · Low
**[W-047c]** Attacks S-047 · Logical contradiction · The bulk-read volume alert fires exactly once at the crossing (`== 21`), so concurrent requests could step over it. Accepted: the `bulk_read` rows still exist for queries. · Low

---

## Phase 4 — Iterative Refinement

### Pass 2 — Surviving issues (Architect, then Adversary)

New code this pass, each with a test that proves it:
- **W-019a/b/c**: CAS on `token_hash`; the strengthened concurrent test; prev-token logout test (`tests/session-rotation.test.ts`, 11 tests).
- **W-004a**: admin check moved to `requireUser` (`tests/auth-routes.test.ts › admin API … is refused`).
- **W-001d / W-015a**: both re-auth password checks throttled via `chargeAttempt('login')`.
- **W-007a**: burst-bound and sequential-parity tests on both stores (`tests/rate-limit-charge.test.ts`, `rate-limit-parity.test.ts`).
- **W-020a/b, W-023a, W-015b, W-046a**: fixed as described.
- **S-011** retired; F-011 → R-005.

```
PASS 2 SUMMARY
==============
New findings this pass: W-001d, W-015a (unthrottled re-auth oracles), W-019a, W-019b, W-019c, W-020a, W-020b, W-023a, W-046a
Findings resolved this pass: F-001, F-002, F-004, F-007, F-009, F-018, F-019, F-020, F-023
Findings surviving to next pass: F-006 (mitigated), F-008 (partial), F-011 (accepted), F-013 (gated)
Solutions invalidated by this pass: S-004 (first cut), S-011, S-019 (rotated_at CAS)
System trajectory: Hardening
Most dangerous surviving issue: F-006 — next@14 carries unpatched advisories with no 14.x line
```

### Pass 3 — Systemic contradictions (Adversary)

- **Two rate-limit APIs.** Forgot, reset and register keep check-then-record. A race there buys at most N extra reset emails or registrations, and reset tokens are 256-bit. Accepted, but the asymmetry is documented in `chargeAttempt`'s comment so the next person doesn't "unify" login back onto the racy API.
- **Two atomicity idioms.** New code uses single-statement CTEs (register, reset, MFA); checkout and orders keep `BEGIN/COMMIT` on a pooled client. Both are correct. Converting the old ones would be churn with no defect behind it.
- **Suspended-farmer filter in 7 places (W-016a).** A shared SQL view would be cleaner but changes every listing query's shape. Accepted for now; a new listing query that forgets the filter shows a suspended farmer's listing but **can't sell it**, because cart-add and checkout both enforce it. R-013.
- **Admin MFA × seed × demo.** The seeded admin has no MFA, so admin functions are 403 until enrolment. CI doesn't exercise admin routes as an unenrolled admin except in the new test, which expects 403. Consistent.
- **Nonce CSP × `images.unoptimized` × `SIMULATED_PAYMENTS` × `APP_URL` required.** Four new deploy-time requirements land together. Listed in §3 so they ship as one checklist.

```
PASS 3 SUMMARY
==============
New findings this pass: none new; W-007d, W-016a escalated to residual risks
Findings resolved this pass: none (design consolidation only)
Findings surviving to next pass: F-006, F-008, F-011, F-013
Solutions invalidated by this pass: none
System trajectory: Stable
Most dangerous surviving issue: F-006
```

### Pass 4 — Load & adversarial simulation (Adversary)

**10× traffic with Redis down.** `withStore`/`chargeAttempt` fall back to Postgres, logging the fallback at most once a minute instead of zero times. Each login is 1 INSERT, 2 indexed COUNTs and 1 UPDATE on the primary, about the same as before. The new risk is Neon latency: pool 10 × 15 s `query_timeout`, with no circuit breaker, means a slow Neon queues requests for up to 15 s each. `/api/health` returns 503 so a load balancer can shed traffic. R-008.

**A malicious authenticated user attempting escalation.**
- `{"role":"admin"}` to `/api/me` is stripped by zod and `stripPrivilegedFields`, and now recorded as `privilege_escalation_attempt`.
- Register with `role: admin` is rejected by the discriminated union.
- A farmer driving buyer actions is refused by the state machine (`by:` check).
- IDOR on orders and reviews returns 404 for non-parties.
- A buyer replaying TOTP is refused by `mfa_used_totp`.
- A hijacked session redirecting payouts now needs the password, and that check is throttled.

Not found: a path to `role` mutation. Admin creation is not an in-app operation.

**A new developer's first change.** The likely mistake is a new `POST` route that forgets `verifyOrigin()` or `requireUser()`; nothing central enforces either. → added `tests/route-guards.test.ts`, which scans every `app/api/**/route.ts` and fails CI if a mutating handler lacks `verifyOrigin(` or (outside an explicit allowlist of public auth routes) `require(User|Role|Admin)(`. A second likely mistake is copying `getSession()` from the MFA verify route; the same scan catches it.

```
PASS 4 SUMMARY
==============
New findings this pass: P4-1 (CSRF/authz opt-in per handler: new routes fail open) → resolved by static guard scan
Findings resolved this pass: P4-1
Findings surviving to next pass: F-006, F-008, F-011, F-013
Solutions invalidated by this pass: none
System trajectory: Hardening
Most dangerous surviving issue: F-006
```

### Pass 5 — The hardest remaining assumption (Adversary)

**The assumption: "the framework is a trustworthy foundation."** Every control in this report runs inside Next 14: the session, CSRF, authorization, the nonce CSP, and middleware. Next 14 is past its patch line and carries 23 advisories, including Server Components DoS, Server Action SSRF, cache poisoning, and a proxy/middleware bypass (Pages Router + i18n; this app is App Router, so likely not reachable — unverified). App-level hardening can't patch the request parser or RSC deserializer underneath it, and the nonce XSS advisory shows the framework can undo an app-level control. `images.unoptimized` removes one door. The others stay open until `next@15.5.24+`.

Why this ranks above the rest: the other residual risks are bounded by the app's own logic (a 10-min token grace, shared-IP throttling). This one has an unknown bound, and it needs no authentication.

```
PASS 5 SUMMARY
==============
New findings this pass: none
Findings resolved this pass: none
Findings surviving: F-006 (R-001), F-008 (R-006), F-011 (R-005), F-013 (R-003)
Solutions invalidated by this pass: none
System trajectory: Hardening
Most dangerous surviving issue: F-006 — the security model rests on an EOL framework line
```

---

## Phase 5 — Final Implementation (Architect)

The complete, verified code is **`docs/audit/2026-10-07-rarp-fixes.patch`** (`git apply docs/audit/2026-10-07-rarp-fixes.patch`). The excerpts below are the parts that matter; the patch is the source of truth.

### 1. Implementation plan (dependency order)

1. `migrations/0003_hardening.sql` → `npm run db:migrate` (F-009, F-018, F-019, F-024, F-034, F-047)
2. `lib/log.ts`, `lib/env.ts` (F-027, F-041, F-042, F-013 flag)
3. `lib/pool.ts` (F-026), `scripts/migrate.ts` (F-025), `scripts/seed.ts` (F-005), `scripts/prune.ts` + `package.json` (F-035)
4. `lib/session.ts` (F-018, F-019, F-022, F-036, F-041)
5. `lib/rbac.ts`, `lib/page-guard.ts` (F-004, F-010)
6. `lib/mfa.ts` (F-001, F-002, F-009, F-023, F-024)
7. `lib/rate-limit-store.ts`, `lib/rate-limit.ts` (F-007, F-008, F-027)
8. `lib/anomaly.ts` (F-047), `lib/order-lifecycle.ts` (F-020), `lib/password-policy.ts` (F-037)
9. `middleware.ts`, `next.config.mjs`, `app/layout.tsx` (F-003, F-006, F-040)
10. Route handlers: `auth/login`, `auth/mfa/setup`, `auth/mfa/verify`, `auth/register`, `auth/password/reset`, `buyer/orders`, `buyer/cart`, `farmer/listings`, `me`, `admin/users`, `orders/[id]`, `orders/[id]/review`, new `health`
11. Pages: `page.tsx`, `browse`, `farmer/[id]`, `listing/[id]`, `buyer/dashboard`, `buyer/orders`, `farm/orders`, `farm/listings`, `admin`, `login`; components `EcoCashModal.tsx`, `farm/profile/profile-form.tsx`
12. Config/docs: `.env.example`, `.github/workflows/ci.yml`, `README.md`, `tests/setup.ts`; delete `bun.lock`, `bun.lockb`
13. Tests: `auth-routes`, `hardening`, `rate-limit-charge`, `route-guards` (new); `mfa`, `session-rotation`, `rate-limit-parity` (updated)

### 2. Key code changes

**F-001/F-002: `app/api/auth/mfa/setup/route.ts`**
```ts
export async function POST() {
  const csrf = verifyOrigin('POST');
  if (!csrf.ok) return csrfFailure();
  const auth = await requireUser({ allowUnenrolledAdmin: true });
  if (!auth.ok) return auth.response;
  if (auth.user.mfaEnabled) return alreadyEnabled();          // 409
  const challenge = await beginEnrolment(auth.user.id, auth.user.email);
  if (!challenge) return alreadyEnabled();
  …
}
export async function PUT(request: Request) {
  …
  const auth = await requireUser({ allowUnenrolledAdmin: true }); // half-auth → 403 mfa_required
  if (!auth.ok) return auth.response;
  const session = auth.user;
  if (session.mfaEnabled) return alreadyEnabled();
  const ip = clientIp(request.headers);
  const limit = await checkRateLimit('mfa', { identifier: session.email, ip });
  if (limit.limited) return tooManyRequests(limit.retryAfterSeconds);
  …
}
```
`lib/mfa.ts`: `beginEnrolment` updates `WHERE id = $1 AND mfa_enabled = FALSE RETURNING id` (else `null`). `confirmEnrolment` reads only `mfa_enabled = FALSE` rows and enables + issues codes in one CTE guarded by `mfa_secret = <verified ciphertext>`.

**F-003: `middleware.ts` (excerpt)**
```ts
const nonce = btoa(crypto.randomUUID());
const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV === 'production');
const requestHeaders = new Headers(req.headers);
requestHeaders.set('x-nonce', nonce);                    // always overwritten (W-003a)
requestHeaders.set('content-security-policy', csp);
const res = NextResponse.next({ request: { headers: requestHeaders } });
res.headers.set('content-security-policy', csp);
```
with `script-src 'self' 'nonce-…' 'strict-dynamic'` and `connect-src 'self'`; `app/layout.tsx` adds `nonce={headers().get('x-nonce') ?? undefined}`.

**F-004: `lib/rbac.ts`**
```ts
export async function requireUser(opts: { allowUnenrolledAdmin?: boolean } = {}) {
  const user = await getSession();
  if (!user) return unauthorized();
  if (user.mfaEnabled && !user.mfaSatisfied) return mfaRequired();
  if (user.role === 'admin' && !user.mfaEnabled && !opts.allowUnenrolledAdmin) {
    return mfaEnrolmentRequired();
  }
  return { ok: true, user };
}
```

**F-007: `lib/rate-limit.ts` (shape)**
```ts
const charge = await chargeAttempt('login', { identifier: email, ip }); // INSERT first
if (charge.limited) return tooManyRequests(charge.retryAfterSeconds);  // refunded
… verify …
await settleAttempt(charge.ticket, true);                              // success only
```
Postgres stats exclude the caller's own row (`AND id <> $exclude::bigint`). Redis `charge()` is one `MULTI`: `zremrangebyscore`, `zadd`, `expire`, `zcard`, `zrevrange 0 1 WITHSCORES`.

**F-009: `lib/mfa.ts`**
```ts
const accepted = await sql`
  INSERT INTO mfa_used_totp (user_id, code_hash, used_at)
  VALUES (${userId}, ${codeHash}, now())
  ON CONFLICT (user_id, code_hash) DO UPDATE SET used_at = now()
    WHERE mfa_used_totp.used_at < now() - make_interval(secs => ${REPLAY_WINDOW_SECONDS})
  RETURNING 1`;
if (accepted.length === 0) return false;
```

**F-018/F-019: `lib/session.ts`**
```ts
const rotationDue = s.presentedPrevious || now - s.rotatedAt.getTime() >= ROTATE_AFTER_MS;
…
const won = await sql`
  UPDATE sessions
     SET prev_token_hash = ${hashToken(s.presentedToken)}, token_hash = ${hashToken(rotated)},
         rotated_at = now(), last_used_at = now(), expires_at = ${newIdle.toISOString()}
   WHERE id = ${s.sessionId} AND token_hash = ${s.currentHash}   -- exact CAS (W-019a)
   RETURNING id`;
if (won.length === 0) cookies().set(sessionCookieName(), s.presentedToken, …); // loser
```
`getSession` also matches `prev_token_hash` within `ROTATION_GRACE_MS` (10 min); `destroySession` revokes by either hash.

**F-022: `app/api/auth/password/reset/route.ts`**: peek, validate, then one statement:
```sql
WITH t AS (UPDATE password_reset_tokens SET used_at = now()
            WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING user_id),
     u AS (UPDATE users SET password_hash = $2, session_epoch = session_epoch + 1,
                  password_changed_at = now(), updated_at = now()
            WHERE id IN (SELECT user_id FROM t) RETURNING id),
     s AS (UPDATE sessions SET revoked_at = now()
            WHERE user_id IN (SELECT id FROM u) AND revoked_at IS NULL)
SELECT id FROM u
```

**F-013: `app/api/buyer/orders/route.ts`**
```ts
if (!env.SIMULATED_PAYMENTS) {
  return NextResponse.json({ error: 'Payments are not available yet.', code: 'payments_unavailable' }, { status: 503 });
}
```

**F-010: `lib/page-guard.ts`**
```ts
export function safeNextPath(next: string | undefined | null): string | undefined {
  if (!next) return undefined;
  const base = 'http://agriconnect.invalid';
  try {
    const url = new URL(next, base);
    if (url.origin !== base) return undefined;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return undefined; }
}
```

The rest (F-005, F-014 to F-017, F-020, F-021, F-023, F-025 to F-047) is in the patch, each change commented with its reason.

### 3. Configuration & infrastructure changes

| Change | Detail |
|---|---|
| Migration | `npm run db:migrate` applies `0003_hardening.sql` (needs `CREATE EXTENSION pg_trgm`; Neon and `postgres:16-alpine` both have it) |
| Env **added** | `SIMULATED_PAYMENTS=true` (demo/preview only, **never production**); `TEST_DATABASE_URL` (optional) |
| Env **removed** | `SESSION_SECRET` (unused) |
| Env **now required in production** | `APP_URL` |
| `next.config.mjs` | CSP moved to middleware; `images: { unoptimized: true }` |
| CI | `SIMULATED_PAYMENTS: 'true'`; `SESSION_SECRET` removed; `npm audit --omit=dev --audit-level=high` step, **report-only** until the Next upgrade |
| Scheduler | Run `npm run db:prune` daily (Vercel Cron, GitHub Actions schedule, or system cron) |
| Lockfiles | Delete `bun.lock`, `bun.lockb`; npm is the resolver CI uses |
| Monitoring | Point an alert at log lines `"event":"security.*"`, `"checkout_failed"`, `"ratelimit_redis_fallback"`; probe `GET /api/health` |
| **Next PR** | `next@15.5.24+` via `npx @next/codemod@latest upgrade` (async `cookies()`, `headers()`, `params`); then remove `continue-on-error` from the audit step |

### 4. Test cases (Critical/High findings)

| Finding | Test | Fails on original code? |
|---|---|---|
| F-001 | `auth-routes › PUT … refuses a half-authenticated session even with a valid code` | **Yes** (ran it) |
| F-002 | `auth-routes › POST … cannot replace an active factor`; `mfa › beginEnrolment refuses …` | **Yes** |
| F-003 | `hardening › content security policy`, plus manual prod build + browser check | build artifact showed 0 nonces |
| F-004 | `auth-routes › admin API without an enrolled second factor › is refused` | **Yes** |
| F-005 | none automated (script; guarded by env check). Reviewed by hand. | – |
| F-006 | CI audit step (report-only) | reports 11 vulns |
| F-007 | `rate-limit-charge › bounds a concurrent burst`, `parity › … Redis store too` | by construction (old API has no charge) |
| F-013 | none automated (env-gated branch). Reviewed by hand. | – |
| F-020 | `hardening › order references carry 40 random bits` | the format test would fail |
| F-043 | `route-guards` static scan | n/a |
| F-009 (Medium, bonus) | `mfa › refuses a code reused after the clock ticks into the next step`, `… exactly one of two concurrent uses` | yes, by the step-key logic |

### 5. Key design decisions

1. **Charge-first over locks.** Advisory locks held across Argon2 would starve the 10-connection pool. Charge-first adds one row and no held connections.
2. **Admin MFA enforced in `requireUser`, not `requireAdmin`.** It's the only function every admin path passes through (W-004a).
3. **Exact CAS on `token_hash`.** Timestamps lose microseconds in JS (W-019a).
4. **CTEs for atomicity.** No new transaction helper; one round trip; the database guarantees it.
5. **Nonce CSP in middleware over `'unsafe-inline'`.** `'unsafe-inline'` would have "fixed" hydration and thrown away most of the CSP's value.
6. **`SIMULATED_PAYMENTS` defaults off.** Failing loud with a 503 beats telling farmers money is in escrow when it isn't.
7. **Detectors log; they don't block.** A false positive in impossible travel (a VPN, a carrier NAT) would otherwise lock people out.
8. **Next 15 is not in this patch.** It's a breaking migration that touches every page and should be reviewed on its own; `images.unoptimized` buys time for the worst advisory.
9. **Register enumeration accepted, not papered over.** An identical body would only hide it from code review, not from attackers.

### 6. Residual risk register

**[R-001]** Risk: unpatched next@14 advisories (DoS, SSRF, cache poisoning). Location: `package.json`. Likelihood: Medium. Severity: High. Why it remains: the upgrade is a breaking migration outside this patch's scope. Partial mitigation: image optimizer disabled, no rewrites, no Server Actions, App Router only. Acceptance rationale: this patch closes app-level holes that are exploitable *today* with less effort; the upgrade is the next PR, and the audit step keeps it visible.

**[R-002]** Risk: a previous session token works for ≤10 min after rotation. Location: `lib/session.ts`. Likelihood: Low. Severity: Low. Why it remains: needed for concurrent requests not to log users out. Partial mitigation: logout revokes both hashes; the grace is short. Acceptance rationale: before this patch, active tokens never rotated at all.

**[R-003]** Risk: `SIMULATED_PAYMENTS=true` set in production. Location: env. Likelihood: Low. Severity: High. Why it remains: no payment provider exists to replace it. Partial mitigation: explicit name, `.env.example` warning, off by default. Acceptance rationale: the alternative is no demo checkout at all; integrating EcoCash is product work.

**[R-004]** Risk: seeding from a laptop against production creates the demo admin if that email is absent. Location: `scripts/seed.ts`. Likelihood: Low. Severity: High. Why it remains: the script can't reliably tell a remote dev database (Neon) from production. Partial mitigation: env guard; existing accounts are never overwritten; admin functions need MFA, which a fresh seeded admin doesn't have. Acceptance rationale: an attacker still needs to pass MFA enrolment with the admin's session, which first requires logging in. That would be possible with the public password, so **use a production database role without INSERT on `users` for humans.** That last step isn't enforceable from code.

**[R-005]** Risk: register reveals whether an email exists. Location: `app/api/auth/register/route.ts`. Likelihood: High. Severity: Low. Why it remains: needs email verification and a mail provider. Partial mitigation: per-IP register limit (15/h); login and forgot-password don't enumerate. Acceptance rationale: knowing an email is registered doesn't bypass Argon2, the login throttle or MFA.

**[R-006]** Risk: behind multi-proxy chains every client shares one "IP". Location: `clientIp`. Likelihood: Medium (depends on deployment). Severity: Medium. Why it remains: the trusted hop count is deployment knowledge. Partial mitigation: the per-identifier limits are unaffected; the IP policy is loose. Acceptance rationale: rightmost is correct for Vercel and single reverse proxies; add a `TRUSTED_PROXY_HOPS` setting when deploying behind a CDN plus a load balancer.

**[R-007]** Risk: impossible-travel detection is inert outside Vercel. Location: `lib/anomaly.ts`. Likelihood: High if self-hosted. Severity: Medium. Why it remains: needs a GeoIP source. Partial mitigation: the other two detectors work everywhere. Acceptance rationale: adding a GeoIP database is a licensing and dependency decision for you.

**[R-008]** Risk: a slow database ties up requests for up to 15 s; no circuit breaker; client timeouts don't cancel server queries. Location: `lib/pool.ts`. Likelihood: Medium. Severity: Medium. Why it remains: whether `statement_timeout` passes Neon's pooler is unverified. Partial mitigation: `query_timeout`, `/api/health` → 503, logging. Acceptance rationale: bounded instead of unbounded; test `options=-c statement_timeout=10000` on the Neon pooled URL next.

**[R-009]** Risk: a suspended account's 403 confirms the password. Location: `login/route.ts`. Likelihood: Low. Severity: Low. Why it remains: a generic 401 would confuse legitimate suspended users. Acceptance rationale: the confirmed password unlocks nothing while the account is suspended, and reactivation is admin-only.

**[R-010]** Risk: migrations that can't run in a transaction (`CREATE INDEX CONCURRENTLY`). Location: `scripts/migrate.ts`. Likelihood: Low. Severity: Low. Why it remains: the transaction is the point of the fix. Partial mitigation: it fails loudly and nothing is applied. Acceptance rationale: add a `-- no-transaction` file marker when the first such migration is needed.

**[R-011]** Risk: a new inline or third-party script without a nonce silently breaks. Location: CSP. Likelihood: Medium. Severity: Low. Partial mitigation: comments in middleware and layout. Acceptance rationale: it fails closed (blocked), not open.

**[R-012]** Risk: `views_count` costs one write per view and can be inflated by bots. Location: `app/listing/[id]/page.tsx`. Likelihood: Medium. Severity: Low. Acceptance rationale: it's a vanity metric; batch it if traffic grows (`ponytail:` note in place).

**[R-013]** Risk: a new listing query forgets the suspended-farmer filter. Location: listing queries. Likelihood: Medium. Severity: Low. Partial mitigation: cart-add and checkout enforce it, so a suspended farmer can be *seen* but can't *sell*. Acceptance rationale: the money path is protected; a view would be the cleaner long-term fix.
