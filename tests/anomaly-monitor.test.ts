import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

/**
 * The monitor, against the real database.
 *
 * Two properties matter more than any individual detection here: that events
 * are actually persisted with the evidence an admin needs, and that a failure
 * inside monitoring never propagates into the request being monitored.
 */

// Geo headers are only read when an edge is declared trustworthy, so the
// suite declares one. The tests below cover the unset case explicitly.
process.env.ANOMALY_TRUSTED_PROXY = 'vercel';

let requestGeo: Record<string, string> = {};

vi.mock('next/headers', () => ({
  headers: () => new Headers({ 'x-forwarded-for': '203.0.113.7', ...requestGeo }),
  cookies: () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));

const {
  observeDenial,
  observePrivilegedFields,
  observeDataAccess,
  observeSessionLocation,
  geoFromHeaders,
  countryFromHeaders,
  trustedProxy,
} = await import('@/lib/anomaly-monitor');
const { sql, pool } = await import('@/lib/pool');
const { hashPassword } = await import('@/lib/password');
const { ESCALATION_DENIAL_THRESHOLD, VOLUME_HARD_CEILING } = await import('@/lib/anomaly');

const suffix = randomUUID().slice(0, 8);
const email = `anomaly-${suffix}@example.test`;

let userId: string;
let sessionId: string;

async function newSession(): Promise<string> {
  const [row] = await sql<{ id: string }>`
    INSERT INTO sessions (user_id, token_hash, expires_at, absolute_expires_at)
    VALUES (${userId}, ${`anomaly-${randomUUID()}`},
            now() + interval '1 hour', now() + interval '7 days')
    RETURNING id
  `;
  return row!.id;
}

async function events() {
  return sql<{ kind: string; severity: string; detail: Record<string, unknown>; action_taken: string }>`
    SELECT kind::text AS kind, severity::text AS severity, detail, action_taken
      FROM security_events WHERE user_id = ${userId}
     ORDER BY created_at
  `;
}

beforeAll(async () => {
  const [user] = await sql<{ id: string }>`
    INSERT INTO users (email, password_hash, role)
    VALUES (${email}, ${await hashPassword('anomaly test passphrase 7')}, 'buyer')
    RETURNING id
  `;
  userId = user!.id;
});

beforeEach(async () => {
  requestGeo = {};
  await sql`DELETE FROM security_events WHERE user_id = ${userId}`;
  await sql`DELETE FROM access_log WHERE user_id = ${userId}`;
  sessionId = await newSession();
});

afterAll(async () => {
  await sql`DELETE FROM users WHERE email = ${email}`;
  await pool.end();
});

describe('privilege escalation', () => {
  it('tolerates an isolated denial', async () => {
    await observeDenial(userId, sessionId);
    expect(await events()).toHaveLength(0);
  });

  it('raises an event once denials accumulate', async () => {
    for (let i = 0; i < ESCALATION_DENIAL_THRESHOLD; i++) {
      await observeDenial(userId, sessionId);
    }
    const raised = await events();
    expect(raised).toHaveLength(1);
    expect(raised[0]!.kind).toBe('privilege_escalation');
    expect(raised[0]!.detail.deniedRequests).toBe(ESCALATION_DENIAL_THRESHOLD);
  });

  it('revokes the session that tried to set a privileged field', async () => {
    const action = await observePrivilegedFields(userId, sessionId, ['role']);
    expect(action).toBe('revoke_session');

    const [session] = await sql<{ revoked_at: Date | null }>`
      SELECT revoked_at FROM sessions WHERE id = ${sessionId}
    `;
    expect(session!.revoked_at).not.toBeNull();
  });

  it('stores the field names but never their values', async () => {
    await observePrivilegedFields(userId, sessionId, ['role', 'password_hash']);
    const [event] = await events();
    expect(event!.detail.fields).toBe('password_hash,role');
    // The whole record must be free of anything resembling a credential.
    const serialized = JSON.stringify(event!.detail);
    expect(serialized).not.toContain('argon2');
    expect(serialized).not.toContain('admin');
  });

  it('does nothing when no privileged field was present', async () => {
    expect(await observePrivilegedFields(userId, sessionId, [])).toBeNull();
    expect(await events()).toHaveLength(0);
  });
});

describe('data access volume', () => {
  it('ignores an ordinary read', async () => {
    await observeDataAccess(userId, sessionId, 'admin_users', 12);
    expect(await events()).toHaveLength(0);
  });

  it('raises an event on a bulk extraction', async () => {
    await observeDataAccess(userId, sessionId, 'admin_users', VOLUME_HARD_CEILING);
    const raised = await events();
    expect(raised).toHaveLength(1);
    expect(raised[0]!.kind).toBe('data_volume');
    expect(raised[0]!.severity).toBe('high');
  });

  it('accumulates across requests within the window', async () => {
    // No single call is alarming; the total is.
    for (let i = 0; i < 5; i++) {
      await observeDataAccess(userId, sessionId, 'admin_users', 200);
    }
    const raised = await events();
    expect(raised.length).toBeGreaterThan(0);
    expect(raised[0]!.kind).toBe('data_volume');
  });

  it('counts resources separately', async () => {
    await observeDataAccess(userId, sessionId, 'admin_users', 150);
    await observeDataAccess(userId, sessionId, 'orders', 150);
    // Neither resource reached the floor on its own.
    expect(await events()).toHaveLength(0);
  });

  it('ignores an empty result set', async () => {
    expect(await observeDataAccess(userId, sessionId, 'admin_users', 0)).toBeNull();
    const rows = await sql`SELECT id FROM access_log WHERE user_id = ${userId}`;
    expect(rows).toHaveLength(0);
  });
});

describe('repeat anomalies fold into one open event', () => {
  it('counts repeats instead of raising a row per request', async () => {
    for (let i = 0; i < 6; i++) {
      await observeDataAccess(userId, sessionId, 'admin_users', VOLUME_HARD_CEILING);
    }

    const raised = await sql<{ occurrences: number; detail: Record<string, unknown> }>`
      SELECT occurrences, detail FROM security_events
       WHERE user_id = ${userId} AND kind = 'data_volume'
    `;
    // One incident, not six.
    expect(raised).toHaveLength(1);
    expect(raised[0]!.occurrences).toBe(6);
  });

  it('keeps the newest evidence on the open event', async () => {
    await observeDataAccess(userId, sessionId, 'admin_users', VOLUME_HARD_CEILING);
    await observeDataAccess(userId, sessionId, 'admin_users', VOLUME_HARD_CEILING);

    const [event] = await sql<{ detail: Record<string, unknown> }>`
      SELECT detail FROM security_events
       WHERE user_id = ${userId} AND kind = 'data_volume'
    `;
    // The running total, not the figure from the first request.
    expect(Number(event!.detail.recordsInWindow)).toBe(VOLUME_HARD_CEILING * 2);
  });

  it('raises a fresh event after the previous one is acknowledged', async () => {
    await observeDataAccess(userId, sessionId, 'admin_users', VOLUME_HARD_CEILING);
    await sql`
      UPDATE security_events SET acknowledged_at = now()
       WHERE user_id = ${userId} AND kind = 'data_volume'
    `;

    await observeDataAccess(userId, sessionId, 'admin_users', VOLUME_HARD_CEILING);

    const raised = await sql`
      SELECT id FROM security_events
       WHERE user_id = ${userId} AND kind = 'data_volume'
    `;
    // A reviewed incident is closed; a recurrence must be visible again.
    expect(raised).toHaveLength(2);
  });

  it('keeps different kinds of anomaly separate', async () => {
    await observeDataAccess(userId, sessionId, 'admin_users', VOLUME_HARD_CEILING);
    await observePrivilegedFields(userId, sessionId, ['role']);

    const raised = await events();
    expect(raised.map((e) => e.kind).sort()).toEqual([
      'data_volume', 'privilege_escalation',
    ]);
  });
});

describe('geo headers', () => {
  it('reads Vercel headers', () => {
    const point = geoFromHeaders(new Headers({
      'x-vercel-ip-latitude': '-17.8252',
      'x-vercel-ip-longitude': '31.0335',
      'x-vercel-ip-country': 'ZW',
    }));
    expect(point).toEqual({ latitude: -17.8252, longitude: 31.0335, country: 'ZW' });
  });

  it('reads Cloudflare headers when Cloudflare is the declared edge', () => {
    process.env.ANOMALY_TRUSTED_PROXY = 'cloudflare';
    try {
      const point = geoFromHeaders(new Headers({
        'cf-iplatitude': '51.5074',
        'cf-iplongitude': '-0.1278',
        'cf-ipcountry': 'GB',
      }));
      expect(point?.country).toBe('GB');
    } finally {
      process.env.ANOMALY_TRUSTED_PROXY = 'vercel';
    }
  });

  it('ignores another platform’s headers', () => {
    // Configured for Vercel, so Cloudflare's headers are just client input —
    // and they are the set Vercel does not overwrite.
    expect(geoFromHeaders(new Headers({
      'cf-iplatitude': '51.5074',
      'cf-iplongitude': '-0.1278',
      'cf-ipcountry': 'GB',
    }))).toBeNull();
  });

  it('ignores geo entirely when no edge is trusted', () => {
    delete process.env.ANOMALY_TRUSTED_PROXY;
    try {
      expect(trustedProxy()).toBeNull();
      expect(geoFromHeaders(new Headers({
        'x-vercel-ip-latitude': '51.5074',
        'x-vercel-ip-longitude': '-0.1278',
        'x-vercel-ip-country': 'GB',
      }))).toBeNull();
      expect(countryFromHeaders(new Headers({ 'x-vercel-ip-country': 'GB' }))).toBeNull();
    } finally {
      process.env.ANOMALY_TRUSTED_PROXY = 'vercel';
    }
  });

  it('rejects an unrecognised value rather than guessing', () => {
    process.env.ANOMALY_TRUSTED_PROXY = 'nginx';
    try {
      expect(trustedProxy()).toBeNull();
    } finally {
      process.env.ANOMALY_TRUSTED_PROXY = 'vercel';
    }
  });

  it('returns null when the platform sends no geo', () => {
    expect(geoFromHeaders(new Headers({ 'x-forwarded-for': '203.0.113.7' }))).toBeNull();
  });

  it('returns null for unusable coordinates', () => {
    expect(geoFromHeaders(new Headers({
      'x-vercel-ip-latitude': '0', 'x-vercel-ip-longitude': '0',
    }))).toBeNull();
    expect(geoFromHeaders(new Headers({
      'x-vercel-ip-latitude': 'not-a-number', 'x-vercel-ip-longitude': '31',
    }))).toBeNull();
  });
});

describe('impossible travel, end to end', () => {
  const harare = {
    'x-vercel-ip-latitude': '-17.8252',
    'x-vercel-ip-longitude': '31.0335',
    'x-vercel-ip-country': 'ZW',
  };
  const london = {
    'x-vercel-ip-latitude': '51.5074',
    'x-vercel-ip-longitude': '-0.1278',
    'x-vercel-ip-country': 'GB',
  };

  it('records the first sighting without raising anything', async () => {
    requestGeo = harare;
    expect(await observeSessionLocation(userId, sessionId, {
      ip: null, country: null, latitude: null, longitude: null, at: null,
    })).toBeNull();
    expect(await events()).toHaveLength(0);

    const [row] = await sql<{ last_country: string; last_latitude: number }>`
      SELECT last_country, last_latitude FROM sessions WHERE id = ${sessionId}
    `;
    expect(row!.last_country).toBe('ZW');
    expect(Number(row!.last_latitude)).toBeCloseTo(-17.8252, 3);
  });

  it('forces re-authentication on a jump between countries', async () => {
    requestGeo = london;
    const action = await observeSessionLocation(userId, sessionId, {
      ip: '203.0.113.1', country: 'ZW',
      latitude: -17.8252, longitude: 31.0335,
      at: new Date(Date.now() - 5 * 60 * 1000),
    });
    expect(action).toBe('require_reauth');

    const [session] = await sql<{ mfa_satisfied: boolean }>`
      SELECT mfa_satisfied FROM sessions WHERE id = ${sessionId}
    `;
    expect(session!.mfa_satisfied).toBe(false);
  });

  it('ends the session when the account has no second factor', async () => {
    // The account under test has MFA disabled, which is the common case.
    // Clearing mfa_satisfied would be ignored by requireUser(), so the only
    // real re-authentication available is a fresh login.
    requestGeo = london;
    const action = await observeSessionLocation(userId, sessionId, {
      ip: '203.0.113.1', country: 'ZW',
      latitude: -17.8252, longitude: 31.0335,
      at: new Date(Date.now() - 5 * 60 * 1000),
    });
    expect(action).toBe('require_reauth');

    const [session] = await sql<{ revoked_at: Date | null }>`
      SELECT revoked_at FROM sessions WHERE id = ${sessionId}
    `;
    expect(session!.revoked_at).not.toBeNull();
  });

  it('keeps an MFA-protected session alive and re-challenges it instead', async () => {
    // users_mfa_requires_secret: MFA cannot be enabled without a stored secret.
    await sql`
      UPDATE users SET mfa_enabled = TRUE, mfa_secret = 'test-encrypted-secret'
       WHERE id = ${userId}
    `;
    try {
      const mfaSession = await newSession();
      await sql`UPDATE sessions SET mfa_satisfied = TRUE WHERE id = ${mfaSession}`;

      requestGeo = london;
      const action = await observeSessionLocation(userId, mfaSession, {
        ip: '203.0.113.1', country: 'ZW',
        latitude: -17.8252, longitude: 31.0335,
        at: new Date(Date.now() - 5 * 60 * 1000),
      });
      expect(action).toBe('require_reauth');

      const [session] = await sql<{ mfa_satisfied: boolean; revoked_at: Date | null }>`
        SELECT mfa_satisfied, revoked_at FROM sessions WHERE id = ${mfaSession}
      `;
      // Re-challenged, but the work in progress survives.
      expect(session!.mfa_satisfied).toBe(false);
      expect(session!.revoked_at).toBeNull();
    } finally {
      await sql`
        UPDATE users SET mfa_enabled = FALSE, mfa_secret = NULL WHERE id = ${userId}
      `;
    }
  });

  it('says nothing when the platform sends no geo', async () => {
    requestGeo = {};
    const action = await observeSessionLocation(userId, sessionId, {
      ip: '198.51.100.9', country: 'ZW',
      latitude: -17.8252, longitude: 31.0335,
      at: new Date(Date.now() - 60 * 1000),
    });
    expect(action).toBeNull();
    expect(await events()).toHaveLength(0);
  });

  it('does not re-run detection for a session that has not moved', async () => {
    requestGeo = harare;
    await observeSessionLocation(userId, sessionId, {
      ip: '203.0.113.7', country: 'ZW',
      latitude: -17.8252, longitude: 31.0335,
      at: new Date(Date.now() - 60 * 1000),
    });
    expect(await events()).toHaveLength(0);
  });
});

describe('travel detection with country but no coordinates', () => {
  it('flags a country change and records it', async () => {
    requestGeo = { 'x-vercel-ip-country': 'GB' };
    const action = await observeSessionLocation(userId, sessionId, {
      ip: '203.0.113.1', country: 'ZW',
      latitude: null, longitude: null,
      at: new Date(Date.now() - 10 * 60 * 1000),
    });
    // Weaker evidence than coordinates, so recorded rather than acted on.
    expect(action).toBe('record_only');

    const [event] = await events();
    expect(event!.kind).toBe('impossible_travel');
    expect(event!.severity).toBe('medium');
    expect(event!.detail.trigger).toBe('country_only');
  });

  it('leaves the session usable', async () => {
    requestGeo = { 'x-vercel-ip-country': 'GB' };
    await observeSessionLocation(userId, sessionId, {
      ip: '203.0.113.1', country: 'ZW',
      latitude: null, longitude: null,
      at: new Date(Date.now() - 10 * 60 * 1000),
    });

    const [session] = await sql<{ revoked_at: Date | null }>`
      SELECT revoked_at FROM sessions WHERE id = ${sessionId}
    `;
    expect(session!.revoked_at).toBeNull();
  });

  it('records the country so the next request has something to compare', async () => {
    requestGeo = { 'x-vercel-ip-country': 'ZA' };
    await observeSessionLocation(userId, sessionId, {
      ip: null, country: null, latitude: null, longitude: null, at: null,
    });

    const [row] = await sql<{ last_country: string }>`
      SELECT last_country FROM sessions WHERE id = ${sessionId}
    `;
    expect(row!.last_country).toBe('ZA');
  });

  it('stays quiet when no edge is trusted, however the headers look', async () => {
    delete process.env.ANOMALY_TRUSTED_PROXY;
    try {
      requestGeo = {
        'x-vercel-ip-latitude': '51.5074',
        'x-vercel-ip-longitude': '-0.1278',
        'x-vercel-ip-country': 'GB',
      };
      const action = await observeSessionLocation(userId, sessionId, {
        ip: '203.0.113.1', country: 'ZW',
        latitude: -17.8252, longitude: 31.0335,
        at: new Date(Date.now() - 60 * 1000),
      });
      expect(action).toBeNull();
      expect(await events()).toHaveLength(0);
    } finally {
      process.env.ANOMALY_TRUSTED_PROXY = 'vercel';
    }
  });
});

describe('monitoring never breaks the request it is monitoring', () => {
  it('swallows a bad user id rather than throwing', async () => {
    const orphan = randomUUID();
    await expect(observeDenial(orphan, sessionId)).resolves.toBeNull();
    await expect(
      observeDataAccess(orphan, sessionId, 'admin_users', 10_000),
    ).resolves.toBeNull();
    await expect(
      observePrivilegedFields(orphan, sessionId, ['role']),
    ).resolves.toBeNull();
  });

  it('swallows a bad session id rather than throwing', async () => {
    await expect(
      observeSessionLocation(userId, randomUUID(), {
        ip: null, country: null, latitude: null, longitude: null, at: null,
      }),
    ).resolves.toBeNull();
  });
});
