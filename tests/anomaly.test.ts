import { describe, it, expect } from 'vitest';
import {
  haversineKm,
  isValidGeoPoint,
  checkImpossibleTravel,
  checkCountryHop,
  COUNTRY_HOP_WINDOW_MINUTES,
  checkDataVolume,
  checkPrivilegeEscalation,
  actionFor,
  IMPOSSIBLE_SPEED_KMH,
  MIN_TRAVEL_DISTANCE_KM,
  VOLUME_ABSOLUTE_FLOOR,
  VOLUME_HARD_CEILING,
  ESCALATION_DENIAL_THRESHOLD,
  type GeoPoint,
} from '@/lib/anomaly';

/**
 * The thresholds, tested in isolation.
 *
 * The bias under test throughout is that a false positive costs a real user
 * their session, so the detectors must stay silent on anything they cannot
 * actually substantiate.
 */

const HARARE: GeoPoint = { latitude: -17.8252, longitude: 31.0335, country: 'ZW' };
const BULAWAYO: GeoPoint = { latitude: -20.1325, longitude: 28.6265, country: 'ZW' };
const LONDON: GeoPoint = { latitude: 51.5074, longitude: -0.1278, country: 'GB' };
const CAPE_TOWN: GeoPoint = { latitude: -33.9249, longitude: 18.4241, country: 'ZA' };

const at = (isoTime: string) => new Date(isoTime);
const sighting = (point: GeoPoint, isoTime: string) => ({ point, at: at(isoTime) });

describe('haversine distance', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(HARARE, HARARE)).toBe(0);
  });

  it('matches known distances within a percent', () => {
    // Harare → Bulawayo is roughly 365 km.
    expect(haversineKm(HARARE, BULAWAYO)).toBeGreaterThan(350);
    expect(haversineKm(HARARE, BULAWAYO)).toBeLessThan(380);
    // Harare → London is roughly 8200 km.
    expect(haversineKm(HARARE, LONDON)).toBeGreaterThan(8000);
    expect(haversineKm(HARARE, LONDON)).toBeLessThan(8400);
  });

  it('is symmetric', () => {
    expect(haversineKm(HARARE, LONDON)).toBeCloseTo(haversineKm(LONDON, HARARE), 6);
  });

  it('handles antipodal points without NaN', () => {
    const north: GeoPoint = { latitude: 90, longitude: 0, country: null };
    const south: GeoPoint = { latitude: -90, longitude: 0, country: null };
    const d = haversineKm(north, south);
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeGreaterThan(20_000);
  });
});

