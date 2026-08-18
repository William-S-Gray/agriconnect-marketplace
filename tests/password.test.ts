import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  validatePassword,
  MIN_PASSWORD_LENGTH,
} from '@/lib/password';

describe('password hashing', () => {
  it('produces an Argon2id PHC string with the configured parameters', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).toContain('m=19456');
    expect(hash).toContain('t=2');
    expect(hash).toContain('p=1');
  });

  it('never stores the password in the hash', async () => {
    const password = 'a-very-distinctive-passphrase-42';
    const hash = await hashPassword(password);
    expect(hash).not.toContain(password);
    expect(hash).not.toContain('distinctive');
  });

  it('salts: the same password hashes differently each time', async () => {
    const a = await hashPassword('same passphrase here');
    const b = await hashPassword('same passphrase here');
    expect(a).not.toBe(b);
  });

  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword(hash, 'correct horse battery staple')).toBe(true);
    expect(await verifyPassword(hash, 'Correct horse battery staple')).toBe(false);
    expect(await verifyPassword(hash, '')).toBe(false);
  });

  it('returns false rather than throwing on a malformed hash', async () => {
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
    expect(await verifyPassword('', 'anything')).toBe(false);
  });
});

describe('password strength policy', () => {
  it('accepts a long passphrase', () => {
    expect(validatePassword('purple tractor harvest moon').ok).toBe(true);
  });

  it(`rejects anything shorter than ${MIN_PASSWORD_LENGTH} characters`, () => {
    const result = validatePassword('Short1!');
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain(`${MIN_PASSWORD_LENGTH}`);
  });

  // The old client-side policy would have accepted these: they satisfy
  // upper/lower/digit/symbol rules but are trivially guessable.
  it.each(['password123', 'Password123!', 'qwerty123', 'agriconnect', 'demo123'])(
    'rejects the common password %s',
    (candidate) => {
      expect(validatePassword(candidate).ok).toBe(false);
    },
  );

  it('rejects a long but repetitive password', () => {
    expect(validatePassword('aaaaaaaaaaaaaaaaaaaa').ok).toBe(false);
  });

  it('rejects long sequential runs', () => {
    expect(validatePassword('abcdefghijklmnop').ok).toBe(false);
    expect(validatePassword('12345678901234').ok).toBe(false);
  });

  it('rejects a password containing the email local part', () => {
    const result = validatePassword('johnmoyo-tractor-farm', {
      email: 'johnmoyo@moyofarm.co.zw',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('email');
  });

  it('rejects a password containing the user name', () => {
    const result = validatePassword('grace-sibanda-harvest', { name: 'Grace Sibanda' });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('name');
  });

  it('accepts the seeded demo password (so the demo still works)', () => {
    const result = validatePassword('AgriDemo!2026', {
      email: 'john@moyofarm.co.zw',
      name: 'John Moyo',
    });
    expect(result.ok).toBe(true);
  });

  it('rejects the previous demo password, which was too short', () => {
    expect(validatePassword('Demo@1234').ok).toBe(false);
  });
});
