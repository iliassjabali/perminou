import { defineWorkspace } from 'vitest/config';

// `packages/rpc-react` and `apps/mobile` each get their own project (see their own
// `vitest.config.ts`) because their component tests need `environment: 'jsdom'` (and, for
// `apps/mobile`, a `react-native` -> `react-native-web` alias); every other package/app keeps
// running under plain Node, unchanged from the previous single root `vitest.config.ts`.
export default defineWorkspace([
  'packages/rpc-react',
  'apps/mobile',
  {
    test: {
      name: 'node',
      include: ['packages/**/test/**/*.test.ts', 'apps/**/test/**/*.test.ts'],
      exclude: ['**/node_modules/**', 'packages/rpc-react/**', 'apps/mobile/**'],
      testTimeout: 60000,
    },
  },
]);
