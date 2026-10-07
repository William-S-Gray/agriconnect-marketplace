import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { sessionCookieName, SESSION_COOKIE } from '@/lib/session';

/**
 * Regression guard for the requirement that authentication tokens never reach
 * client-accessible storage.
 *
 * This is a source scan rather than a runtime assertion because the guarantee is
 * structural: the session token only ever exists in an HttpOnly cookie set by
 * the server, so there is no client code path that *could* store it. The scan
 * fails if someone reintroduces one.
 */

const ROOTS = ['app', 'components', 'hooks', 'lib', 'scripts'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

function sourceFiles(dir: string, acc: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (SOURCE_EXTENSIONS.has(extname(entry))) acc.push(full);
  }
  return acc;
}

const files = ROOTS.flatMap((r) => sourceFiles(join(process.cwd(), r)));

/** Removes comments so prose about localStorage does not trip the scan. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function readAll(): { file: string; text: string }[] {
  return files.map((file) => ({ file, text: stripComments(readFileSync(file, 'utf8')) }));
}

describe('no authentication token in client-accessible storage', () => {
  it('finds source files to scan (guards against a silently empty scan)', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('never writes to localStorage except for the theme preference', () => {
    const offenders = readAll()
      .filter(({ text }) => /localStorage\.setItem/.test(text))
      .filter(({ text }) =>
        // The only permitted write is the light/dark theme.
        !/localStorage\.setItem\(\s*['"]theme['"]/.test(text),
      )
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('never uses sessionStorage at all', () => {
    const offenders = readAll()
      .filter(({ text }) => /\bsessionStorage\b/.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('never uses IndexedDB for auth', () => {
    const offenders = readAll()
      .filter(({ text }) => /\bindexedDB\b/i.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('client code never touches document.cookie', () => {
    const offenders = readAll()
      .filter(({ text }) => /document\.cookie/.test(text))
      .map(({ file }) => file.replace(`${process.cwd()}/`, ''));
    expect(offenders).toEqual([]);
  });

  it('no Authorization/Bearer header scheme is used by the client', () => {
    const offenders = readAll()
      .filter(({ text }) => /Bearer\s|['"]authorization['"]\s*:/i.test(text))
      // Server-only modules can't reach the client; lib/cron.ts reads the
      // bearer secret Vercel Cron sends.
      .filter(({ text }) => !/^import 'server-only';/m.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('no JWT library or token is present', () => {
    const offenders = readAll()
      .filter(({ text }) => /\bjsonwebtoken\b|\bjwt\.sign\b|\bjwtDecode\b/.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('the client session hook holds no token', () => {
    const hook = stripComments(
      readFileSync(join(process.cwd(), 'hooks/use-session.ts'), 'utf8'),
    );
    // Match actual API use, not the words in the explanatory comments above.
    expect(hook).not.toMatch(/localStorage\.|sessionStorage\.|document\.cookie/);
    expect(hook).toContain('/api/auth/session');
  });
});

describe('session cookie attributes', () => {
  it('uses a __Host- prefixed name in production', () => {
    expect(SESSION_COOKIE).toBe('__Host-agri_session');
  });

  it('falls back to an unprefixed name in development, where there is no TLS', () => {
    // __Host- requires Secure, which browsers refuse over plain http.
    expect(sessionCookieName()).toBe('agri_session');
  });

  it('sets HttpOnly, SameSite and Path on every cookie write', () => {
    const source = readFileSync(join(process.cwd(), 'lib/session.ts'), 'utf8');
    expect(source).toMatch(/httpOnly:\s*true/);
    expect(source).toMatch(/sameSite:\s*'lax'/);
    expect(source).toMatch(/path:\s*'\/'/);
    // Secure is tied to production so local http development still works.
    expect(source).toMatch(/secure:\s*useSecureCookies/);
  });

  it('stores only a hash of the token server-side', () => {
    const source = readFileSync(join(process.cwd(), 'lib/session.ts'), 'utf8');
    expect(source).toMatch(/createHash\('sha256'\)/);
    // The raw token must never be written into a column.
    expect(source).not.toMatch(/token_hash\s*=\s*\$\{token\}/);
  });
});
