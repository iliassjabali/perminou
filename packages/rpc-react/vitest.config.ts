import { defineConfig } from 'vitest/config';

// Package-scoped: this package's tests need `jsdom` (React rendering), while every other
// package in the monorepo runs its tests under plain Node. Picked up via the root
// `vitest.workspace.ts` as its own project so the two environments don't collide.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    environment: 'node',
    environmentMatchGlobs: [['test/*.test.tsx', 'jsdom']],
    testTimeout: 60000,
  },
});
