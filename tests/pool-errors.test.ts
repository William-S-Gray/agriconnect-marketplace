import { describe, it, expect, afterAll, vi } from 'vitest';
import { pool } from '@/lib/pool';

/**
 * A dropped idle connection (Neon suspending a compute, a failover) makes the
 * pool emit 'error'. Without a listener that is an uncaught exception.
 */
describe('database pool', () => {
  afterAll(async () => { await pool.end(); });

  it('handles an idle-client error instead of letting it escape', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(pool.listenerCount('error')).toBeGreaterThan(0);
    expect(() => pool.emit('error', new Error('terminating connection due to administrator command'))).not.toThrow();
    expect(log.mock.calls.some(([line]) => String(line).includes('db_idle_client_error'))).toBe(true);
    log.mockRestore();
  });
});
