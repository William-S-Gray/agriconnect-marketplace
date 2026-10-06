# AgriConnect — Zimbabwe Agricultural Marketplace

> **Demo-ready React/TypeScript SPA** connecting Zimbabwean farmers directly with buyers, with EcoCash payment simulation, escrow flow, and admin oversight.

---

## 🌱 Demo Mode

This build runs in **Demo Mode** — all data is seeded and no real payments are processed. A persistent banner at the top of every page makes this clear.

### Demo Credentials

| Role    | Email                        | Password     | Dashboard URL       |
|---------|------------------------------|--------------|---------------------|
| Farmer  | `john@moyofarm.co.zw`        | `Demo@1234`  | `/farm/dashboard`   |
| Buyer   | `kuda@email.co.zw`           | `Demo@1234`  | `/buyer/dashboard`  |
| Admin   | `admin@agriconnect.co.zw`    | `Demo@1234`  | `/admin` (via `/admin/login`) |

Every seeded account shares the same demo password, defined as `DEMO_PASSWORD` in `src/lib/demo-credentials.ts`. Logins are actually verified — an unknown email or a wrong password is rejected, and 5 failed attempts lock the account for 15 minutes. Accounts created through the registration form sign in with the password chosen there.

> **Admin login is intentionally NOT linked from the public login page** — navigate directly to `/admin/login`. The admin email is an exact-match allowlist, not a pattern.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test
```

**Requirements:** Node.js 18+, npm 9+

### Environment Variables

Copy `.env.example` to `.env.local` and fill it in. Every variable is server-only; real env files are gitignored.

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Postgres connection string (Neon pooled endpoint recommended). |
| `MFA_ENCRYPTION_KEY` | Yes | Encrypts TOTP secrets at rest and peppers recovery-code hashes. Rotating it invalidates all enrolled MFA. |
| `APP_URL` | In production | Public origin, no trailing slash. Used for CSRF origin checks, reset links and `og:image` URLs. |
| `SIMULATED_PAYMENTS` | No | `true` lets checkout record orders as paid into escrow without a payment provider (the demo). Otherwise checkout returns 503. |
| `REDIS_URL` | No | Redis for auth rate-limit counters. Unset, counters live in Postgres. If set but unreachable, the limiter falls back rather than failing open. |
| `TEST_DATABASE_URL` | No | Database for `npm test`; the suite writes and deletes rows. Falls back to `DATABASE_URL`. |
| `ANOMALY_TRUSTED_PROXY` | No | `vercel` or `cloudflare` when deployed behind one; enables impossible-travel detection from that edge's geo headers. Unset, travel detection is inert. |

Before pushing, `npm run ci` runs the same gate as CI against throwaway containers.

Scheduled maintenance: run `npm run db:prune` daily to delete expired sessions, spent reset tokens and old audit rows.

---

## 📁 Project Structure

```
app/                 Next.js App Router pages and route handlers (app/api/**)
components/          UI components (shadcn/ui under components/ui)
lib/                 Server modules: session, rbac, csrf, rate-limit, mfa, anomaly(-monitor), order-lifecycle
middleware.ts        Cookie-presence pre-filter + per-request CSP nonce (not the auth boundary)
migrations/          Forward-only SQL, applied by scripts/migrate.ts
scripts/             migrate, seed (refuses production), prune, ci-local.sh
tests/               Vitest suites; integration tests need a database
```

---

> The section below is the historical changelog from the earlier Vite/Zustand
> version of this app. File names in it no longer exist.

## ✅ What Was Fixed (Expert Panel Review — All Phases)

### 🔴 Critical Fixes

| Fix | Description |
|-----|-------------|
| **Seed Data** | `seed-data.ts` — 8 farmers, 12 listings, 5 orders, 18 price records, 1 dispute, 1 review. Every dashboard and page now shows real content. |
| **Demo Mode Banner** | Persistent `DemoModeBanner` across all pages — honest framing, shows demo credentials, dismissable. |
| **EcoCash Checkout** | `EcoCashModal` — realistic USSD simulation: PIN entry → 3s processing → escrow confirmation + order reference. Clears cart and navigates on success. |
| **Route Protection** | `ProtectedRoute` component wraps all farmer, buyer, admin dashboards. Unauthenticated users redirect to login. |
| **Admin Separated** | Admin removed from public `/login` role selector. Admin-only login at `/admin/login`. Admin dashboard redirects to `/admin/login` (not `/login`). |
| **App Error Boundary** | `AppErrorBoundary` wraps entire app. Unhandled render errors show a recovery UI instead of a blank screen. |

### 🟠 High-Priority Fixes

| Fix | Description |
|-----|-------------|
| **Login Form Validation** | `zod` schema enforces required email + password. Submit button disabled + shows spinner during async call. |
| **Password Visibility Toggles** | Eye/EyeOff toggle on all password fields across Login, FarmerRegister. |
| **Step Validation in Registration** | `trigger(step1Fields)` called before `setStep(2)` — cannot advance with invalid step 1 data. |
| **Real File Upload** | `<input type="file">` with `FileReader` preview in `FarmerRegisterPage`. Shows thumbnail + remove option. |
| **Farmer Dashboard — Live Stats** | Revenue, listing count, order count, rating pulled from seed data. Time-aware greeting (morning/afternoon/evening). |
| **Buyer Dashboard — Active Orders** | Seeded orders displayed with status badges. Recommended listings grid. Real total spent. |
| **Admin Dashboard — Full Workflow** | Seeded stats, weekly chart, farmer verification queue (Verify/Reject buttons), orders table, disputes with action buttons, price table, analytics chart. |
| **Market Prices Page** | Populated table from 18 seed price records. Recharts bar chart for avg price per crop. Filterable by province and category. |
| **QueryClient Configuration** | Configured with `staleTime: 5min`, no retry on 401/403 errors (prevents auth hammering). |
| **Zustand Version Key** | `_version` in persisted store (currently `4`). Stale localStorage state is cleared on schema change. Migrated to new key `agriconnect-auth-v2`. |

### 🟡 Medium Fixes

| Fix | Description |
|-----|-------------|
| **Mobile Nav Padding** | `pb-24 md:pb-8` on FarmerDashboard main content — last items no longer hidden behind fixed mobile nav bar. |
| **Homepage Stats** | Shows `7 Verified Farmers`, `12 Active Listings`, `10 Provinces` from seed data (not zeros). |
| **"Why Zimbabwe" Section** | New homepage section explaining EcoCash native, vs WhatsApp groups, no middlemen, 10 provinces. |
| **Homepage Listings** | "In Season Now" grid shows first 4 seeded listings via `ProduceCard`. |
| **Featured Farmers** | 3 verified seed farmers shown with rating and province. |
| **Cart Emoji** | Produce emojis mapped by title keyword for visual polish. |
| **Double-Submit Prevention** | `isSubmitting` state on all form submit buttons — disabled during async operations. |

---

## 🗺️ Remaining Limitations (Round 2+ — See Roadmap)

These are acknowledged limitations that require backend work:

1. **No real backend** — Authentication, persistence, and orders are simulated. No real database.
2. **EcoCash API not integrated** — Simulation only. Real integration requires [Paynow Zimbabwe SDK](https://developers.paynow.co.zw/).
3. **No PWA / Offline support** — No service worker. Critical for rural Zimbabwe connectivity.
4. **Partial test coverage** — Auth (credential verification, admin allowlist, account lockout) and session anomaly detection are covered by 33 tests via `npm run test`. `calculateOrder`, cart logic, and component rendering are still untested.
5. **No i18n** — English only. Shona and Ndebele support needed for rural farmers.
6. **No real file storage** — Photos selected but not persisted anywhere across sessions.
7. **No real farmer verification workflow** — Admin actions in demo mode do not persist to a database.
8. **USSD/SMS alternative** — Feature phone users not supported.

---

## 🛣️ Roadmap

### Round 2 — MVP (1–2 weeks)
- [ ] Backend: Supabase (PostgreSQL + Auth + Storage) or Node.js/Express
- [ ] Real JWT authentication with refresh tokens
- [ ] Paynow Zimbabwe / EcoCash merchant API integration
- [ ] Cloudinary or S3 for produce photo upload
- [ ] Farmer verification workflow with document upload
- [ ] Real-time order status via Supabase Realtime or polling
- [x] Unit tests for auth logic and session anomaly detection
- [ ] Unit tests for `calculateOrder`, cart logic, and component rendering

### Round 3 — Production (1–3 months)
- [ ] PWA + Service Worker for offline listing browsing
- [ ] WCAG 2.1 AA accessibility audit
- [ ] Shona + Ndebele language support (i18n)
- [ ] USSD/SMS fallback for feature phone farmers
- [ ] GPS-based farmer discovery
- [ ] Push notifications (order updates, price alerts)
- [ ] Penetration testing + OWASP Top 10 review
- [ ] Zimbabwe Cybersecurity & Data Protection Act 2021 compliance

---

## 🏗️ Architecture Notes

### Authentication (Demo Mode)
Authentication is simulated client-side for demo purposes. In production:
- Replace `auth-store.ts` `login()` with a `POST /api/auth/login` call
- Store JWT in memory (not localStorage) with refresh token in httpOnly cookie
- Move account lockout logic to server-side (Redis-backed rate limiting)
- Use bcrypt for password hashing

### Session Anomaly Detection

Runs server-side, inline on the request being judged. `lib/anomaly.ts` holds the
decision logic as pure functions; `lib/anomaly-monitor.ts` supplies the
observations and applies the outcome. Detections land in the `security_events`
table and are reviewed at `/admin/security`.

| Signal | Trigger | Action |
|--------|---------|--------|
| **Privilege escalation** | A request tries to set a field a client may never set (`role`, `status`, `password_hash`, …), or a session accumulates 5 authorization denials in 15 minutes. | Field tampering revokes the session. Repeated denials are recorded. |
| **Impossible travel** | A session moves more than 500 km at an implied speed above 1000 km/h between two requests. | Crossing a border forces re-authentication; movement within one country is recorded. |
| **Data access volume** | A session reads 5000 records in an hour, or 10× its own trailing 14-day baseline once past a 200-record floor. | Recorded, and surfaced to admins. |

Every detector requires corroboration — a distance floor as well as a speed, an
absolute floor as well as a ratio — because a false positive costs a real user
their session. Repeats fold into the open event rather than raising a new one,
so an incident is one row an admin can act on.

**Limitations worth knowing:**
- **Travel detection is opt-in via `ANOMALY_TRUSTED_PROXY`** (`vercel` or
  `cloudflare`). Geo arrives as request headers, and a header is only evidence
  if the edge overwrites whatever the client sent. Unset, geo is ignored
  entirely and `/admin/security` says travel detection is inactive — trusting
  those headers by default would not be a weak control, it would be an off
  switch that reports itself as on. Volume and privilege-escalation detection
  are unaffected.
- Where the edge reports a **country but no coordinates**, a country change
  within an hour is recorded at medium severity. It is weaker evidence — a
  border town or a VPN exit node flips country without anyone travelling — so it
  never acts on a session.
- `require_reauth` ends the session outright for accounts without MFA, because
  clearing the MFA flag alone would be a no-op there. Accounts with a second
  factor keep the session and are re-challenged.

### Payment Flow (Demo Mode)
The EcoCash modal simulates the USSD payment flow. In production:
1. Call Paynow Zimbabwe API to initiate payment
2. Poll `/api/orders/:id/payment-status` for confirmation
3. Webhook handler updates order `payment_status` to `HELD_ESCROW`
4. Release escrow to farmer after buyer confirms delivery

### State Management
- **Zustand** with `persist` middleware handles auth + cart
- Version key `_version` (currently `4`) in the `agriconnect-auth-v2` localStorage key
- Bump `STORE_VERSION` constant whenever the persisted schema changes

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Routing | React Router v6 |
| State | Zustand (with persistence) |
| Forms | React Hook Form + Zod |
| Data Fetching | TanStack Query v5 |
| Styling | Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| Toasts | Sonner |

---

## 📞 Zimbabwe Context

- **EcoCash** (Econet Wireless Zimbabwe) is Zimbabwe's dominant mobile money platform with 9M+ subscribers
- **Target problem**: Smallholder farmers earn 40–60% of crop value; the rest goes to middlemen and market fees
- **Existing alternatives**: WhatsApp groups (no verification, no payment protection), physical markets (Mbare, Mvuma), Cold storage intermediaries
- **Phone number format**: `^(\+263|0)(7[1-8])\d{7}$` covers Econet (77x), NetOne (71x), Telecel (73x)
- **Currency**: USD (primary), ZiG (Zimbabwe Gold — optional multi-currency support in roadmap)

---

*AgriConnect — Built for Zimbabwe's farmers. Review conducted and fixes implemented based on Multidisciplinary Expert Panel report.*
