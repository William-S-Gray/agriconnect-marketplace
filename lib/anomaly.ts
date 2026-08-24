/**
 * Session anomaly detection: the decision logic.
 *
 * Deliberately pure and free of `server-only` and of any database access, so
 * every threshold here is testable without a session, a request or a network.
 * lib/anomaly-monitor.ts supplies the observations and acts on the results.
 *
 * The guiding constraint is that a false positive costs a real user their
 * session. Every detector here therefore requires corroboration — a floor as
 * well as a ratio, a distance as well as a speed — rather than firing on a
 * single suspicious number.
 */

export type AnomalyKind =
  | 'impossible_travel'
  | 'data_volume'
  | 'privilege_escalation';

export type AnomalySeverity = 'low' | 'medium' | 'high';

export interface Anomaly {
  kind: AnomalyKind;
  severity: AnomalySeverity;
  /** Human-readable, safe to show an admin. Never contains request contents. */
  summary: string;
  /** Evidence for the admin view. Numbers and coarse labels only. */
  detail: Record<string, number | string | boolean | null>;
}

// ─── Impossible travel ────────────────────────────────────────────────────────

export interface GeoPoint {
  latitude: number;
  longitude: number;
  country: string | null;
}

export interface Sighting {
  point: GeoPoint;
  at: Date;
}

/**
 * Faster than a commercial airliner (~900 km/h) with margin for GeoIP error at
 * the endpoints. Below this, "impossible" is not a claim worth making.
 */
export const IMPOSSIBLE_SPEED_KMH = 1000;

/**
 * GeoIP puts an address somewhere in a city, and the city it picks can move by
 * tens of kilometres between lookups of the same address. Movement under this
 * distance is treated as noise no matter how fast it implies, which is what
 * stops a stationary user on a flaky mobile network from tripping the detector.
 */
export const MIN_TRAVEL_DISTANCE_KM = 500;

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isValidGeoPoint(point: {
  latitude: number | null;
  longitude: number | null;
}): boolean {
  const { latitude, longitude } = point;
  if (latitude === null || longitude === null) return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return false;
  // 0,0 is in the Atlantic and is what a missing lookup usually reports.
  if (latitude === 0 && longitude === 0) return false;
  return true;
}

/**
 * Flags a session that appears to have moved further than physically possible
 * between two requests.
 *
 * Returns null when it cannot tell — no previous sighting, missing or absurd
 * coordinates, clocks out of order. Silence is the correct answer for an
 * unmeasurable case; a detector that guesses here would fire on every user
 * whose proxy omits geo headers.
 */
export function checkImpossibleTravel(
  previous: Sighting | null,
  current: Sighting,
): Anomaly | null {
  if (!previous) return null;
  if (!isValidGeoPoint(previous.point) || !isValidGeoPoint(current.point)) {
    return null;
  }

  const elapsedSeconds = (current.at.getTime() - previous.at.getTime()) / 1000;
  // A non-advancing clock means the two sightings cannot be ordered, so no
  // direction of travel can be inferred.
  if (elapsedSeconds <= 0) return null;

  const distanceKm = haversineKm(previous.point, current.point);
  if (distanceKm < MIN_TRAVEL_DISTANCE_KM) return null;

  const speedKmh = distanceKm / (elapsedSeconds / 3600);
  if (speedKmh <= IMPOSSIBLE_SPEED_KMH) return null;

  const crossedBorder =
    previous.point.country !== null &&
    current.point.country !== null &&
    previous.point.country !== current.point.country;

  return {
    kind: 'impossible_travel',
    // A country change is corroboration; movement within one country is more
    // likely to be a carrier routing change than a genuine relocation.
    severity: crossedBorder ? 'high' : 'medium',
    summary: crossedBorder
      ? `Session moved ${Math.round(distanceKm)} km between countries in ${Math.round(elapsedSeconds)}s`
      : `Session moved ${Math.round(distanceKm)} km in ${Math.round(elapsedSeconds)}s`,
    detail: {
      distanceKm: Math.round(distanceKm),
      elapsedSeconds: Math.round(elapsedSeconds),
      impliedSpeedKmh: Math.round(speedKmh),
      fromCountry: previous.point.country,
      toCountry: current.point.country,
      crossedBorder,
    },
  };
}

/**
 * A country change with no coordinates to go with it.
 *
 * Country is the geo header most likely to survive a proxy, so this keeps the
 * travel detector useful where latitude and longitude are missing. It is
 * genuinely weaker evidence — a border town or a VPN exit node flips country
 * without anyone travelling — so it never rises above medium, and therefore
 * never costs anyone their session.
 */
