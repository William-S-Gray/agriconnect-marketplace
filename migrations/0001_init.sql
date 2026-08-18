-- AgriConnect initial schema: auth core + domain tables.
--
-- Design notes for the security-critical tables:
--   * Session tokens and password-reset tokens are stored as SHA-256 hashes,
--     never in plaintext. A database dump therefore cannot be replayed as a
--     valid session or reset link.
--   * Roles live only here. The client never supplies a role; it is read from
--     the session's user row on every request.
--   * auth_attempts backs server-side rate limiting. There is no Redis in this
--     deployment, so Postgres is the shared store (documented limitation:
--     slightly higher latency, but correct across multiple instances).

-- ─── Enums (mirroring the existing TypeScript unions in src/lib/mock-data.ts) ──
CREATE TYPE user_role         AS ENUM ('farmer', 'buyer', 'admin');
CREATE TYPE user_status       AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE farmer_status     AS ENUM ('PENDING', 'VERIFIED', 'SUSPENDED');
CREATE TYPE buyer_type        AS ENUM ('INDIVIDUAL', 'RESTAURANT', 'RETAILER', 'PROCESSOR', 'EXPORTER');
CREATE TYPE listing_status    AS ENUM ('ACTIVE', 'SOLD_OUT', 'EXPIRED', 'REMOVED');
CREATE TYPE order_status      AS ENUM ('PENDING', 'CONFIRMED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'DISPUTED', 'CANCELLED', 'REFUNDED');
CREATE TYPE payment_status    AS ENUM ('UNPAID', 'PAID', 'HELD_ESCROW', 'RELEASED', 'REFUNDED');
CREATE TYPE delivery_method   AS ENUM ('PICKUP', 'DELIVERY');
CREATE TYPE dispute_party     AS ENUM ('BUYER', 'FARMER');
CREATE TYPE dispute_status    AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED_BUYER', 'RESOLVED_FARMER', 'CLOSED');
CREATE TYPE auth_attempt_kind AS ENUM ('login', 'mfa', 'password_reset', 'register');

-- ─── Users: the single source of truth for identity and role ───────────────────
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stored already lowercased/trimmed by the application; enforced unique.
  email             TEXT        NOT NULL UNIQUE,
  -- Argon2id PHC string. Never a plaintext or reversibly-encrypted password.
  password_hash     TEXT        NOT NULL,
  role              user_role   NOT NULL,
  status            user_status NOT NULL DEFAULT 'ACTIVE',
  email_verified_at TIMESTAMPTZ,
  -- MFA is only in force once a secret has been confirmed.
  mfa_enabled       BOOLEAN     NOT NULL DEFAULT FALSE,
  mfa_secret        TEXT,
  mfa_confirmed_at  TIMESTAMPTZ,
  -- Bumped on password change/reset so every existing session is invalidated.
  session_epoch     INTEGER     NOT NULL DEFAULT 0,
  password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_email_lowercase CHECK (email = lower(email)),
  CONSTRAINT users_mfa_requires_secret CHECK (NOT mfa_enabled OR mfa_secret IS NOT NULL)
);

-- ─── Sessions: server-side, referenced by an opaque HttpOnly cookie ───────────
CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- SHA-256 of the opaque cookie value. The raw token is never persisted.
  token_hash    TEXT        NOT NULL UNIQUE,
  -- Snapshot of users.session_epoch at issue time; a mismatch invalidates.
  session_epoch INTEGER     NOT NULL DEFAULT 0,
  -- Set once the MFA challenge for this session is satisfied.
  mfa_satisfied BOOLEAN     NOT NULL DEFAULT FALSE,
  expires_at    TIMESTAMPTZ NOT NULL,
  absolute_expires_at TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  ip            TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx    ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);

-- ─── MFA recovery codes: single-use, stored hashed ────────────────────────────
CREATE TABLE mfa_recovery_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT        NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, code_hash)
);

-- ─── Password reset tokens: hashed, expiring, single-use ──────────────────────
CREATE TABLE password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_tokens_user_id_idx ON password_reset_tokens(user_id);

