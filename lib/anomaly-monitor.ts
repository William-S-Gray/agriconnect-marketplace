import 'server-only';
import { headers } from 'next/headers';
import { sql } from './db';
import {
  checkImpossibleTravel,
  checkCountryHop,
  checkDataVolume,
  checkPrivilegeEscalation,
  actionFor,
  isValidGeoPoint,
  type Anomaly,
  type AnomalyAction,
  type GeoPoint,
  type Sighting,
} from './anomaly';

/**
 * Session anomaly detection: the plumbing.
 *
 * Observations come from the request, decisions come from lib/anomaly.ts, and
 * this module joins the two and applies the outcome.
 *
 * Detection runs inline on the request being judged, which is what makes it
 * real time rather than a nightly report — but it must never be the reason a
 * request fails. Every entry point here swallows its own errors: a monitoring
 * subsystem that can 500 the application is a bigger availability risk than the
 * anomalies it watches for.
 *
 * Swallowed errors are logged in development, because silence hides a broken
 * detector perfectly — a malformed query here once turned volume detection off
 * entirely and looked exactly like "no anomalies".
 */

function swallow(where: string, error: unknown): null {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[anomaly] ${where} failed:`, error);
  }
  return null;
}

const ESCALATION_WINDOW_MINUTES = 15;
const VOLUME_WINDOW_MINUTES = 60;
const BASELINE_DAYS = 14;
/** How long an unacknowledged event absorbs repeats of the same anomaly. */
const DEDUPE_WINDOW_MINUTES = 60;

// ─── Where the request came from ──────────────────────────────────────────────

/**
 * Which edge, if any, is trusted to have set the geo headers.
 *
 * Geo arrives as request headers, and a header is only evidence if something
 * upstream guarantees the client did not write it. Vercel and Cloudflare both
 * overwrite their own headers at the edge, so behind either they are
 * trustworthy — behind anything else, or nothing, a caller can simply state
 * where it is.
 *
 * That matters more for evasion than for mischief: someone holding a stolen
 * cookie who can name their own location can pin it to the victim's last known
 * position and walk straight past the travel detector. Trusting these headers
 * by default would not be a weak control, it would be an off switch that
 * reports itself as on.
 *
 * So it is opt-in. Unset, geo is ignored, travel detection stays inert, and
 * /admin/security says so rather than implying coverage that is not there.
 */
export type TrustedProxy = 'vercel' | 'cloudflare' | null;

export function trustedProxy(): TrustedProxy {
  const configured = process.env.ANOMALY_TRUSTED_PROXY?.trim().toLowerCase();
  if (configured === 'vercel' || configured === 'cloudflare') return configured;
  return null;
}

const GEO_HEADERS = {
  vercel: {
    latitude: 'x-vercel-ip-latitude',
    longitude: 'x-vercel-ip-longitude',
    country: 'x-vercel-ip-country',
  },
  cloudflare: {
    latitude: 'cf-iplatitude',
    longitude: 'cf-iplongitude',
    country: 'cf-ipcountry',
  },
} as const;

/**
 * Position reported by the trusted edge.
 *
 * Only the configured platform's headers are read: honouring Cloudflare's
 * headers while deployed on Vercel would let a client supply the set the
 * platform does not overwrite.
 *
 * `country` can be present when coordinates are not, which is why it is
 * returned separately — the country-only detector still works in that case.
 */
export function geoFromHeaders(h: Headers): GeoPoint | null {
  const proxy = trustedProxy();
  if (!proxy) return null;

  const names = GEO_HEADERS[proxy];
  const latitude = h.get(names.latitude);
  const longitude = h.get(names.longitude);
  const country = h.get(names.country);

  if (latitude === null || longitude === null) return null;

  const point: GeoPoint = {
    latitude: Number(latitude),
    longitude: Number(longitude),
    country,
  };
  return isValidGeoPoint(point) ? point : null;
}

/** The trusted edge's country, which often survives where coordinates do not. */
export function countryFromHeaders(h: Headers): string | null {
  const proxy = trustedProxy();
  if (!proxy) return null;
  return h.get(GEO_HEADERS[proxy].country);
}

function requestHeaders(): Headers | null {
  try {
    return headers();
  } catch {
    // Outside a request scope (a script, a background job).
    return null;
  }
}

/**
 * Client IP, from the same forwarded headers the rate limiter uses.
 *
 * Recorded for context only — nothing here makes a decision on it. It is worth
 * knowing that without a trusted proxy in front this is as forgeable as the geo
 * headers, so it is evidence about a request, not proof about an origin.
 */
function ipFrom(h: Headers): string | null {
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return h.get('x-real-ip') ?? null;
}

// ─── Recording ────────────────────────────────────────────────────────────────

interface EventInput {
  userId: string;
  sessionId: string | null;
  anomaly: Anomaly;
  ip: string | null;
  action: AnomalyAction;
}

/**
 * Records an anomaly, folding a repeat into the event already open for it.
 *
 * Without this, a session pulling data in a loop raises an event per request
 * and the admin view becomes hundreds of rows describing one incident. An
 * admin can only act on an incident, so the open event is refreshed with the
 * latest evidence and its counter incremented instead.
 *
 * Acknowledging closes the event, so a recurrence afterwards correctly raises a
 * new one rather than silently reopening a reviewed incident.
 */
async function persist(event: EventInput): Promise<void> {
  const detail = JSON.stringify({
    summary: event.anomaly.summary,
    ...event.anomaly.detail,
  });

  const refreshed = await sql<{ id: string }>`
    UPDATE security_events
       SET detail       = ${detail}::jsonb,
           severity     = ${event.anomaly.severity}::anomaly_severity,
           ip           = ${event.ip},
           action_taken = ${event.action},
           occurrences  = occurrences + 1,
           last_seen_at = now()
     WHERE id = (
       SELECT id FROM security_events
        WHERE user_id = ${event.userId}
          AND kind    = ${event.anomaly.kind}::anomaly_kind
          AND acknowledged_at IS NULL
          AND created_at > now() - (${DEDUPE_WINDOW_MINUTES} || ' minutes')::interval
        ORDER BY created_at DESC
        LIMIT 1
     )
     RETURNING id
  `;
  if (refreshed.length > 0) return;

  await sql`
    INSERT INTO security_events
      (user_id, session_id, kind, severity, detail, ip, action_taken)
    VALUES (
      ${event.userId},
      ${event.sessionId},
      ${event.anomaly.kind}::anomaly_kind,
      ${event.anomaly.severity}::anomaly_severity,
      ${detail}::jsonb,
      ${event.ip},
      ${event.action}
    )
  `;
}

/** Applies the policy from lib/anomaly.ts. */
async function enforce(
  action: AnomalyAction,
  sessionId: string | null,
): Promise<void> {
  if (!sessionId || action === 'record_only') return;

  if (action === 'revoke_session') {
    await sql`
      UPDATE sessions SET revoked_at = now()
       WHERE id = ${sessionId} AND revoked_at IS NULL
    `;
    return;
  }

  // require_reauth has to mean re-authentication for every account, not just
  // the ones with MFA.
  //
  // Clearing mfa_satisfied alone is a no-op when mfa_enabled is false, because
  // requireUser() only consults the flag for accounts that enabled MFA — so on
  // most accounts the "action" would have changed nothing at all. Where there
  // is a second factor, the session survives and is re-challenged, which keeps
  // an unfinished cart or form intact. Where there is not, the only available
  // re-authentication is a fresh login, so the session ends.
  await sql`
    UPDATE sessions s
       SET mfa_satisfied = FALSE,
           revoked_at = CASE
                          WHEN u.mfa_enabled THEN s.revoked_at
                          ELSE COALESCE(s.revoked_at, now())
                        END
      FROM users u
     WHERE s.id = ${sessionId} AND u.id = s.user_id
  `;
}

async function report(
  userId: string,
  sessionId: string | null,
  anomaly: Anomaly,
  ip: string | null,
): Promise<AnomalyAction> {
  const action = actionFor(anomaly);
  await persist({ userId, sessionId, anomaly, ip, action });
  await enforce(action, sessionId);
  return action;
}

// ─── Impossible travel ────────────────────────────────────────────────────────

export interface LastSighting {
  ip: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  at: Date | null;
}

/**
 * Compares where this session was last seen with where it is now.
 *
 * Called from getSession() with the row it has already read, so the common case
 * — a user who has not moved — costs no extra query. A write happens only when
 * the position actually changes.
 *
 * Returns the action taken, for tests and callers that care.
 */
export async function observeSessionLocation(
  userId: string,
  sessionId: string,
  previous: LastSighting,
): Promise<AnomalyAction | null> {
  try {
    const h = requestHeaders();
    if (!h) return null;

    const ip = ipFrom(h);
    const point = geoFromHeaders(h);
    const now = new Date();

    // No coordinates. Country alone still supports the weaker detector, and is
    // the header most likely to survive a proxy that drops the rest.
    if (!point) {
      const country = countryFromHeaders(h);

      const anomaly =
        country && previous.at
          ? checkCountryHop(
              { country: previous.country, at: new Date(previous.at) },
              { country, at: now },
            )
          : null;

      const moved = (ip && ip !== previous.ip) || (country && country !== previous.country);
      if (moved) {
        await sql`
          UPDATE sessions
             SET last_ip = ${ip},
                 last_country = ${country ?? previous.country},
                 last_geo_at = CASE WHEN ${country}::text IS NULL
                                    THEN last_geo_at ELSE now() END
           WHERE id = ${sessionId}
        `;
      }

      if (!anomaly) return null;
      return await report(userId, sessionId, anomaly, ip);
    }

    const unchanged =
      previous.latitude === point.latitude &&
      previous.longitude === point.longitude &&
      previous.ip === ip;
    if (unchanged) return null;

    const priorSighting: Sighting | null =
      previous.at !== null &&
      previous.latitude !== null &&
      previous.longitude !== null
        ? {
            at: new Date(previous.at),
            point: {
              latitude: previous.latitude,
              longitude: previous.longitude,
              country: previous.country,
            },
          }
        : null;

    const anomaly = checkImpossibleTravel(priorSighting, { point, at: now });

    await sql`
      UPDATE sessions
         SET last_ip = ${ip},
             last_country = ${point.country},
             last_latitude = ${point.latitude},
             last_longitude = ${point.longitude},
             last_geo_at = now()
       WHERE id = ${sessionId}
    `;

    if (!anomaly) return null;
    return await report(userId, sessionId, anomaly, ip);
  } catch (error) {
    // Monitoring must not break the request it is monitoring.
    return swallow('observeSessionLocation', error);
  }
}

// ─── Data access volume ───────────────────────────────────────────────────────

/**
 * Records a bulk read and judges it against the user's own history.
 *
 * Call from endpoints that return many rows, passing the number actually
 * returned. Single-record reads are not worth the write.
 */
export async function observeDataAccess(
  userId: string,
  sessionId: string | null,
  resource: string,
  records: number,
): Promise<AnomalyAction | null> {
  try {
    if (records <= 0) return null;

    await sql`
      INSERT INTO access_log (user_id, session_id, resource, records)
      VALUES (${userId}, ${sessionId}, ${resource}, ${records})
    `;

    // Both sums come back raw and the rate is worked out in TypeScript. Doing
    // the division in SQL needs a literal divisor, and a literal next to an
    // interpolation in this tagged template becomes part of a bound parameter
    // rather than part of the statement.
    const rows = await sql<{ in_window: string; before_window: string }>`
      SELECT
        COALESCE(SUM(records) FILTER (
          WHERE created_at > now() - (${VOLUME_WINDOW_MINUTES} || ' minutes')::interval
        ), 0) AS in_window,
        -- Excludes the window being judged, so a spike cannot inflate the
        -- baseline it is about to be measured against.
        COALESCE(SUM(records) FILTER (
          WHERE created_at <= now() - (${VOLUME_WINDOW_MINUTES} || ' minutes')::interval
        ), 0) AS before_window
      FROM access_log
      WHERE user_id = ${userId}
        AND resource = ${resource}
        AND created_at > now() - (${BASELINE_DAYS} || ' days')::interval
    `;

    const stats = rows[0];
    if (!stats) return null;

    const anomaly = checkDataVolume({
      resource,
      recordsInWindow: Number(stats.in_window),
      baselinePerHour: Number(stats.before_window) / (BASELINE_DAYS * 24),
      windowMinutes: VOLUME_WINDOW_MINUTES,
    });
    if (!anomaly) return null;

    const h = requestHeaders();
    return await report(userId, sessionId, anomaly, h ? ipFrom(h) : null);
  } catch (error) {
    return swallow('observeDataAccess', error);
  }
}

// ─── Privilege escalation ─────────────────────────────────────────────────────

/**
 * Records an authorization denial and judges the run of them.
 *
 * Called from the 403 path in lib/rbac.ts, so every denial the application
 * issues is counted without each endpoint having to remember to do it.
 */
export async function observeDenial(
  userId: string,
  sessionId: string | null,
): Promise<AnomalyAction | null> {
  try {
    await sql`
      INSERT INTO access_log (user_id, session_id, resource, records)
      VALUES (${userId}, ${sessionId}, 'denied', 1)
    `;

    const rows = await sql<{ n: string }>`
      SELECT COALESCE(SUM(records), 0) AS n
        FROM access_log
       WHERE user_id = ${userId}
         AND resource = 'denied'
         AND created_at > now() - (${ESCALATION_WINDOW_MINUTES} || ' minutes')::interval
    `;

    const anomaly = checkPrivilegeEscalation({
      deniedRequests: Number(rows[0]?.n ?? 0),
      strippedFields: [],
      windowMinutes: ESCALATION_WINDOW_MINUTES,
    });
    if (!anomaly) return null;

    const h = requestHeaders();
    return await report(userId, sessionId, anomaly, h ? ipFrom(h) : null);
  } catch (error) {
    return swallow('observeDenial', error);
  }
}

/**
 * Records an attempt to set fields a client may never set.
 *
 * Only the field names are stored. The values are attacker-controlled input and
 * one of the fields is password_hash, so recording them would put exactly the
 * wrong thing in the audit trail.
 */
export async function observePrivilegedFields(
  userId: string,
  sessionId: string | null,
  strippedFields: string[],
): Promise<AnomalyAction | null> {
  try {
    if (strippedFields.length === 0) return null;

    const anomaly = checkPrivilegeEscalation({
      deniedRequests: 0,
      strippedFields,
      windowMinutes: ESCALATION_WINDOW_MINUTES,
    });
    if (!anomaly) return null;

    const h = requestHeaders();
    return await report(userId, sessionId, anomaly, h ? ipFrom(h) : null);
  } catch (error) {
    return swallow('observePrivilegedFields', error);
  }
}
