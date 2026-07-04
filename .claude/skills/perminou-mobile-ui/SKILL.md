---
name: perminou-mobile-ui
description: Use when building or reviewing the Perminou Expo mobile app — screens, quiz/exam UI, styling with NativeWind (Tailwind for RN), components with React Native Reusables (shadcn-for-RN), the offline-first expo-sqlite dataset, media caching, the tRPC sync client, dataset bundle download/swap, and EAS Update. Applies to anything under apps/mobile.
---

# Perminou Mobile UI

## Overview

`apps/mobile` is an **Expo** app, **Android-first** (the Moroccan market), **offline-first**. It ships with a baseline dataset, runs 100% offline against a local **expo-sqlite** copy, and pulls newer dataset versions when online.

**UI stack:** **NativeWind** (Tailwind CSS for React Native) + **React Native Reusables (RNR)** — the shadcn/ui port for RN. Same copy-paste, you-own-the-code model as shadcn: components live in `components/ui/`, you edit them freely. This mirrors the web `shadcn` workflow 1:1.

**Core principle:** the network is optional. Everything the user does reads from local SQLite; sync only *replaces* the local dataset with a newer immutable version. A user on the metro with no signal has the full app.

## Offline data flow (control-plane vs data-plane)

```
trpc.dataset.getManifest()  ──►  { version, checksum, bundleUrl }   [tRPC, tiny]
        │ newer than local?
        ▼
  fetch(bundleUrl)  ──►  verify checksum  ──►  swap local expo-sqlite db + media  [plain HTTP/CDN, large]
```

The bundle (SQLite + media) is **never** streamed through tRPC — a tRPC call returns its URL, the app downloads it directly. See `perminou-architecture` (two-plane rule).

## Ports (lighter hexagonal on mobile)

| Port | Real adapter | Test adapter |
|---|---|---|
| `LocalDatasetStore` | expo-sqlite (via **`drizzle-orm/expo-sqlite`**, same `sqliteTable` schema the scraper writes) | in-memory sqlite |
| `SyncClient` | tRPC client (typed by `AppRouter`) | fake caller |

The tRPC client is typed by importing `AppRouter` from `packages/api-contract` — **a server/client mismatch is a compile error**, no runtime contract test needed.

## Setup essentials

- `nativewind` + `tailwindcss`, `metro.config.js` wired for NativeWind, `tailwind.config.js` content globs include `app/**` and `components/**`.
- RNR components added via its CLI into `components/ui/` (copy-paste, owned).
- `expo-sqlite` for the dataset; `expo-file-system` for cached media; `expo-updates` / **EAS Update** for OTA JS pushes (ship logic without a store review — critical when the scraped source shifts).

## Example — a quiz answer card (NativeWind + RNR), reading from local SQLite

```tsx
// apps/mobile/components/quiz/answer-option.tsx
import { Pressable, Text } from 'react-native';
import { cn } from '~/lib/utils';           // RNR's className merge helper

export function AnswerOption({ label, state, onPress }: {
  label: string;
  state: 'idle' | 'correct' | 'wrong';
  onPress: () => void;
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

```ts
// apps/mobile/features/quiz/load-quiz.ts — reads LOCAL db, works offline
export async function loadQuiz(store: LocalDatasetStore, chapterId: string): Promise<Question[]> {
  return store.query<Question>(
    'select * from questions where chapter_id = ? order by ordinal',
    [chapterId],
  );
}
```

## Example — sync: pull a newer dataset version, then swap

```ts
// apps/mobile/features/sync/sync-dataset.ts
export async function syncDataset(sync: SyncClient, store: LocalDatasetStore) {
  const manifest = await sync.getManifest();               // tRPC, tiny
  if (manifest.version <= store.currentVersion()) return;  // already current → stay offline

  const bundle = await fetch(manifest.bundleUrl);          // plain HTTP/CDN, large
  const bytes = new Uint8Array(await bundle.arrayBuffer());
  if (!(await checksumMatches(bytes, manifest.checksum))) throw new Error('bundle checksum mismatch');

  await store.installVersion(manifest.version, bytes);     // atomic swap of the local db
}
```

## Common mistakes

- **Fetching questions over the network at read time.** Always read from local SQLite; the network only *updates* the dataset.
- **Streaming the bundle through tRPC.** Use the returned `bundleUrl` with plain `fetch`.
- **Skipping checksum verification** before swapping the local db. A corrupt download must not replace a good dataset.
- **Non-atomic dataset swap.** Install to a temp db, verify, then swap — never leave a half-written db if the app is killed mid-install.
- **Inline styles instead of NativeWind classes.** Use `className`; keep tokens (`bg-card`, `text-card-foreground`) consistent with the RNR theme.
- **Treating RNR components as a locked dependency.** They're copy-pasted into `components/ui/` — edit them; that's the point.
- **Forgetting `/ar/` layout.** Content is bilingual; support RTL for Arabic.

## Related skills

- `perminou-architecture` — two-plane rule + the `AppRouter` contract
- `perminou-testing` — mobile logic tests + compile-time contract
- Global: `typescript-best-practices`; web `shadcn` skill for the mental model