-- ─── Auth attempts: shared store for server-side rate limiting ────────────────
CREATE TABLE auth_attempts (
  id         BIGSERIAL PRIMARY KEY,
  kind       auth_attempt_kind NOT NULL,
  -- Lowercased email/account identifier when known.
  identifier TEXT,
  ip         TEXT,
  succeeded  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auth_attempts_lookup_idx ON auth_attempts(kind, identifier, created_at DESC);
CREATE INDEX auth_attempts_ip_idx     ON auth_attempts(kind, ip, created_at DESC);

-- ─── Domain: farmer and buyer profiles hang off users ─────────────────────────
CREATE TABLE farmers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT          NOT NULL,
  farm_name       TEXT          NOT NULL,
  phone           TEXT          NOT NULL DEFAULT '',
  province        TEXT          NOT NULL,
  district        TEXT          NOT NULL DEFAULT '',
  gps_lat         DOUBLE PRECISION,
  gps_lng         DOUBLE PRECISION,
  farm_size_ha    NUMERIC(10,2),
  profile_photo   TEXT,
  status          farmer_status NOT NULL DEFAULT 'PENDING',
  rating          NUMERIC(3,2)  NOT NULL DEFAULT 0,
  total_reviews   INTEGER       NOT NULL DEFAULT 0,
  total_sales     INTEGER       NOT NULL DEFAULT 0,
  ecocash_number  TEXT          NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE buyers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  phone          TEXT        NOT NULL DEFAULT '',
  buyer_type     buyer_type  NOT NULL DEFAULT 'INDIVIDUAL',
  city           TEXT        NOT NULL,
  address        TEXT,
  ecocash_number TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE listings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id        UUID           NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  title            TEXT           NOT NULL,
  description      TEXT,
  category         TEXT           NOT NULL,
  produce_type     TEXT           NOT NULL,
  quantity_kg      NUMERIC(12,2)  NOT NULL,
  quantity_unit    TEXT           NOT NULL DEFAULT 'kg',
  price_per_unit   NUMERIC(12,2)  NOT NULL CHECK (price_per_unit >= 0),
  currency         TEXT           NOT NULL DEFAULT 'USD',
  min_order_qty    NUMERIC(12,2)  NOT NULL DEFAULT 1,
  harvest_date     DATE,
  available_from   DATE           NOT NULL DEFAULT CURRENT_DATE,
  available_until  DATE,
  photos           TEXT[]         NOT NULL DEFAULT '{}',
  is_organic       BOOLEAN        NOT NULL DEFAULT FALSE,
  is_available     BOOLEAN        NOT NULL DEFAULT TRUE,
  province         TEXT           NOT NULL,
  district         TEXT           NOT NULL DEFAULT '',
  delivery_options TEXT[]         NOT NULL DEFAULT '{}',
  views_count      INTEGER        NOT NULL DEFAULT 0,
  status           listing_status NOT NULL DEFAULT 'ACTIVE',
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX listings_farmer_id_idx ON listings(farmer_id);
CREATE INDEX listings_status_idx    ON listings(status);

CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference        TEXT            NOT NULL UNIQUE,
  buyer_id         UUID            NOT NULL REFERENCES buyers(id) ON DELETE RESTRICT,
  farmer_id        UUID            NOT NULL REFERENCES farmers(id) ON DELETE RESTRICT,
  listing_id       UUID            NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  quantity         NUMERIC(12,2)   NOT NULL CHECK (quantity > 0),
  unit_price       NUMERIC(12,2)   NOT NULL CHECK (unit_price >= 0),
  total_amount     NUMERIC(12,2)   NOT NULL CHECK (total_amount >= 0),
  platform_fee     NUMERIC(12,2)   NOT NULL DEFAULT 0,
  farmer_payout    NUMERIC(12,2)   NOT NULL DEFAULT 0,
  currency         TEXT            NOT NULL DEFAULT 'USD',
  delivery_method  delivery_method NOT NULL DEFAULT 'PICKUP',
  delivery_address TEXT,
  delivery_date    DATE,
  status           order_status    NOT NULL DEFAULT 'PENDING',
  payment_status   payment_status  NOT NULL DEFAULT 'UNPAID',
  buyer_confirmed  BOOLEAN         NOT NULL DEFAULT FALSE,
  notes            TEXT,
  created_at       TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ     NOT NULL DEFAULT now()
);
CREATE INDEX orders_buyer_id_idx  ON orders(buyer_id);
CREATE INDEX orders_farmer_id_idx ON orders(farmer_id);

CREATE TABLE disputes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID           NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  raised_by    dispute_party  NOT NULL,
  reason       TEXT           NOT NULL,
  description  TEXT           NOT NULL DEFAULT '',
  status       dispute_status NOT NULL DEFAULT 'OPEN',
  resolution   TEXT,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX disputes_order_id_idx ON disputes(order_id);

CREATE TABLE reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID        NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  farmer_id  UUID        NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  buyer_id   UUID        NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  rating     INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reviews_farmer_id_idx ON reviews(farmer_id);

CREATE TABLE price_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produce_type   TEXT          NOT NULL,
  category       TEXT          NOT NULL,
  province       TEXT          NOT NULL,
  avg_price      NUMERIC(12,2) NOT NULL,
  min_price      NUMERIC(12,2) NOT NULL,
  max_price      NUMERIC(12,2) NOT NULL,
  listings_count INTEGER       NOT NULL DEFAULT 0,
  recorded_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX price_history_lookup_idx ON price_history(produce_type, province, recorded_at DESC);
