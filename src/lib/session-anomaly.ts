/**
 * Session anomaly detection.
 *
 * Watches an authenticated session in real time for three signals:
 *   1. PRIVILEGE_ESCALATION — the persisted session was altered (e.g. role
 *      hand-edited to "admin" in devtools) or a role changed without a login.
 *   2. IMPOSSIBLE_TRAVEL    — the session's apparent location changed in a way
 *      a real user could not have travelled.
 *   3. DATA_VOLUME          — an unusual number of sensitive records read
 *      inside a short window (bulk scraping / exfiltration shape).
 *
 * SCOPE — read this before trusting it:
 * This runs in the browser, so it is a *detection aid*, not a security control.
 * A determined attacker can skip the checks entirely by not running this code,
 * and the checksum salt below ships in the bundle, so a valid fingerprint can
 * be recomputed by hand. What this does buy:
 *   - it catches casual devtools tampering with the persisted session, which is
 *     the exact weakness in storing auth state in localStorage;
 *   - it gives the UI something to react to immediately;
 *   - the detectors are shaped so the same call sites keep working once a real
 *     backend owns authorization (see resolveLocation below).
 * Real enforcement still requires server-side authorization.
 */

export type AnomalyKind = 'PRIVILEGE_ESCALATION' | 'IMPOSSIBLE_TRAVEL' | 'DATA_VOLUME';
export type AnomalySeverity = 'critical' | 'warning';

export interface Anomaly {
  kind: AnomalyKind;
  severity: AnomalySeverity;
  message: string;
  detail?: string;
  at: number;
}

export interface SessionFingerprint {
  id: string;
  role: string;
  userId: string;
  issuedAt: number;
  /** Coarse location signal captured when the session was issued. */
  location: string;
  /** Integrity checksum over the fields above. */
  checksum: string;
}

// ─── Tunables ────────────────────────────────────────────────────────────────

/** Sensitive reads allowed inside DATA_VOLUME_WINDOW_MS before flagging. */
export const DATA_VOLUME_THRESHOLD = 150;
export const DATA_VOLUME_WINDOW_MS = 60_000;

/**
 * Minimum minutes between two location signals for the change to be plausible.
 * A different timezone seen within this window is treated as impossible travel.
 */
export const MIN_PLAUSIBLE_TRAVEL_MINUTES = 90;

// Not a secret — it ships in the bundle. It only raises the effort needed to
// forge a fingerprint above "edit the JSON in devtools".
const CHECKSUM_SALT = 'agriconnect-session-v1';

// ─── Integrity checksum ──────────────────────────────────────────────────────

/**
 * FNV-1a. Deliberately a checksum, not a MAC: it detects hand-edited session
 * state, and cannot be a security boundary in client-side code regardless of
 * which algorithm is used.
 */
function checksum(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function fingerprintPayload(f: Omit<SessionFingerprint, 'checksum'>): string {
  return [CHECKSUM_SALT, f.id, f.role, f.userId, f.issuedAt, f.location].join('|');
}

// ─── Location signal ─────────────────────────────────────────────────────────

/**
 * Coarse location signal. The browser cannot see its own IP geolocation, so
 * this uses the IANA timezone as a proxy — it changes when a user moves between
 * regions or routes through a VPN, which is the signal we want, but it is a
 * proxy and not a true geo-IP lookup.
 *
 * Swap this for a server-supplied geo-IP value when a backend exists; the
 * detector logic below does not need to change.
 */
export function resolveLocation(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
  } catch {
    return 'unknown';
  }
}

// ─── Subscribers (the "real time" part) ──────────────────────────────────────

type Listener = (anomaly: Anomaly) => void;
const listeners = new Set<Listener>();
const log: Anomaly[] = [];
const MAX_LOG = 50;

