import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

// Shared Vitest config for a MiniServer web-app (Next.js App Router + React 19 + Prisma).
// `tsconfigPaths()` makes the `@/*` alias (tsconfig "paths") resolve in tests.
// Default environment is "node" (server actions + pure logic). Component test files
// opt into jsdom with a top-of-file docblock:  // @vitest-environment jsdom
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist'],
  },
});
