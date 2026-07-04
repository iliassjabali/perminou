# `@perminou/rpc-react`

A typed `api` proxy over the `@effect/rpc` HTTP client (from `@perminou/rpc-contract`), wrapping
`@tanstack/react-query`. The app calls `api.exam.getExam.useQuery({ count })` — one import, no
`@effect/rpc` or `@tanstack/react-query-persist-client` types leaking into screens.

```tsx
import { api } from '@perminou/rpc-react';

const { data, isLoading } = api.exam.getExam.useQuery({ count: 20 });
```

## Two entry points

| Import | Contents | Loads under Node/Vitest? |
|---|---|---|
| `@perminou/rpc-react` | `api`, `RpcReactProvider`, `makeExamClient`, the persistence helpers (`persist.ts`) | Yes |
| `@perminou/rpc-react/native` | `PerminouRpcReactProvider` — the Expo preset (MMKV-backed persisted cache) | **No** |

`@perminou/rpc-react/native` imports `react-native-mmkv`, a native module that cannot load
outside a React Native runtime. Nothing under `test/` imports it, and the main `src/index.ts`
barrel deliberately does **not** re-export `native.ts` — this keeps `pnpm test` (jsdom/Node) green.
Only import the `/native` subpath from Expo app code.

## Persisted cache (`src/persist.ts`)

`persist.ts` holds the persistence logic but is native-module-free: it depends on a minimal
`KeyValueStorage` interface —

```ts
interface KeyValueStorage {
  set(key: string, value: string): void;
  getString(key: string): string | undefined;
  delete(key: string): void;
}
```

— which is exactly the subset of `react-native-mmkv`'s `MMKV` class it needs. This means the
persister is unit-tested in plain Node against a `Map`-backed fake (`test/persist.test.ts`); the
real `MMKV` instance is only ever constructed in `native.ts`, at the app layer.

Because the exam bank rarely changes, `PERSISTED_QUERY_DEFAULT_OPTIONS` sets a long `staleTime`
(24h) and `gcTime: Infinity` — cached data is served instantly and never evicted from memory.

## Expo wiring (`src/native.ts`)

```tsx
// App.tsx (or your root layout)
import 'react-native-get-random-values'; // or your polyfill of choice — see below
import { PerminouRpcReactProvider } from '@perminou/rpc-react/native';

export default function App() {
  return (
    <PerminouRpcReactProvider baseUrl="https://api.perminou.example/rpc">
      <RootScreen />
    </PerminouRpcReactProvider>
  );
}
```

`PerminouRpcReactProvider` builds one `QueryClient` (with `PERSISTED_QUERY_DEFAULT_OPTIONS`),
wires it to a real `MMKV` instance via `setupPersistedQueryClient` (restore-on-mount, persist on
every subsequent cache change), and renders `RpcReactProvider` around `children`. Pass a `storage`
prop to override the default `MMKV` instance (e.g. a second cache, or a test double).

This file typechecks as part of this package's `pnpm typecheck` but is **not** unit-tested here —
`react-native-mmkv` needs a real RN/Hermes runtime, which Plan 4 exercises on-device.

## Hermes polyfills

`@effect/rpc`'s client (used by `makeExamClient`/`RpcReactProvider`) needs a few Web APIs that
Hermes doesn't ship on every Expo SDK: `TextEncoder`/`TextDecoder` and `crypto.getRandomValues`.

- **Expo SDK 54+** ships `TextEncoder`/`TextDecoder` and (via `expo-crypto`/`react-native-quick-
  crypto`, depending on setup) most of `crypto` already — verify against the current SDK's
  Hermes release notes before adding polyfills you don't need.
- Whatever's missing, **import the polyfill at the app's entry point, before any other import** —
  before `App.tsx`'s first line, ahead of `@perminou/rpc-react/native` and anything that
  transitively imports `effect`/`@effect/rpc`. Effect's serialization/RPC layers reference these
  globals at module-eval time, so a polyfill imported too late (e.g. inside a screen component)
  is a silent no-op.

```ts
// index.ts (Expo's registered entry point) — first lines, nothing above this
import 'text-encoding-polyfill'; // or expo's own, if/when SDK 54+ doesn't cover it
import 'react-native-get-random-values'; // crypto.getRandomValues
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
```

If the exact polyfill packages aren't yet pinned for the target Expo SDK, check
`https://docs.expo.dev/versions/latest/` for that SDK's Hermes/JSI feature list first — polyfilling
something Hermes already provides is harmless but unnecessary weight.

## Risk note (ADR 0007)

If `@effect/rpc`'s client turns out not to work under Hermes despite polyfills, ADR 0007's
fallback is tRPC — swapping `src/client.ts` only. `api.ts`, `query.ts`, `persist.ts`, `native.ts`,
and the app-facing `api` surface are unaffected by that swap.
