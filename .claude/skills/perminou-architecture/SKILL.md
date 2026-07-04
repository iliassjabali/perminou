---
name: perminou-architecture
description: Use when adding a package/app, deciding where a class/interface/file belongs, wiring the backend↔mobile contract, or reviewing dependency direction in the Perminou monorepo (scraper, backend, mobile). Covers Turborepo layout, hexagonal ports & adapters implemented with Effect (Context.Tag/Layer), the online tRPC API, and offline-capability-via-cache.
---

# Perminou Architecture

## Overview

Perminou is a mobile app for practicing the Moroccan driving-exam (*code de la route*). A scraper harvests NARSA's question bank into **Postgres**; a backend serves it via a typed **tRPC** API; an **Expo** app fetches it live and **persists its react-query cache** so already-loaded content works offline.

**Stack:** all-in **Effect** (domain + scraper + backend) on **Node**, **tRPC** served by **Hono**, **Drizzle** ORM (`@effect/sql-drizzle`, shared `pgTable` scraper↔backend), **Expo + NativeWind + React Native Reusables** + **react-query (persisted)** mobile, **Vitest**, **pnpm + Turborepo**. No NestJS, no Bun.

**Core principle:** the domain is pure and central. Everything touching the outside world (NARSA's HTML, Postgres, tRPC, the network) is an **adapter behind a port** — in Effect a port is a `Context.Tag`, an adapter is a `Layer`. Dependencies point inward, enforced by the `R` channel of `Effect<A, E, R>`, so a missing/mis-wired adapter is a compile error. See `perminou-effect`.

## Monorepo layout (pnpm + Turborepo)

```
perminou/
  packages/
    domain/        # entities + Effect Schema + ports (Tags). Pure.
    db/            # shared Drizzle pgTable schema + drizzle-kit migrations (scraper writes, backend reads)
    api-contract/  # exported tRPC AppRouter type — mobile imports this, no codegen
  apps/
    scraper/       # hybrid Playwright + HTTP crawler → writes the bank into Postgres (Effect)
    backend/       # Effect + Hono + tRPC API serving the bank from Postgres
    mobile/        # Expo online app; persisted react-query cache = offline capability
  docs/adr/        # architecture decision records
```

`packages/domain` imports no I/O library (Playwright, pg, tRPC, expo). It may use `effect` (Schema, Context, Data). If you import an I/O library into `domain`, the boundary is wrong.

## Data flow (online, cache-as-offline)

```
NARSA HTML ──scraper──► Postgres ──backend (tRPC over Hono)──► Expo app
                                                                 │
                                          @tanstack/react-query ─┤ persisted cache (MMKV)
                                          expo-image ────────────┘ image disk cache
```

The app is **online**: it queries the backend reactively (categories, chapters, questions, exams) via tRPC + react-query. **Offline capability comes from the persisted cache** — anything already fetched stays usable with no signal, and a **first-launch prefetch** warms the bank so it behaves offline-first. There is no bundle, no on-device DB, no sync. See `perminou-mobile-ui`.

## Ports & adapters — where things go

**Backend** (`apps/backend`):
- `domain/` — entities (`Question`, `Answer`, `Exam`, `Category`, `Chapter`), invariants, Effect Schema. Pure.
- `application/` — use-cases as `Effect` values (`ListChapters`, `GetChapterQuestions`, `GetExam`). Depend on ports via the `R` channel.
- inbound adapter — **the tRPC router**, mounted on a **Hono** server (`@hono/trpc-server`): thin. Runs a use-case via `ManagedRuntime`, maps the `E` channel to tRPC errors. No business logic.
- outbound adapters — `QuestionRepository` (Postgres `Layer` via `@effect/sql-drizzle`), `MediaUrls` (object-storage URL builder).

**Scraper** (`apps/scraper`): live site behind the `SourceGateway` Tag; writes via a `QuestionRepository` Postgres `Layer` (shares `packages/db`). See `perminou-scraping`.
**Mobile** (`apps/mobile`): tRPC client behind a `SyncClient` port, wrapped by react-query hooks. See `perminou-mobile-ui`.

## Example — the tRPC router is *just an inbound adapter* over an Effect use-case

```ts
// apps/backend/src/catalog/application/get-chapter-questions.ts
// PURE application layer. Its type declares the ports it needs (R) and how it can fail (E).
export const getChapterQuestions = (chapterId: ChapterId): Effect.Effect<
  Question[], ChapterNotFound, QuestionRepository
> =>
  Effect.gen(function* () {
    const repo = yield* QuestionRepository;          // port
    const chapter = yield* repo.findChapter(chapterId);
    if (!chapter) return yield* Effect.fail(new ChapterNotFound({ chapterId }));
    return yield* repo.questionsForChapter(chapterId);
  });

// apps/backend/src/catalog/adapters/inbound/catalog.router.ts
const runtime = ManagedRuntime.make(MainLayer);      // MainLayer provides QuestionRepository
export const catalogRouter = t.router({
  chapterQuestions: t.procedure
    .input(Schema.standardSchemaV1(ChapterIdSchema))  // Effect Schema as tRPC validator
    .query(({ input }) =>
      runtime.runPromise(
        getChapterQuestions(input).pipe(
          Effect.catchTag('ChapterNotFound', () => Effect.fail(new TRPCError({ code: 'NOT_FOUND' }))),
        ),
      ),
    ),
});
export type AppRouter = typeof catalogRouter;         // re-exported via packages/api-contract
```

```ts
// apps/mobile — client fully typed by AppRouter, wrapped by react-query (cached + persisted)
const { data } = trpc.chapterQuestions.useQuery({ chapterId });
```

## Common mistakes

- **Business logic in the tRPC router.** The router runs a use-case and maps errors. Logic lives in `application/`.
- **`domain` importing an adapter library.** Domain is pure TS + Effect Schema/Context only.
- **NestJS-style DI or `@Injectable`.** Wiring is Layers + the `R` channel. See `perminou-effect`.
- **Duplicating types across apps.** A `Question` is defined once in `packages/domain`; the DB schema once in `packages/db`.
- **Reintroducing an on-device dataset/bundle.** Offline = the persisted react-query cache, not a bundle. Changing that needs an ADR.

## Related skills

- `perminou-effect` — Tag/Layer/typed-errors mechanics (read to implement the above)
- `perminou-scraping` — the `SourceGateway` port and hybrid engine → Postgres
- `perminou-testing` — how ports become test seams (fixtures, Testcontainers, tRPC caller)
- `perminou-mobile-ui` — Expo + NativeWind + RNR + react-query persisted cache
