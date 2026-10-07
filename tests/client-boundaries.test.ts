import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * React.lazy and recharts only work on the client. A server component that
 * uses either compiles fine and then fails at request time, so the type
 * checker and the build both miss it — this scan does not.
 */

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) return [];
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });
}

const root = process.cwd();
const files = ['app', 'components'].flatMap((d) => sources(join(root, d)));

describe('client-only APIs stay behind a client boundary', () => {
  it('finds source files (guards a vacuous scan)', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    if (!/\blazy\(/.test(src)) continue;
    it(`${relative(root, file)} uses React.lazy, so it must be a client component`, () => {
      expect(src.trimStart().startsWith("'use client'") || src.trimStart().startsWith('"use client"')).toBe(true);
    });
  }
});
