/**
 * Client-side rate limiter using in-memory tracking.
 * Limits actions per time window to prevent abuse.
 */
const attempts = new Map<string, number[]>();

export function isRateLimited(key: string, maxAttempts: number = 3, windowMs: number = 60_000): boolean {
  const now = Date.now();
  const timestamps = attempts.get(key) || [];
  const recent = timestamps.filter(t => now - t < windowMs);
  
  if (recent.length >= maxAttempts) {
    attempts.set(key, recent);
    return true;
  }
  
  recent.push(now);
  attempts.set(key, recent);
  return false;
}

export function getRateLimitRemainingSeconds(key: string, windowMs: number = 60_000): number {
  const now = Date.now();
  const timestamps = attempts.get(key) || [];
  if (timestamps.length === 0) return 0;
  const oldest = Math.min(...timestamps.filter(t => now - t < windowMs));
  return Math.ceil((oldest + windowMs - now) / 1000);
}
