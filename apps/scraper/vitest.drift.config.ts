import { defineConfig } from 'vitest/config';

// Dedicated config for the opt-in live drift test. The root vitest config only
// includes `*.test.ts`, so `pnpm test` never runs `*.live.ts`. This one does.
export default defineConfig({
  test: { include: ['test/**/*.live.ts'], testTimeout: 120_000 },
});
