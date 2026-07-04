---
name: perminou-mobile-ui
description: Use when building or reviewing the Perminou Expo mobile app — screens, quiz/exam UI, styling with NativeWind (Tailwind for RN), components with React Native Reusables (shadcn-for-RN), the rpc-react data layer (custom react-query hooks over the @effect/rpc client), persisted cache for offline capability, first-launch prefetch, and image caching with expo-image. Applies to anything under apps/mobile.
---

# Perminou Mobile UI

## Overview

`apps/mobile` is an **Expo** app, **Android-first** (the Moroccan market). It's **online** — it fetches the question bank live from the backend via **`rpc-react`** (our custom react-query hooks over the `@effect/rpc` client) — but it **persists its react-query cache** so anything already loaded stays usable with no signal, and it **prefetches the bank on first launch** so it *behaves* offline-first.

**Not offline-first:** no bundled dataset, no on-device SQLite, no sync engine. Offline capability = **cache**.

**UI stack:** **NativeWind** (Tailwind for RN) + **React Native Reusables (RNR)** — the shadcn/ui port for RN. Copy-paste, you-own-the-code: components in `components/ui/`, edit freely. Mirrors the web `shadcn` workflow 1:1.

## Data layer — `rpc-react`, not tRPC

The app **never imports `@effect/rpc` or tRPC directly**. It uses `packages/rpc-react`, which wraps the `@effect/rpc` HTTP client + react-query and exposes a **typed `api` proxy** built once from the contract — `api.catalog.chapterQuestions.useQuery({ chapterId })`, mirroring `trpc.x.y.useQuery`. One import at every call site. The proxy is typed by the shared `packages/rpc-contract` `RpcGroup`s — **a client/server mismatch is a compile error** (no runtime contract test needed). Any `@effect/rpc` 0.x/v4 churn is absorbed inside `rpc-react` (ADR 0007).

## Offline-via-cache — how it works

| Layer | Mechanism |
|---|---|
| JSON data (questions, choices, answers, exams) | react-query cache, **persisted** to **MMKV** (`persistQueryClient` + a MMKV persister) with a long `gcTime` |
| Images | **`expo-image`** automatic disk cache (referenced by URL from the backend) |
| First-run offline | **prefetch** the catalog on first online launch (`queryClient.prefetchQuery` per chapter) to warm the persisted cache |

Set `staleTime` high (the bank changes rarely) so cached content is served instantly and refetched in the background when online.

## Setup essentials

- `nativewind` + `tailwindcss`; `metro.config.js` wired for NativeWind; `tailwind.config.js` globs cover `app/**` + `components/**`.
- RNR components added via its CLI into `components/ui/` (copy-paste, owned).
- `@tanstack/react-query` + `@tanstack/react-query-persist-client` + a **MMKV** persister (`react-native-mmkv`).
- `@effect/rpc` client + Effect (Hermes needs polyfills: `TextEncoder`/`TextDecoder`/`crypto.getRandomValues` — Expo SDK 54+ ships most; import polyfills at entry before anything else).
- `expo-image` for images (disk cache out of the box).

## Example — persisted query client (offline-capable cache)

```ts
// apps/mobile/lib/query.ts
import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 60 * 24, gcTime: Infinity, retry: 2 } },
});

persistQueryClient({
  queryClient,
  persister: {
    persistClient: (c) => storage.set('rq-cache', JSON.stringify(c)),
    restoreClient: () => { const s = storage.getString('rq-cache'); return s ? JSON.parse(s) : undefined; },
    removeClient: () => storage.delete('rq-cache'),
  },
  maxAge: Infinity,   // the bank rarely changes; keep the offline cache indefinitely
});
```

## Example — reading questions via rpc-react (typed by rpc-contract)

```tsx
// served from the persisted cache instantly, refetched in background when online
import { api } from '@perminou/rpc-react';   // ONE import — typed proxy over the contract

const { data: questions, isLoading, error } = api.catalog.chapterQuestions.useQuery({ chapterId });
// error is the typed ChapterNotFound from the wire, not a generic Error
```

## Example — a quiz answer card (NativeWind + RNR)

```tsx
// apps/mobile/components/quiz/answer-option.tsx
import { Pressable, Text } from 'react-native';
import { cn } from '~/lib/utils';           // RNR's className merge helper

export function AnswerOption({ label, state, onPress }: {
  label: string; state: 'idle' | 'correct' | 'wrong'; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'rounded-2xl border p-4 mb-3 active:opacity-80',
        state === 'idle' && 'border-border bg-card',
        state === 'correct' && 'border-green-500 bg-green-500/10',
        state === 'wrong' && 'border-red-500 bg-red-500/10',
      )}
    >
      <Text className="text-base text-card-foreground">{label}</Text>
    </Pressable>
  );
}
```

## Common mistakes

- **Importing `@effect/rpc` or tRPC in a screen.** Go through `rpc-react` — that's what contains the 0.x churn.
- **Treating this as offline-first with a bundle/DB.** It's online + persisted cache. No expo-sqlite/dataset without an ADR.
- **Forgetting to persist the cache.** Without `persistQueryClient` + MMKV, closing the app loses everything — no offline.
- **No first-launch prefetch.** Without warming the cache online, a brand-new user with no signal sees nothing.
- **Low `staleTime`.** The bank rarely changes — high `staleTime` gives instant reads and avoids needless refetches.
- **Missing Hermes polyfills.** Effect needs `TextEncoder`/`TextDecoder`/`crypto` — import them at entry or the client crashes on device.
- **Inline styles instead of NativeWind classes.** Use `className` with RNR theme tokens (`bg-card`, `text-card-foreground`).
- **Treating RNR components as a locked dependency.** They're copy-pasted into `components/ui/` — edit them.
- **Forgetting `/ar/` layout.** Content is bilingual; support RTL for Arabic.

## Related skills

- `perminou-architecture` — the online API + `rpc-contract`/`rpc-react` boundary
- `perminou-effect` — the @effect/rpc client/server bridge
- `perminou-testing` — mobile logic tests + compile-time contract
- Global: `typescript-best-practices`; web `shadcn` skill for the mental model