/** Subscribe to anomalies as they are detected. Returns an unsubscribe fn. */
export function subscribeToAnomalies(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAnomalyLog(): readonly Anomaly[] {
  return log;
}

function emit(
  kind: AnomalyKind,
  severity: AnomalySeverity,
  message: string,
  detail?: string,
): Anomaly {
  const anomaly: Anomaly = { kind, severity, message, detail, at: Date.now() };
  log.push(anomaly);
  if (log.length > MAX_LOG) log.shift();
  listeners.forEach((l) => l(anomaly));
  return anomaly;
}

// ─── Session lifecycle ───────────────────────────────────────────────────────

/** Roles ordered by privilege, used to tell elevation from a plain role change. */
const PRIVILEGE_RANK: Record<string, number> = { buyer: 1, farmer: 1, admin: 3 };

function rankOf(role: string): number {
  return PRIVILEGE_RANK[role] ?? 0;
}

/** Issues a fingerprint for a session that just authenticated legitimately. */
export function startSession(role: string, userId: string): SessionFingerprint {
  const base = {
    id: crypto.randomUUID(),
    role,
    userId,
    issuedAt: Date.now(),
    location: resolveLocation(),
  };
  return { ...base, checksum: checksum(fingerprintPayload(base)) };
}

/**
 * Validates a persisted session against its fingerprint and the current
 * environment. Returns every anomaly found, most severe first.
 *
 * `persistedRole` is the role the restored store claims to hold; comparing it
 * against the signed fingerprint is what catches an edited role.
 */
export function verifySession(
  fingerprint: SessionFingerprint | null | undefined,
  persistedRole: string | null,
): Anomaly[] {
  const found: Anomaly[] = [];

  // An authenticated store with no fingerprint means the session was not
  // issued by startSession — i.e. it was fabricated.
  if (!fingerprint) {
    if (persistedRole) {
      found.push(
        emit(
          'PRIVILEGE_ESCALATION',
          'critical',
          'Session could not be verified and was ended.',
          `Restored a "${persistedRole}" session with no issued fingerprint.`,
        ),
      );
    }
    return found;
  }

  const expected = checksum(fingerprintPayload({
    id: fingerprint.id,
    role: fingerprint.role,
    userId: fingerprint.userId,
    issuedAt: fingerprint.issuedAt,
    location: fingerprint.location,
  }));

  if (expected !== fingerprint.checksum) {
    found.push(
      emit(
        'PRIVILEGE_ESCALATION',
        'critical',
        'Session data was modified and the session was ended.',
        'Stored session failed its integrity check.',
      ),
    );
  } else if (persistedRole && persistedRole !== fingerprint.role) {
    // Checksum intact but the store's role disagrees with the signed role.
    const elevated = rankOf(persistedRole) > rankOf(fingerprint.role);
    found.push(
      emit(
        'PRIVILEGE_ESCALATION',
        'critical',
        elevated
          ? 'Privilege escalation attempt detected. Session ended.'
          : 'Session role mismatch detected. Session ended.',
        `Signed role "${fingerprint.role}" but store claimed "${persistedRole}".`,
      ),
    );
  }

  // Impossible travel: location changed too soon after the session was issued.
  const current = resolveLocation();
  if (
    current !== 'unknown' &&
    fingerprint.location !== 'unknown' &&
    current !== fingerprint.location
  ) {
    const minutes = (Date.now() - fingerprint.issuedAt) / 60_000;
    if (minutes < MIN_PLAUSIBLE_TRAVEL_MINUTES) {
      found.push(
        emit(
          'IMPOSSIBLE_TRAVEL',
          'critical',
          'Sign-in location changed unexpectedly. Please sign in again.',
          `${fingerprint.location} → ${current} after ${Math.round(minutes)} min.`,
        ),
      );
    } else {
      found.push(
        emit(
          'IMPOSSIBLE_TRAVEL',
          'warning',
          'Your sign-in location appears to have changed.',
          `${fingerprint.location} → ${current}.`,
        ),
      );
    }
  }

  return found.sort((a, b) => (a.severity === 'critical' ? -1 : 1));
}

/** True when an anomaly set warrants terminating the session immediately. */
export function requiresSessionTermination(anomalies: Anomaly[]): boolean {
  return anomalies.some((a) => a.severity === 'critical');
}

// ─── Data access volume ──────────────────────────────────────────────────────

let accessTimestamps: number[] = [];
let volumeFlaggedAt = 0;

/**
 * Records a read of `count` sensitive records. Returns an anomaly the first
 * time the window threshold is exceeded, then stays quiet for that window so a
 * single burst does not spam the UI.
 */
export function recordDataAccess(resource: string, count = 1): Anomaly | null {
  const now = Date.now();
  accessTimestamps = accessTimestamps.filter((t) => now - t < DATA_VOLUME_WINDOW_MS);
  for (let i = 0; i < count; i++) accessTimestamps.push(now);

  if (accessTimestamps.length <= DATA_VOLUME_THRESHOLD) return null;
  if (now - volumeFlaggedAt < DATA_VOLUME_WINDOW_MS) return null;

  volumeFlaggedAt = now;
  return emit(
    'DATA_VOLUME',
    'warning',
    'Unusual volume of record access detected on this session.',
    `${accessTimestamps.length} records from "${resource}" in under ${
      DATA_VOLUME_WINDOW_MS / 1000
    }s.`,
  );
}

/** Clears all per-session detector state. Call on logout. */
export function resetSessionAnomalyState(): void {
  accessTimestamps = [];
  volumeFlaggedAt = 0;
  log.length = 0;
}
