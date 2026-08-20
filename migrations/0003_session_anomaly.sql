-- Session anomaly detection: impossible travel, unusual data access volume,
-- and privilege escalation attempts.
--
-- Where a session was last seen. These live on sessions rather than in a
-- separate table so the existing per-request session lookup can compare the
-- previous position with the current one without a second query.
ALTER TABLE sessions ADD COLUMN last_ip        TEXT
;
ALTER TABLE sessions ADD COLUMN last_country   TEXT
;
ALTER TABLE sessions ADD COLUMN last_latitude  DOUBLE PRECISION
;
ALTER TABLE sessions ADD COLUMN last_longitude DOUBLE PRECISION
;
ALTER TABLE sessions ADD COLUMN last_geo_at    TIMESTAMPTZ
;

CREATE TYPE anomaly_kind AS ENUM (
  'impossible_travel',
  'data_volume',
  'privilege_escalation'
)
;

-- low    - recorded for context, no action
-- medium - recorded and surfaced to admins
-- high   - recorded, surfaced, and acted on (see lib/anomaly-monitor.ts)
CREATE TYPE anomaly_severity AS ENUM ('low', 'medium', 'high')
;

CREATE TABLE security_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  -- Kept when the session is later revoked, so the record outlives the session.
  session_id      UUID REFERENCES sessions(id) ON DELETE SET NULL,
  kind            anomaly_kind     NOT NULL,
  severity        anomaly_severity NOT NULL,
  -- Evidence: distances, speeds, counts. Never request bodies or secrets.
  detail          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  ip              TEXT,
  -- How many times this anomaly re-fired before it was acknowledged. A repeat
  -- refreshes the open event rather than adding another, so a session pulling
  -- data in a loop produces one row an admin can act on, not hundreds.
  occurrences     INTEGER     NOT NULL DEFAULT 1,
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- What the system did about it, for audit.
  action_taken    TEXT,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
)
;
CREATE INDEX security_events_recent_idx ON security_events(created_at DESC)
;
CREATE INDEX security_events_user_idx   ON security_events(user_id, created_at DESC)
;
CREATE INDEX security_events_open_idx
  ON security_events(severity, created_at DESC)
  WHERE acknowledged_at IS NULL
;

-- Rolling record of how much data each session pulled, for volume baselining.
-- Written only at bulk-read endpoints, not on every request.
CREATE TABLE access_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  -- Coarse resource name, e.g. 'admin_users'. Never an id or a query string.
  resource   TEXT    NOT NULL,
  records    INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
;
CREATE INDEX access_log_user_idx ON access_log(user_id, created_at DESC)
;
CREATE INDEX access_log_baseline_idx ON access_log(user_id, resource, created_at DESC)
;
