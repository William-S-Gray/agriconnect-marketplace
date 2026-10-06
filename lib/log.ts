import { describeError } from './describe-error';

/**
 * Structured one-line logs. The app previously logged nothing at all, so every
 * swallowed 500 and every Redis fallback was invisible in production.
 *
 * Errors go through describeError, which redacts connection strings — the
 * reason catch blocks used to swallow driver errors silently.
 */
export function logEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

export function logError(event: string, error: unknown, fields: Record<string, unknown> = {}): void {
  logEvent('error', event, { ...fields, error: describeError(error) });
}
