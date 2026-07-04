---
name: perminou-mobile-ui
description: Use when building or reviewing the Perminou Expo mobile app — screens, quiz/exam UI, styling with NativeWind (Tailwind for RN), components with React Native Reusables (shadcn-for-RN), the tRPC + react-query data layer, persisted cache for offline capability, first-launch prefetch, and image caching with expo-image. Applies to anything under apps/mobile.
---

# Perminou Mobile UI

## Overview

`apps/mobile` is an **Expo** app, **Android-first** (the Moroccan market). It's **online** — it fetches the question bank live from the backend via **tRPC + `@tanstack/react-query`** — but it **persists its react-query cache** so anything already loaded stays usable with no signal, and it **prefetches the bank on first launch** so it *behaves* offline-first.

**Not offline-first:** no bundled dataset, no on-device SQLite, no sync engine. Offline capability = **cache**.

**UI stack:** **NativeWind** (Tailwind for RN) + **React Native Reusables (RNR)** — the shadcn/ui port for RN. Copy-paste, you-own-the-code: components live in `components/ui/`, edit freely. Mirrors the web `shadcn` workflow 1:1.

## Offline-via-cache — how it works

| Layer | Mechanism |
|---|---|
| JSON data (questions, choices, answers, exams) | react-query cache, **persisted** to **MMKV** (`persistQueryClient` + a MMKV persister) with a long `gcTime` |
| Images | **`expo-image`** automatic disk cache (referenced by URL from the backend) |
| First-run offline | **prefetch** the catalog on first online launch (`queryClient.prefetchQuery` per chapter) to warm the persisted cache |

Set `staleTime` high (the bank changes rarely) so cached content is served instantly and refetched in the background when online.

## Ports (lighter hexagonal on mobile)

| Port | Real adapter | Test adapter |
|---|---|---|
| `SyncClient` | tRPC client (typed by `AppRouter`), wrapped by react-query hooks | fake caller |

The tRPC client is typed by importing `AppRouter` from `packages/api-contract` — **a server/client mismatch is a compile error**, no runtime contract test needed.

## Setup essentials

- `nativewind` + `tailwindcss`, `metro.config.js` wired for NativeWind, `tailwind.config.js` content globs cover `app/**` + `components/**`.
- RNR components added via its CLI into `components/ui/` (copy-paste, owned).
- `@trpc/client` + `@trpc/react-query` + `@tanstack/react-query`.
- `@tanstack/react-query-persist-client` + a **MMKV** persister (`react-native-mmkv`) — faster and higher-capacity than AsyncStorage for the persisted cache.
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

## Example — a quiz answer card (NativeWind + RNR), data from a cached query

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

```tsx
// reading questions — served from the persisted cache instantly, refetched in background when online
const { data: questions, isLoading } = trpc.chapterQuestions.useQuery({ chapterId });
```

## Common mistakes

- **Treating this as offline-first with a bundle/DB.** It's online + persisted cache. Don't add expo-sqlite or a dataset bundle without an ADR.
- **Forgetting to persist the cache.** Without `persistQueryClient` + MMKV, closing the app loses everything and there's no offline.
- **No first-launch prefetch.** Without warming the cache online, a brand-new user with no signal sees nothing. Prefetch the catalog on first successful launch.
- **Low `staleTime`.** The bank rarely changes — high `staleTime` gives instant reads and avoids needless refetches.
- **Inline styles instead of NativeWind classes.** Use `className`; keep tokens (`bg-card`, `text-card-foreground`) consistent with the RNR theme.
- **Treating RNR components as a locked dependency.** They're copy-pasted into `components/ui/` — edit them.
- **Forgetting `/ar/` layout.** Content is bilingual; support RTL for Arabic.

## Related skills

- `perminou-architecture` — the online API + the `AppRouter` contract
- `perminou-testing` — mobile logic tests + compile-time contract
- Global: `typescript-best-practices`; web `shadcn` skill for the mental model
