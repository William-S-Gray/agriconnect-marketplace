import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // These are server-side security tests: no DOM needed.
    environment: 'node',
    globals: true,
    include: ['tests/**/*.{test,spec}.ts'],
    // Integration tests talk to the dev database; give them room and run the
    // files serially so rate-limit counters in shared tables do not collide.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      // `server-only` throws unless the bundler applies React's "react-server"
      // condition. Stubbing it here lets tests import application modules while
      // the guard still protects the real Next build.
      'server-only': path.resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
});
