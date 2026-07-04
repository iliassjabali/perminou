# 0004 — Mobile: Expo + NativeWind + React Native Reusables

**Status:** Accepted

## Context

Android-dominant (Moroccan market), image-heavy quiz UI, TypeScript stack, want fast iteration and OTA updates.

## Decision

**Expo** (Android-first) + **NativeWind** (Tailwind for RN) + **React Native Reusables (RNR)** — the shadcn/ui port for RN. RNR components are copy-pasted into `components/ui/` and owned, mirroring the web shadcn workflow. EAS Update provides OTA JS pushes.

## Consequences

- TypeScript reuse with the rest of the monorepo; shared domain types.
- shadcn muscle memory transfers 1:1; components are owned and editable.
- EAS Update ships logic without a store review.

## Alternatives rejected

- **Flutter** — better raw perf, but Dart abandons the TS/Effect ecosystem and shares nothing with backend/scraper; perf edge irrelevant for a quiz app.
- **PWA / installable web** — cheapest, but weakest offline-capability and app-store presence for a daily-use app in this market.
- **Native (Kotlin + Swift)** — two codebases, slowest; overkill.
- **Gluestack / Tamagui** (vs RNR) — Gluestack is close but RNR mirrors shadcn's exact API; Tamagui isn't Tailwind and adds a compiler.
