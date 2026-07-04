import { defineWorkspace } from 'vitest/config';

// `packages/rpc-react` gets its own project (see `packages/rpc-react/vitest.config.ts`) because
// its React tests need `environment: 'jsdom'`; every other package/app keeps running under plain
// Node, unchanged from the previous single root `vitest.config.ts`.
export default defineWorkspace([
  'packages/rpc-react',
  {
    test: {
      name: 'node',
      include: ['packages/**/test/**/*.test.ts', 'apps/**/test/**/*.test.ts'],
      exclude: ['**/node_modules/**', 'packages/rpc-react/**'],
      testTimeout: 60000,
    },
  },
]);
