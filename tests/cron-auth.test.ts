import { describe, it, expect } from 'vitest';
import { cronAuthorized as authorized } from '@/lib/cron';

describe('cron route authorization', () => {
  it('accepts only the exact bearer secret', () => {
    expect(authorized('Bearer s3cret', 's3cret')).toBe(true);
    expect(authorized('Bearer wrong', 's3cret')).toBe(false);
    expect(authorized('s3cret', 's3cret')).toBe(false);
    expect(authorized(null, 's3cret')).toBe(false);
  });

  it('refuses everything while CRON_SECRET is unset', () => {
    expect(authorized('Bearer ', '')).toBe(false);
    expect(authorized('Bearer undefined', undefined)).toBe(false);
  });
});
