import { describe, it, expect } from 'vitest';
import { safeNextPath } from '@/lib/page-guard';
import { newOrderReference } from '@/lib/order-lifecycle';
import { contentSecurityPolicy } from '@/middleware';

describe('post-login redirect target (F-006)', () => {
  it.each([
    'https://evil.example/phish',
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    'javascript:alert(1)',
  ])('refuses %j', (next) => {
    expect(safeNextPath(next)).toBeUndefined();
  });

  it('normalises scheme-relative oddities into a same-origin path', () => {
    expect(safeNextPath('http:evil.example')).toBe('/evil.example');
  });

  it('keeps a same-origin path, query and hash', () => {
    expect(safeNextPath('/farm/orders?tab=open#x')).toBe('/farm/orders?tab=open#x');
    expect(safeNextPath(undefined)).toBeUndefined();
  });
});

describe('order references (F-020)', () => {
  it('carry 40 random bits, so a year of orders does not collide', () => {
    const ref = newOrderReference(new Date('2026-05-01'));
    expect(ref).toMatch(/^AG-2026-[0-9A-F]{10}$/);
    const many = new Set(Array.from({ length: 10_000 }, () => newOrderReference()));
    expect(many.size).toBe(10_000);
  });
});

describe('content security policy (F-003)', () => {
  it('allows nonced scripts and nothing inline-unsafe in production', () => {
    const csp = contentSecurityPolicy('abc123', true);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).not.toContain('neon.tech');
  });
});