/** Readable elapsed time for an admin, rather than "0 minutes". */
function describeElapsed(seconds: number): string {
  const whole = Math.round(seconds);
  if (whole < 60) return `${whole}s`;
  const minutes = Math.round(whole / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export const COUNTRY_HOP_WINDOW_MINUTES = 60;

export function checkCountryHop(
  previous: { country: string | null; at: Date } | null,
  current: { country: string | null; at: Date },
): Anomaly | null {
  if (!previous) return null;
  if (!previous.country || !current.country) return null;
  if (previous.country === current.country) return null;

  const elapsedSeconds = (current.at.getTime() - previous.at.getTime()) / 1000;
  if (elapsedSeconds <= 0) return null;
  if (elapsedSeconds > COUNTRY_HOP_WINDOW_MINUTES * 60) return null;

  return {
    kind: 'impossible_travel',
    severity: 'medium',
    summary: `Session moved from ${previous.country} to ${current.country} in ${describeElapsed(elapsedSeconds)}`,
    detail: {
      fromCountry: previous.country,
      toCountry: current.country,
      elapsedSeconds: Math.round(elapsedSeconds),
      // No coordinates were available, so no distance or speed was measured.
      trigger: 'country_only',
    },
  };
}

// ─── Unusual data access volume ───────────────────────────────────────────────

export interface VolumeObservation {
  resource: string;
  /** Records this session has read in the current window. */
  recordsInWindow: number;
  /** The same user's typical hourly volume for this resource. */
  baselinePerHour: number;
  windowMinutes: number;
}

/**
 * Below this, volume is not interesting however far above baseline it sits.
 * Without it, a user whose baseline is 2 records trips the ratio by reading 20.
 */
export const VOLUME_ABSOLUTE_FLOOR = 200;

/** How many times the user's own baseline counts as a spike. */
export const VOLUME_SPIKE_MULTIPLE = 10;

/** Volume that is alarming regardless of any baseline. */
export const VOLUME_HARD_CEILING = 5000;

/**
 * Flags bulk extraction: a session reading far more than that user normally
 * does, or more than anyone plausibly needs.
 *
 * Both a floor and a ratio must be exceeded, because each alone is wrong. The
 * ratio alone fires on any light user having a busy afternoon; the floor alone
 * fires on the admin whose job is reading the user list.
 */
export function checkDataVolume(observation: VolumeObservation): Anomaly | null {
  const { recordsInWindow, baselinePerHour, resource, windowMinutes } = observation;

  if (recordsInWindow >= VOLUME_HARD_CEILING) {
    return {
      kind: 'data_volume',
      severity: 'high',
      summary: `${recordsInWindow} ${resource} records read in ${windowMinutes} minutes`,
      detail: {
        resource, recordsInWindow, windowMinutes,
        baselinePerHour: Math.round(baselinePerHour),
        trigger: 'hard_ceiling',
      },
    };
  }

  if (recordsInWindow < VOLUME_ABSOLUTE_FLOOR) return null;

  // A user with no history has no baseline to exceed; the floor above is the
  // only judgement available, and it has already been passed.
  const scaledBaseline = baselinePerHour * (windowMinutes / 60);
  if (scaledBaseline <= 0) {
    return {
      kind: 'data_volume',
      severity: 'medium',
      summary: `${recordsInWindow} ${resource} records read by a session with no prior history`,
      detail: {
        resource, recordsInWindow, windowMinutes,
        baselinePerHour: 0, trigger: 'no_baseline',
      },
    };
  }

  const multiple = recordsInWindow / scaledBaseline;
  if (multiple < VOLUME_SPIKE_MULTIPLE) return null;

  return {
    kind: 'data_volume',
    severity: 'medium',
    summary: `${resource} reads ran ${Math.round(multiple)}× the usual rate for this account`,
    detail: {
      resource, recordsInWindow, windowMinutes,
      baselinePerHour: Math.round(baselinePerHour),
      multipleOfBaseline: Math.round(multiple),
      trigger: 'baseline_multiple',
    },
  };
}

// ─── Privilege escalation attempts ────────────────────────────────────────────

export interface EscalationObservation {
  /** Authorization denials for this session in the window. */
  deniedRequests: number;
  /** Privileged fields stripped from request bodies, e.g. role, status. */
  strippedFields: string[];
  windowMinutes: number;
}

/** One 403 is a mistake or a stale tab. A run of them is probing. */
export const ESCALATION_DENIAL_THRESHOLD = 5;

/**
 * Flags a session probing for privileges it does not have.
 *
 * Any attempt to set a privileged field is treated as high severity on its own:
 * unlike a 403, which an honest client reaches by accident, `role` in a request
 * body has no innocent explanation — no part of this application's UI ever
 * sends one.
 */
export function checkPrivilegeEscalation(
  observation: EscalationObservation,
): Anomaly | null {
  const { deniedRequests, strippedFields, windowMinutes } = observation;

  if (strippedFields.length > 0) {
    const unique = [...new Set(strippedFields)].sort();
    return {
      kind: 'privilege_escalation',
      severity: 'high',
      summary: `Request tried to set privileged field(s): ${unique.join(', ')}`,
      detail: {
        // Field names only. The values are never recorded — they are attacker
        // input, and one of the fields is password_hash.
        fields: unique.join(','),
        deniedRequests,
        windowMinutes,
        trigger: 'privileged_field',
      },
    };
  }

  if (deniedRequests < ESCALATION_DENIAL_THRESHOLD) return null;

  return {
    kind: 'privilege_escalation',
    severity: 'medium',
    summary: `${deniedRequests} authorization denials in ${windowMinutes} minutes`,
    detail: {
      deniedRequests, windowMinutes, trigger: 'repeated_denials',
    },
  };
}

// ─── Response policy ──────────────────────────────────────────────────────────

export type AnomalyAction =
  | 'record_only'
  | 'require_reauth'
  | 'revoke_session';

/**
 * What to do about a detection.
 *
 * The asymmetry is deliberate. A privilege escalation attempt comes from the
 * attacker's own session, so ending it costs them and nobody else. Impossible
 * travel is a claim about a *legitimate* user's session — it is the case most
 * likely to be a GeoIP artefact, so it forces re-authentication rather than
 * destroying the session, and only when the evidence crossed a border.
 */
export function actionFor(anomaly: Anomaly): AnomalyAction {
  if (anomaly.kind === 'privilege_escalation' && anomaly.severity === 'high') {
    return 'revoke_session';
  }
  if (anomaly.severity === 'high') return 'require_reauth';
  return 'record_only';
}
