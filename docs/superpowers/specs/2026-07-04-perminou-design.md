# Perminou — Design Spec

**Date:** 2026-07-04
**Status:** Draft for review
**Related:** `docs/adr/0001–0008`, `.claude/skills/perminou-*`

## 1. Goal

A mobile app to practice the Moroccan driving-license theory exam (*code de la route*). We scrape NARSA's official question bank (`perminou.narsa.gov.ma`) into our own store and serve it through an app that works well for **daily practice** on Moroccan mobile networks.

**Scope:** personal use. No public redistribution of NARSA content (so ToS/redistribution concerns are out of scope). Bilingual content (fr/ar).

## 2. Non-goals (YAGNI)

- No user accounts / auth in the app (the *scraper* authenticates to NARSA; the *app* does not).
- No offline-first bundle, on-device dataset DB, or sync engine (offline = cache; ADR 0003).
- No social features (leaderboards, sharing), analytics, or progress cloud-sync in v1.
- No `@effect/rpc` used directly by the app — only via `rpc-react`.

## 3. Architecture

Hexagonal, all-in Effect, in a pnpm + Turborepo monorepo. The domain is pure; the outside world (NARSA HTML, Postgres, the RPC wire) sits behind ports (`Context.Tag`) implemented by adapters (`Layer`). Dependencies point inward, enforced by the `R` channel.

```
NARSA HTML ──scraper (Playwright+HTTP)──► Postgres ──backend (@effect/rpc over Hono)──► Expo app
                                                                                         │
                                              rpc-react (typed api proxy + react-query) ─┤ MMKV persisted cache
                                              expo-image ──────────────────────────────── ┘ image disk cache
```

**Packages / apps** (see `perminou-architecture`):

| Unit | Responsibility | Key ports / surface |
|---|---|---|
| `packages/domain` | entities + Effect Schema + ports. Pure. | `Question`, `Answer`, `Exam`, `Category`, `Chapter`; port Tags |
| `packages/db` | shared Drizzle `pgTable` schema + `drizzle-kit` migrations | `QuestionRepository` schema (scraper writes, backend reads) |
| `packages/rpc-contract` | `@effect/rpc` `RpcGroup` defs (payload/success/error Schema) | `CatalogRpcs`, `ExamRpcs` — shared server+client |
| `packages/rpc-react` | typed `api` proxy: react-query hooks over the `@effect/rpc` client + MMKV persisted cache | `api.<ns>.<rpc>.{ useQuery, useMutation, prefetch }` |
| `apps/scraper` | hybrid crawl → normalize → upsert into Postgres | `SourceGateway`, `QuestionRepository` |
| `apps/backend` | serve the bank from Postgres via `@effect/rpc` handlers over Hono | inbound: rpc handlers; outbound: `QuestionRepository`, `MediaUrls` |
| `apps/mobile` | Expo + NativeWind + RNR; consumes `api`; persisted cache = offline | `SyncClient` (via `rpc-react`) |

## 4. Data model (initial)

- **Category** (6: LA ROUTE, LES RÈGLES DE CIRCULATION, LE VÉHICULE, L'INITIATION À LA SÉCURITÉ ROUTIÈRE, LES INFRACTIONS ET LES SANCTIONS, LE CONDUCTEUR) → **Chapter** → **Question**.
- **Question**: `sourceUrl` (stable key), `text`, `lang` (fr|ar), `imageUrl?`, `chapterId`, ordinal.
- **Answer**: `label`, `correct: boolean`, belongs to a Question.
- **Exam** (Examen Blanc): a set of questions + pass rule.
- Media (images): stored in object storage, referenced by URL; cached on device by `expo-image`.

Schema defined once in `packages/domain` (Effect Schema) + `packages/db` (Drizzle `pgTable`).

## 5. Data flow

1. **Scrape** (occasional batch, Node): Playwright authenticates and captures the session; HTTP-bulk crawls chapters/quizzes/exams with the cookie; on redirect-to-signin → `SessionExpired` → re-auth → resume. Normalize each entity (pure, validated via Effect Schema). **Upsert** into Postgres by `sourceUrl` (idempotent).
2. **Serve** (backend): `@effect/rpc` handlers call use-cases (`GetChapterQuestions`, `GetExam`) that read Postgres via `QuestionRepository`. Typed errors travel over the wire.
3. **Consume** (app): screens call `api.*.useQuery(...)`; react-query caches results, **persisted to MMKV**; a **first-launch prefetch** warms the bank so the app behaves offline-first. `staleTime` high (the bank rarely changes).

## 6. Key decisions (see ADRs)

Monorepo (0001) · hybrid scraper (0002) · online-first + cache (0003) · Expo/NativeWind/RNR (0004) · all-in Effect (0005) · Drizzle + `@effect/sql-drizzle` (0006) · `@effect/rpc` + custom `rpc-react`, not tRPC (0007) · Hono + Node (0008).

## 7. Testing strategy (see `perminou-testing`)

Vitest everywhere; TDD red-green-refactor. **No test hits live NARSA** — it's behind `SourceGateway`, fed recorded fixtures; the only live check is an opt-in **drift test** (not in `pnpm test`). Backend use-cases: pure tests with fake port Layers. Repos: **Testcontainers** Postgres + real migrations. Mobile: logic/hooks with mocked `rpc-react`; server contract guaranteed at compile time by `rpc-contract`.

## 8. Open questions / risks

1. **Answers-in-DOM vs post-submit** (blocks scraper detail) — resolve via the time-boxed spike; record real selectors in ADR 0002; replace the placeholder selectors in `perminou-scraping`. **The selectors in that skill are currently UNVERIFIED.**
2. **`@effect/rpc` on RN is pioneer territory** (0.x, undocumented, no shipped-Expo datapoint, v4 migration coming). Contained in `rpc-react`; tRPC is the documented fallback (ADR 0007).
3. **Effect learning curve** — the main schedule risk (ADR 0005); mitigated by the `perminou-effect` skill.
4. **Source fragility** — NARSA leaks bugs / short sessions; scraper must fail loud, re-auth, and be re-runnable.

## 9. Build order (high level — detailed plan comes from writing-plans)

> Boilerplate is **generated with plop** (`pnpm plop feature|entity|screen`, see `perminou-scaffolding`) — only logic is hand-written. Scaffold-first is a project rule (CLAUDE.md).


1. Scaffold monorepo (pnpm + Turborepo), `packages/domain` + Effect Schema for the data model.
2. **Scraping spike** → resolve open question #1, record selectors.
3. `packages/db` schema + migrations; `apps/scraper` behind `SourceGateway` with fixtures; upsert to Postgres.
4. `packages/rpc-contract`; `apps/backend` handlers + use-cases + repo (Testcontainers).
5. `packages/rpc-react` (the `api` proxy + persisted cache).
6. `apps/mobile` — NativeWind + RNR shell, catalog/quiz/exam screens, prefetch.

Each step: spec-aligned, TDD, reviewed before the next.
