import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  startSession,
  verifySession,
  requiresSessionTermination,
  recordDataAccess,
  resetSessionAnomalyState,
  subscribeToAnomalies,
  getAnomalyLog,
  DATA_VOLUME_THRESHOLD,
  MIN_PLAUSIBLE_TRAVEL_MINUTES,
  type SessionFingerprint,
} from '@/lib/session-anomaly';

beforeEach(() => resetSessionAnomalyState());
afterEach(() => vi.restoreAllMocks());

describe('privilege escalation detection', () => {
  it('accepts an untampered session', () => {
    const session = startSession('buyer', 'buyer-001');
    expect(verifySession(session, 'buyer')).toEqual([]);
  });

  it('detects a role edited to admin in storage', () => {
    const session = startSession('buyer', 'buyer-001');
    // Attacker edits only the store's role, leaving the signed fingerprint.
    const found = verifySession(session, 'admin');
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe('PRIVILEGE_ESCALATION');
    expect(found[0].severity).toBe('critical');
    expect(requiresSessionTermination(found)).toBe(true);
  });

  it('detects a forged fingerprint whose role was rewritten', () => {
    const session = startSession('buyer', 'buyer-001');
    const forged: SessionFingerprint = { ...session, role: 'admin' };
    const found = verifySession(forged, 'admin');
    expect(found[0].kind).toBe('PRIVILEGE_ESCALATION');
    expect(requiresSessionTermination(found)).toBe(true);
  });

  it('detects an authenticated session with no fingerprint at all', () => {
    const found = verifySession(null, 'admin');
    expect(found[0].kind).toBe('PRIVILEGE_ESCALATION');
    expect(requiresSessionTermination(found)).toBe(true);
  });

  it('stays quiet for an anonymous visitor with no session', () => {
    expect(verifySession(null, null)).toEqual([]);
  });

  it('flags a downgraded role as a mismatch, not an escalation', () => {
    const session = startSession('admin', 'admin@agriconnect.co.zw');
    const found = verifySession(session, 'buyer');
    expect(found[0].kind).toBe('PRIVILEGE_ESCALATION');
    expect(found[0].message).toContain('role mismatch');
  });
});

describe('impossible travel detection', () => {
  function sessionFromLocation(location: string, ageMinutes: number): SessionFingerprint {
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: location }),
    } as unknown as Intl.DateTimeFormat);
    const s = startSession('buyer', 'buyer-001');
    vi.restoreAllMocks();
    return { ...s, issuedAt: Date.now() - ageMinutes * 60_000 };
  }

  it('flags a location change that happens too fast as critical', () => {
    const session = sessionFromLocation('Africa/Harare', 5);
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'America/New_York' }),
    } as unknown as Intl.DateTimeFormat);

    const travel = verifySession(session, 'buyer').find(a => a.kind === 'IMPOSSIBLE_TRAVEL');
    expect(travel?.severity).toBe('critical');
    expect(travel?.detail).toContain('Africa/Harare');
  });

  it('downgrades to a warning once enough time has passed', () => {
    const session = sessionFromLocation('Africa/Harare', MIN_PLAUSIBLE_TRAVEL_MINUTES + 60);
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'America/New_York' }),
    } as unknown as Intl.DateTimeFormat);

    const travel = verifySession(session, 'buyer').find(a => a.kind === 'IMPOSSIBLE_TRAVEL');
    expect(travel?.severity).toBe('warning');
  });

  it('does not flag an unchanged location', () => {
    const session = startSession('buyer', 'buyer-001');
    expect(verifySession(session, 'buyer').some(a => a.kind === 'IMPOSSIBLE_TRAVEL')).toBe(false);
  });
});

describe('data access volume detection', () => {
  it('stays quiet below the threshold', () => {
    expect(recordDataAccess('admin:farmers', DATA_VOLUME_THRESHOLD - 1)).toBeNull();
  });

  it('flags a burst that exceeds the threshold', () => {
    const anomaly = recordDataAccess('admin:orders', DATA_VOLUME_THRESHOLD + 1);
    expect(anomaly?.kind).toBe('DATA_VOLUME');
    expect(anomaly?.detail).toContain('admin:orders');
  });

  it('accumulates across separate reads', () => {
    const half = Math.ceil(DATA_VOLUME_THRESHOLD / 2);
    expect(recordDataAccess('admin:farmers', half)).toBeNull();
    expect(recordDataAccess('admin:farmers', half + 1)).not.toBeNull();
  });

  it('does not re-flag repeatedly inside the same window', () => {
    expect(recordDataAccess('admin:orders', DATA_VOLUME_THRESHOLD + 1)).not.toBeNull();
    expect(recordDataAccess('admin:orders', DATA_VOLUME_THRESHOLD + 1)).toBeNull();
  });
});

describe('real-time subscription', () => {
  it('notifies subscribers the moment an anomaly is detected', () => {
    const seen: string[] = [];
    const unsubscribe = subscribeToAnomalies(a => seen.push(a.kind));

    verifySession(null, 'admin');
    recordDataAccess('admin:farmers', DATA_VOLUME_THRESHOLD + 1);

    expect(seen).toEqual(['PRIVILEGE_ESCALATION', 'DATA_VOLUME']);
    unsubscribe();

    verifySession(null, 'admin');
    expect(seen).toHaveLength(2); // no longer receiving events
  });

  it('records findings in the log', () => {
    verifySession(null, 'admin');
    expect(getAnomalyLog().map(a => a.kind)).toContain('PRIVILEGE_ESCALATION');
  });
});
