import { defineConfig } from 'vitest/config';

// Package-scoped, mirroring `packages/rpc-react/vitest.config.ts`: `.test.tsx` files render
// components (jsdom), `.test.ts` files stay plain Node/logic-only (see `test/use-deck.test.ts`).
//
// `react-native` itself doesn't load under Vitest/esbuild (its source ships untranspiled Flow
// syntax — Metro's babel pipeline strips it at bundle time, but Vitest has no such step). Since
// `react-native-web` (already an Expo/mobile dependency, for Expo's web target) implements the
// same `View`/`Text`/`Pressable`/etc. API as real DOM nodes, aliasing `react-native` to it lets
// component tests render and query through `@testing-library/react` without touching Metro.
// Native-only modules (`expo-image`, `expo-audio`) have no such web alias wired here and are
// mocked per-test instead (see `test/QuestionCard.test.tsx`).
export default defineConfig({
  resolve: {
    alias: {
      'react-native': 'react-native-web',
    },
  },
  test: {
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    environment: 'node',
    environmentMatchGlobs: [['test/*.test.tsx', 'jsdom']],
    testTimeout: 60000,
  },
});
