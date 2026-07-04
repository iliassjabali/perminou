# 0003 — Online-first with cached offline capability

**Status:** Accepted (supersedes an earlier offline-first draft)

## Context

Users practice daily on Moroccan mobile networks. An earlier draft was **offline-first**: the scraper emitted a versioned SQLite bundle + media, the app shipped/synced it and ran fully offline. That carried real complexity — bundle versioning, on-device DB, media bundling, an atomic swap, a sync engine. It was reconsidered.

## Decision

**Online-first with an offline-capable cache.** The app fetches the bank live from the backend and **persists its react-query cache** (MMKV) so already-loaded content stays usable with no signal; a **first-launch prefetch** warms the cache so it *behaves* offline-first. Images cache via `expo-image`. No bundle, no on-device DB, no sync engine.

## Consequences

- Far less machinery than offline-first; the backend becomes the core (see it now holds the full bank).
- Offline works for **fetched** content; genuinely-fresh content needs network.
- Personal-use scope means the always-online-for-updates tradeoff is acceptable.

## Alternatives rejected

- **Offline-first bundle + sync** — best no-signal UX, but bundle versioning + on-device DB + sync is disproportionate complexity for this app. Dropped.
- **Pure online (no cache)** — simplest, but dead without signal; poor for daily practice on spotty networks.
