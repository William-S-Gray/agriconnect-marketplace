import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * CSRF and authorization are opt-in per route handler, so the failure mode is a
 * new route that forgets them. This scan makes forgetting fail CI.
 */

const API = join(process.cwd(), 'app', 'api');

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return routeFiles(p);
    return name === 'route.ts' ? [p] : [];
  });
}

/** Mutating routes that are legitimately reachable without a session. */
const PUBLIC_MUTATIONS = new Set([
  'auth/login/route.ts',
  'auth/logout/route.ts',
  'auth/register/route.ts',
  'auth/password/forgot/route.ts',
  'auth/password/reset/route.ts',
  'auth/mfa/verify/route.ts', // half-authenticated by design; checks getSession itself
  'auth/verify/route.ts', // the emailed token is the credential
  'auth/verify/resend/route.ts',
]);

const files = routeFiles(API).map((f) => ({ rel: relative(API, f), src: readFileSync(f, 'utf8') }));

describe('route handler guards', () => {
  it('finds the route files (guards a vacuous scan)', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const { rel, src } of files) {
    const mutates = /export async function (POST|PUT|PATCH|DELETE)\b/.test(src);
    if (!mutates) continue;

    it(`${rel}: reads its body through readJson, never request.json()`, () => {
      // readJson enforces the JSON content type and the body-size limit.
      expect(src).not.toMatch(/request\.json\(\)/);
    });

    it(`${rel}: every mutating handler checks the request origin`, () => {
      const handlers = src.match(/export async function (POST|PUT|PATCH|DELETE)\b/g)!.length;
      expect((src.match(/verifyOrigin\(/g) ?? []).length).toBeGreaterThanOrEqual(handlers);
    });

    if (!PUBLIC_MUTATIONS.has(rel)) {
      it(`${rel}: requires an authenticated user`, () => {
        expect(src).toMatch(/require(User|Role|Admin)\(/);
      });
    }
  }
});
