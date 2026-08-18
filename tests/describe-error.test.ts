import { describe, it, expect } from 'vitest';
import { describeError, redactSecrets, connectionHint } from '@/lib/describe-error';

/** Builds the shape pg throws when every resolved address fails. */
function aggregate(codes: string[]): AggregateError {
  const subs = codes.map((code, i) => {
    const e = new Error(`connect ${code} 10.0.0.${i}:5432`) as NodeJS.ErrnoException;
    e.code = code;
    return e;
  });
  // Node constructs this with an empty message — the bug this fixes.
  return new AggregateError(subs, '');
}

describe('AggregateError unwrapping', () => {
  it('reports the underlying causes instead of an empty message', () => {
    const err = aggregate(['ETIMEDOUT', 'ENETUNREACH']);
    // The regression: err.message alone is empty.
    expect(err.message).toBe('');

    const described = describeError(err);
    expect(described).toContain('ETIMEDOUT');
    expect(described).toContain('ENETUNREACH');
    expect(described.trim()).not.toBe('');
  });

  it('collapses duplicate causes rather than repeating them', () => {
    const described = describeError(aggregate(['ETIMEDOUT', 'ETIMEDOUT', 'ETIMEDOUT']));
    expect(described).toMatch(/x3/);
  });

  it('summarises once past the display limit', () => {
    const err = new AggregateError(
      ['a', 'b', 'c', 'd', 'e'].map((n) => new Error(`distinct failure ${n}`)),
      '',
    );
    expect(describeError(err, 2)).toContain('and 3 more');
  });

  it('handles an ordinary Error', () => {
    expect(describeError(new Error('relation does not exist'))).toBe('relation does not exist');
  });

  it('includes the errno code when present', () => {
    const e = new Error('connection refused') as NodeJS.ErrnoException;
    e.code = 'ECONNREFUSED';
    expect(describeError(e)).toBe('ECONNREFUSED: connection refused');
  });

  it('follows a single cause chain', () => {
    const err = new Error('outer', { cause: new Error('inner detail') });
    expect(describeError(err)).toContain('inner detail');
  });

  it('never returns an empty string', () => {
    expect(describeError(new AggregateError([], ''))).not.toBe('');
    expect(describeError(undefined)).toBe('unknown error');
    expect(describeError(null)).toBe('unknown error');
  });
});

describe('secret redaction', () => {
  // The fixture below is deliberately not shaped like a real Neon token: a
  // realistic-looking one would trip secret scanners and grep audits forever.
  it('redacts the password from a postgres URL', () => {
    const text = 'failed for postgresql://neondb_owner:EXAMPLE-not-a-real-password@host.neon.tech/neondb';
    const safe = redactSecrets(text);
    expect(safe).not.toContain('EXAMPLE-not-a-real-password');
    expect(safe).toContain('neondb_owner:***@');
  });

  it('redacts a standalone password field', () => {
    expect(redactSecrets('password=hunter2 host=db')).not.toContain('hunter2');
    expect(redactSecrets('{ password: "hunter2" }')).not.toContain('hunter2');
  });

  it('redacts credentials surfaced through an error message', () => {
    const e = new Error('connect failed: postgres://u:p4ssw0rd@db.example/x');
    expect(describeError(e)).not.toContain('p4ssw0rd');
  });

  it('leaves ordinary text alone', () => {
    expect(redactSecrets('relation "users" does not exist')).toBe('relation "users" does not exist');
  });
});

describe('operator hints', () => {
  it('explains an unreachable database', () => {
    const hint = connectionHint(aggregate(['ETIMEDOUT']));
    expect(hint).toContain('DB_PINNED_HOST_IP');
  });

  it('explains an auth failure', () => {
    expect(connectionHint(new Error('password authentication failed for user "x"')))
      .toContain('credentials');
  });

  it('stays quiet for unrelated errors', () => {
    expect(connectionHint(new Error('syntax error at or near "SLECT"'))).toBeNull();
  });
});
