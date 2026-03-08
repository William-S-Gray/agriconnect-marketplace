const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface LockoutEntry {
  attempts: number;
  lockedUntil: number | null;
}

const store = new Map<string, LockoutEntry>();

function getEntry(key: string): LockoutEntry {
  return store.get(key) || { attempts: 0, lockedUntil: null };
}

export function isAccountLocked(email: string): { locked: boolean; remainingSeconds: number } {
  const key = email.toLowerCase().trim();
  const entry = getEntry(key);
  
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
    return { locked: true, remainingSeconds: Math.ceil((entry.lockedUntil - Date.now()) / 1000) };
  }
  
  // Lockout expired — reset
  if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
    store.delete(key);
  }

  return { locked: false, remainingSeconds: 0 };
}

export function recordFailedAttempt(email: string): { locked: boolean; attemptsRemaining: number; lockoutSeconds: number } {
  const key = email.toLowerCase().trim();
  const entry = getEntry(key);
  
  entry.attempts += 1;

  if (entry.attempts >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    store.set(key, entry);
    return { locked: true, attemptsRemaining: 0, lockoutSeconds: LOCKOUT_DURATION_MS / 1000 };
  }

  store.set(key, entry);
  return { locked: false, attemptsRemaining: MAX_ATTEMPTS - entry.attempts, lockoutSeconds: 0 };
}

export function resetAttempts(email: string): void {
  store.delete(email.toLowerCase().trim());
}
