import { describe, it, expect, beforeEach } from 'vitest';
import {
  verifyAdmin,
  verifyFarmer,
  verifyBuyer,
  registerDemoBuyer,
  isEmailTaken,
  DEMO_PASSWORD,
  DEMO_ADMIN_EMAIL,
} from '@/lib/demo-credentials';
import { isAccountLocked, recordFailedAttempt, resetAttempts } from '@/lib/account-lockout';
import type { Buyer } from '@/lib/mock-data';

describe('admin authentication', () => {
  it('accepts the exact allowlisted admin email', () => {
    expect(verifyAdmin(DEMO_ADMIN_EMAIL, DEMO_PASSWORD)).toBe(true);
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(verifyAdmin(`  ${DEMO_ADMIN_EMAIL.toUpperCase()}  `, DEMO_PASSWORD)).toBe(true);
  });

  it('rejects the correct email with a wrong password', () => {
    expect(verifyAdmin(DEMO_ADMIN_EMAIL, 'wrong')).toBe(false);
  });

  // Regression: login() used to grant admin to any email *containing* "admin".
  it.each([
    'admin@attacker.com',
    'notadmin@example.com',
    'badmin@example.com',
    'admin@agriconnect.co.zw.evil.com',
    'ADMIN@evil.io',
  ])('does not grant admin to look-alike email %s', (email) => {
    expect(verifyAdmin(email, DEMO_PASSWORD)).toBe(false);
  });
});

describe('farmer/buyer authentication', () => {
  it('accepts a seeded farmer with the demo password', () => {
    expect(verifyFarmer('john@moyofarm.co.zw', DEMO_PASSWORD)).not.toBeNull();
  });

  // Regression: login() used to accept *any* password.
  it('rejects a seeded farmer with a wrong password', () => {
    expect(verifyFarmer('john@moyofarm.co.zw', 'anything')).toBeNull();
  });

  // Regression: login() used to fabricate an account for unknown emails.
  it('rejects an unknown email instead of auto-provisioning an account', () => {
    expect(verifyFarmer('stranger@nowhere.com', DEMO_PASSWORD)).toBeNull();
    expect(verifyBuyer('stranger@nowhere.com', DEMO_PASSWORD)).toBeNull();
  });

  it('does not let a buyer email authenticate as a farmer', () => {
    expect(verifyFarmer('kuda@email.co.zw', DEMO_PASSWORD)).toBeNull();
    expect(verifyBuyer('kuda@email.co.zw', DEMO_PASSWORD)).not.toBeNull();
  });
});

describe('registration', () => {
  const newBuyer: Buyer = {
    id: 'test-1',
    name: 'Test Buyer',
    phone: '0771234567',
    email: 'newbuyer@example.co.zw',
    buyer_type: 'INDIVIDUAL',
    city: 'Harare',
    status: 'ACTIVE',
  };

  it('lets a registered account sign in with its own password', () => {
    registerDemoBuyer(newBuyer, 'MyOwnPass!1');
    expect(verifyBuyer(newBuyer.email, 'MyOwnPass!1')).not.toBeNull();
    expect(verifyBuyer(newBuyer.email, DEMO_PASSWORD)).toBeNull();
  });

  it('reports seeded and registered emails as taken', () => {
    expect(isEmailTaken('john@moyofarm.co.zw')).toBe(true);
    expect(isEmailTaken(DEMO_ADMIN_EMAIL)).toBe(true);
    expect(isEmailTaken('definitely-free@example.com')).toBe(false);
  });
});

describe('account lockout', () => {
  const email = 'lockout-test@example.com';
  beforeEach(() => resetAttempts(email));

  it('locks after 5 failed attempts', () => {
    for (let i = 0; i < 4; i++) {
      expect(recordFailedAttempt(email).locked).toBe(false);
    }
    expect(recordFailedAttempt(email).locked).toBe(true);
    expect(isAccountLocked(email).locked).toBe(true);
  });

  it('counts down remaining attempts', () => {
    expect(recordFailedAttempt(email).attemptsRemaining).toBe(4);
    expect(recordFailedAttempt(email).attemptsRemaining).toBe(3);
  });

  it('clears the lock after a successful login resets attempts', () => {
    recordFailedAttempt(email);
    recordFailedAttempt(email);
    resetAttempts(email);
    expect(isAccountLocked(email).locked).toBe(false);
    expect(recordFailedAttempt(email).attemptsRemaining).toBe(4);
  });
});
