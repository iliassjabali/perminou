# Perminou — Status & Build Journey

The full context of what was built, why, how, and what remains. Companion to the ADRs (decisions) and plans (execution).

## What it is

An audio-first "Tinder for questions" app for the Moroccan driving-exam (*code de la route*). Scrape NARSA's official bank → serve it → practice it as a swipeable, audio-first deck. Personal use.

## How the work was done

Spec → ADRs → per-plan TDD, executed **subagent-driven**: a Sonnet implementer per task, an Opus reviewer gating each (spec compliance + code quality), controller (main session) coordinating. **100+ tests, typecheck 7/7 green**, every task committed + pushed. Progress ledger in `.superpowers/sdd/progress.md` (git-ignored scratch).

## The decision journey (with the pivots)

The cadrage deliberately challenged every choice; several flipped under scrutiny:

- **Data delivery:** offline-first bundle+sync → **online + persisted react-query cache** (ADR 0003). Simpler; the backend became the core.
- **Backend paradigm:** NestJS → **all-in Effect** (ADR 0005). Compiler-enforced hexagonal (Tag=port, Layer=adapter, `R` channel).
- **RPC:** tRPC → **`@effect/rpc` + a custom `rpc-react`** typed `api` proxy (ADR 0007). tRPC kept as documented fallback — never needed.
- **Runtime:** Node+Bun → **Node only** (ADR 0008). HTTP host = **Hono**.
- **ORM:** **Drizzle** + `@effect/sql-drizzle` (ADR 0006). **Mobile:** Expo + NativeWind + React Native Reusables (ADR 0004). **Monorepo:** pnpm + Turborepo (ADR 0001). **Scraper:** Playwright-primary hybrid (ADR 0002).
- **UX:** landed on **"Tinder for questions"** — an audio-first swipe deck.

## The scraper spike (ADR 0002) — what the live site actually is

- **Django SSR, session-auth, no API.** No JSON endpoint; questions live in rendered HTML.
- **Question = numeric-or-alphanumeric id + image (`.png`/`.gif`) and/or audio (`.mp3`) + 2–4 numbered multi-select checkbox answers.** The prompt/answers are *in the media*; ~10% of ids are alphanumeric (signage sub-bank `IS*/ISR*`) → `QuestionId` is a **string**.
- **Media is PUBLIC** (`/media/uploads/questions/{images|son}/{fr|ar}/{id}.{png|mp3}`, per language) — the app loads it directly; only the exam pages need auth.
- **Correct answers only appear on the end-of-exam correction, marked by 1-based INDEX** (not the answer's DB id) → downstream joins correctness on index.
- **No enumerable listing** (chapter links are broken Django regex) → harvest via the random Examen Blanc, **loop-until-dry**.
- **PWA service worker** serves an offline fallback under load → Playwright runs with service workers disabled.

## What got built (Plans 1–5)

| Plan | Delivered |
|---|---|
| **1 — Foundation** | pnpm+Turborepo monorepo; `packages/domain` (Effect Schema entities, `QuestionRepository` port); `packages/db` (Drizzle schema + migrations + Postgres adapter, Testcontainers); plop generators; tsconfig `bundler` resolution |
| **5 — Scraper** | `apps/scraper`: Playwright login + drive exam + parse correction; public-media probe; **loop-until-dry harvest** → Postgres; fixtures + opt-in drift test. **Harvested 385 questions / 1,049 answers / 100% audio.** |
| **2 — Backend** | `packages/rpc-contract` (`ExamRpcs`, `QuestionWire`); `apps/backend` Effect + Hono `@effect/rpc` server (`GetExam`/`GetAllQuestions` + `/health` + CORS); real HTTP round-trip test |
| **3 — rpc-react** | `packages/rpc-react`: typed `api` proxy over the `@effect/rpc` client + react-query; MMKV persisted cache; Expo `/native` preset. **De-risk gate green (client round-trips in Node); client BUNDLES under Metro/Hermes** — no tRPC fallback |
| **4 — Tinder app** | `apps/mobile`: rpc-react wiring; audio-first `QuestionCard` (auto-play, reveal); swipe `Deck` (gesture-handler+reanimated, right=got-it/left=review, persisted review set); Home menu + scored Mock Exam + Review (native-stack nav); fr/ar toggle + RTL |

## Current state

- **Full local stack runs:** Postgres (seeded 385) → backend `:3000` (`@effect/rpc` + CORS) → Expo. See README "Run the full stack".
- **Web** works (http://localhost:8081) after adding CORS to the backend — visual UX; audio limited in-browser. **Phone** (Expo Go, `exp://<lan-ip>:8081`) for full audio.
- **Notable pioneering result:** the `@effect/rpc` *client* bundles and runs on React Native / Metro / Hermes — no shipped precedent existed; the tRPC fallback (ADR 0007) was never needed.
- **Data is committed** as a data-only seed (`packages/db/seed/perminou-questions.sql`) so the bank travels with the repo.

## Known follow-ups

1. **On-device runtime confirmation** — Hermes `TextEncoder` polyfill + `expo-audio` playback on a real phone (bundle is proven; runtime is the last unverified mile).
2. **Deeper RTL** — Home is fully RTL; card/deck views are LTR-styled (media/lang logic is correct in `ar`).
3. **Mock-exam exhaustion edge** — an un-validated (merely swiped) last card can count toward exhaustion without scoring.
4. **Backend for production** — readiness probe (`/health` is liveness-only), graceful shutdown (drain the pool on SIGTERM), tighten CORS origin.
5. **Dependency hygiene** — align the split `@effect/platform` versions (db 0.71 vs rpc/backend 0.96; isolated + working, but a clean/strict install could complain).
6. **Web storage** — MMKV loaded fine in-browser, but a `localStorage` `KeyValueStorage` fallback is a cheap safety net if it ever misbehaves.
7. **Course categories** — not scraped (the exam doesn't expose them); menu is Practice/Exam/Review. True per-course browsing needs more scraping.
8. **Upsert transaction** — `upsertQuestion` is non-atomic (self-healing on re-scrape, single-writer); wrap in a Drizzle transaction before heavier use.