describe('geo point validation', () => {
  it('accepts a real coordinate', () => {
    expect(isValidGeoPoint(HARARE)).toBe(true);
  });

  it('rejects null coordinates', () => {
    expect(isValidGeoPoint({ latitude: null, longitude: 31 })).toBe(false);
    expect(isValidGeoPoint({ latitude: -17, longitude: null })).toBe(false);
  });

  it('rejects null island, which is what a failed lookup reports', () => {
    expect(isValidGeoPoint({ latitude: 0, longitude: 0 })).toBe(false);
  });

  it('rejects out-of-range and non-finite values', () => {
    expect(isValidGeoPoint({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidGeoPoint({ latitude: 0, longitude: 181 })).toBe(false);
    expect(isValidGeoPoint({ latitude: Number.NaN, longitude: 31 })).toBe(false);
  });
});

describe('impossible travel', () => {
  it('flags Harare to London in ten minutes', () => {
    const result = checkImpossibleTravel(
      sighting(HARARE, '2026-08-20T10:00:00Z'),
      sighting(LONDON, '2026-08-20T10:10:00Z'),
    );
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('impossible_travel');
    expect(result!.severity).toBe('high'); // crossed a border
    expect(result!.detail.impliedSpeedKmh).toBeGreaterThan(IMPOSSIBLE_SPEED_KMH);
  });

  it('allows the same journey by air over nine hours', () => {
    expect(
      checkImpossibleTravel(
        sighting(HARARE, '2026-08-20T10:00:00Z'),
        sighting(LONDON, '2026-08-20T19:00:00Z'),
      ),
    ).toBeNull();
  });

  it('stays silent with no previous sighting', () => {
    expect(checkImpossibleTravel(null, sighting(LONDON, '2026-08-20T10:00:00Z'))).toBeNull();
  });

  it('stays silent when either position is unknown', () => {
    const unknown = { latitude: null as unknown as number, longitude: 0, country: null };
    expect(
      checkImpossibleTravel(
        sighting(unknown, '2026-08-20T10:00:00Z'),
        sighting(LONDON, '2026-08-20T10:01:00Z'),
      ),
    ).toBeNull();
    expect(
      checkImpossibleTravel(
        sighting(HARARE, '2026-08-20T10:00:00Z'),
        sighting(unknown, '2026-08-20T10:01:00Z'),
      ),
    ).toBeNull();
  });

  it('ignores GeoIP jitter below the distance floor', () => {
    // Same city, one second apart: an absurd implied speed, but meaningless.
    const jittered: GeoPoint = { latitude: -17.9, longitude: 31.1, country: 'ZW' };
    const result = checkImpossibleTravel(
      sighting(HARARE, '2026-08-20T10:00:00Z'),
      sighting(jittered, '2026-08-20T10:00:01Z'),
    );
    expect(result).toBeNull();
    expect(haversineKm(HARARE, jittered)).toBeLessThan(MIN_TRAVEL_DISTANCE_KM);
  });

  it('does not flag a domestic hop that is under the distance floor', () => {
    // Harare → Bulawayo in a minute is impossible, but at ~365 km it is within
    // the range where GeoIP routinely misplaces a mobile connection.
    expect(
      checkImpossibleTravel(
        sighting(HARARE, '2026-08-20T10:00:00Z'),
        sighting(BULAWAYO, '2026-08-20T10:01:00Z'),
      ),
    ).toBeNull();
  });

  it('rates same-country travel lower than a border crossing', () => {
    const farNorth: GeoPoint = { latitude: -5.0, longitude: 31.0335, country: 'ZW' };
    const domestic = checkImpossibleTravel(
      sighting(HARARE, '2026-08-20T10:00:00Z'),
      sighting(farNorth, '2026-08-20T10:05:00Z'),
    );
    expect(domestic?.severity).toBe('medium');

    const international = checkImpossibleTravel(
      sighting(HARARE, '2026-08-20T10:00:00Z'),
      sighting(CAPE_TOWN, '2026-08-20T10:05:00Z'),
    );
    expect(international?.severity).toBe('high');
  });

  it('stays silent when the clock does not advance', () => {
    expect(
      checkImpossibleTravel(
        sighting(HARARE, '2026-08-20T10:00:00Z'),
        sighting(LONDON, '2026-08-20T10:00:00Z'),
      ),
    ).toBeNull();
    expect(
      checkImpossibleTravel(
        sighting(HARARE, '2026-08-20T10:00:00Z'),
        sighting(LONDON, '2026-08-20T09:59:00Z'),
      ),
    ).toBeNull();
  });

  it('reports evidence without leaking anything but geography', () => {
    const result = checkImpossibleTravel(
      sighting(HARARE, '2026-08-20T10:00:00Z'),
      sighting(LONDON, '2026-08-20T10:10:00Z'),
    )!;
    expect(Object.keys(result.detail).sort()).toEqual([
      'crossedBorder', 'distanceKm', 'elapsedSeconds',
      'fromCountry', 'impliedSpeedKmh', 'toCountry',
    ]);
  });
});

describe('country-only travel, where coordinates are missing', () => {
  const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);
  const now = new Date();

  it('flags a country change inside the window', () => {
    const result = checkCountryHop(
      { country: 'ZW', at: minutesAgo(10) },
      { country: 'GB', at: now },
    );
    expect(result?.kind).toBe('impossible_travel');
    expect(result?.detail.trigger).toBe('country_only');
  });

  it('never exceeds medium, so it cannot cost anyone their session', () => {
    // A border town or a VPN exit node flips country without anyone moving.
    const result = checkCountryHop(
      { country: 'ZW', at: minutesAgo(1) },
      { country: 'GB', at: now },
    );
    expect(result?.severity).toBe('medium');
    expect(actionFor(result!)).toBe('record_only');
  });

  it('ignores a change that took longer than the window', () => {
    expect(
      checkCountryHop(
        { country: 'ZW', at: minutesAgo(COUNTRY_HOP_WINDOW_MINUTES + 1) },
        { country: 'GB', at: now },
      ),
    ).toBeNull();
  });

  it('says nothing when the country did not change', () => {
    expect(
      checkCountryHop({ country: 'ZW', at: minutesAgo(1) }, { country: 'ZW', at: now }),
    ).toBeNull();
  });

  it('says nothing when either country is unknown', () => {
    expect(
      checkCountryHop({ country: null, at: minutesAgo(1) }, { country: 'GB', at: now }),
    ).toBeNull();
    expect(
      checkCountryHop({ country: 'ZW', at: minutesAgo(1) }, { country: null, at: now }),
    ).toBeNull();
  });

  it('says nothing without a previous sighting', () => {
    expect(checkCountryHop(null, { country: 'GB', at: now })).toBeNull();
  });

  it('describes a sub-minute hop in seconds rather than "0 minutes"', () => {
    const result = checkCountryHop(
      { country: 'ZW', at: new Date(Date.now() - 3000) },
      { country: 'GB', at: new Date() },
    )!;
    expect(result.summary).toContain('3s');
    expect(result.summary).not.toContain('0 minutes');
  });

  it('claims no distance or speed it did not measure', () => {
    const result = checkCountryHop(
      { country: 'ZW', at: minutesAgo(10) },
      { country: 'GB', at: now },
    )!;
    expect(result.detail).not.toHaveProperty('distanceKm');
    expect(result.detail).not.toHaveProperty('impliedSpeedKmh');
  });
});

describe('data access volume', () => {
  const base = { resource: 'admin_users', windowMinutes: 60 };

  it('flags a hard ceiling breach regardless of baseline', () => {
    const result = checkDataVolume({
      ...base, recordsInWindow: VOLUME_HARD_CEILING, baselinePerHour: 100_000,
    });
    expect(result?.severity).toBe('high');
    expect(result?.detail.trigger).toBe('hard_ceiling');
  });

  it('ignores small reads however far above baseline', () => {
    // 20× a tiny baseline, but only 20 records: not worth waking anyone.
    expect(
      checkDataVolume({ ...base, recordsInWindow: 20, baselinePerHour: 1 }),
    ).toBeNull();
  });

  it('ignores heavy but habitual use', () => {
    // An admin who always reads ~500 an hour reading 600 is just working.
    expect(
      checkDataVolume({ ...base, recordsInWindow: 600, baselinePerHour: 500 }),
    ).toBeNull();
  });

  it('flags a spike over the account’s own baseline', () => {
    const result = checkDataVolume({
      ...base, recordsInWindow: 1000, baselinePerHour: 20,
    });
    expect(result?.severity).toBe('medium');
    expect(result?.detail.trigger).toBe('baseline_multiple');
  });

  it('flags a large read from an account with no history', () => {
    const result = checkDataVolume({
      ...base, recordsInWindow: VOLUME_ABSOLUTE_FLOOR, baselinePerHour: 0,
    });
    expect(result?.detail.trigger).toBe('no_baseline');
  });

  it('is silent just below the floor and speaks just above it', () => {
    expect(
      checkDataVolume({ ...base, recordsInWindow: VOLUME_ABSOLUTE_FLOOR - 1, baselinePerHour: 0 }),
    ).toBeNull();
    expect(
      checkDataVolume({ ...base, recordsInWindow: VOLUME_ABSOLUTE_FLOOR, baselinePerHour: 0 }),
    ).not.toBeNull();
  });

  it('scales the baseline to the window, not the hour', () => {
    // 300 records in 15 minutes against a 100/hour baseline is 12× the
    // 25 records that window should hold — not 3×.
    const result = checkDataVolume({
      resource: 'orders', windowMinutes: 15, recordsInWindow: 300, baselinePerHour: 100,
    });
    expect(result).not.toBeNull();
    expect(result!.detail.multipleOfBaseline).toBe(12);
  });
});

describe('privilege escalation', () => {
  it('flags any attempt to set a privileged field', () => {
    const result = checkPrivilegeEscalation({
      deniedRequests: 0, strippedFields: ['role'], windowMinutes: 15,
    });
    expect(result?.severity).toBe('high');
    expect(result?.detail.trigger).toBe('privileged_field');
  });

  it('records field names but never their values', () => {
    const result = checkPrivilegeEscalation({
      deniedRequests: 0,
      strippedFields: ['password_hash', 'role', 'role'],
      windowMinutes: 15,
    })!;
    expect(result.detail.fields).toBe('password_hash,role'); // deduped, sorted
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('tolerates an isolated denial', () => {
    expect(
      checkPrivilegeEscalation({
        deniedRequests: 1, strippedFields: [], windowMinutes: 15,
      }),
    ).toBeNull();
  });

  it('flags a run of denials', () => {
    const result = checkPrivilegeEscalation({
      deniedRequests: ESCALATION_DENIAL_THRESHOLD,
      strippedFields: [],
      windowMinutes: 15,
    });
    expect(result?.severity).toBe('medium');
    expect(result?.detail.trigger).toBe('repeated_denials');
  });

  it('is silent one below the threshold', () => {
    expect(
      checkPrivilegeEscalation({
        deniedRequests: ESCALATION_DENIAL_THRESHOLD - 1,
        strippedFields: [],
        windowMinutes: 15,
      }),
    ).toBeNull();
  });
});

describe('response policy', () => {
  it('ends the session of someone tampering with privileged fields', () => {
    const anomaly = checkPrivilegeEscalation({
      deniedRequests: 0, strippedFields: ['role'], windowMinutes: 15,
    })!;
    expect(actionFor(anomaly)).toBe('revoke_session');
  });

  it('only re-authenticates on impossible travel, rather than destroying it', () => {
    // This is the detector most likely to be wrong, so it must not be the one
    // that logs a legitimate user out.
    const anomaly = checkImpossibleTravel(
      sighting(HARARE, '2026-08-20T10:00:00Z'),
      sighting(LONDON, '2026-08-20T10:10:00Z'),
    )!;
    expect(anomaly.severity).toBe('high');
    expect(actionFor(anomaly)).toBe('require_reauth');
  });

  it('takes no action on medium severity', () => {
    const anomaly = checkPrivilegeEscalation({
      deniedRequests: ESCALATION_DENIAL_THRESHOLD, strippedFields: [], windowMinutes: 15,
    })!;
    expect(actionFor(anomaly)).toBe('record_only');
  });
});
