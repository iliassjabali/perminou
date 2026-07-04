---
name: perminou-architecture
description: Use when adding a package/app, deciding where a class/interface/file belongs, wiring the backend↔mobile contract, or reviewing dependency direction in the Perminou monorepo (scraper, backend, mobile). Covers Turborepo layout, hexagonal ports & adapters implemented with Effect (Context.Tag/Layer), the online @effect/rpc API, the custom rpc-react client, and offline-capability-via-cache.
---

# Perminou Architecture

## Overview

Perminou is a mobile app for practicing the Moroccan driving-exam (*code de la route*). A scraper harvests NARSA's question bank into **Postgres**; a backend serves it via an **@effect/rpc** API; an **Expo** app fetches it live through a custom **rpc-react** (react-query) client and **persists its cache** so already-loaded content works offline.

**Stack:** all-in **Effect** (domain + scraper + backend) on **Node**, **@effect/rpc** served by **Hono**, custom **rpc-react** hooks (react-query, persisted), **Drizzle** ORM (`@effect/sql-drizzle`, shared `pgTable` scraper↔backend), **Expo + NativeWind + React Native Reusables** mobile, **Vitest**, **pnpm + Turborepo**. No NestJS, no tRPC, no Bun.

**Core principle:** the domain is pure and central. Everything touching the outside world (NARSA's HTML, Postgres, the RPC wire) is an **adapter behind a port** — in Effect a port is a `Context.Tag`, an adapter is a `Layer`. Dependencies point inward, enforced by the `R` channel of `Effect<A, E, R>`, so a missing/mis-wired adapter is a compile error. See `perminou-effect`.

## Monorepo layout (pnpm + Turborepo)

```
perminou/
  packages/
    domain/        # entities + Effect Schema + ports (Tags). Pure.
    db/            # shared Drizzle pgTable schema + drizzle-kit migrations (scraper writes, backend reads)
    rpc-contract/  # @effect/rpc RpcGroup defs (payload/success/error as Effect Schema) — shared server+client
    rpc-react/     # OUR custom library: typed `api` proxy (react-query hooks) over the @effect/rpc client + MMKV persisted cache
  apps/
    scraper/       # hybrid Playwright + HTTP crawler → writes the bank into Postgres (Effect)
    backend/       # Effect + Hono; serves rpc-contract handlers from Postgres
    mobile/        # Expo online app; rpc-react persisted cache = offline capability
  docs/adr/        # architecture decision records
```

`packages/domain` imports no I/O library. The app imports **`rpc-react`**, never `@effect/rpc` directly — so any 0.x/v4 churn is contained to one package (ADR 0007).

## Data flow (online, cache-as-offline)

```
NARSA HTML ──scraper──► Postgres ──backend (@effect/rpc over Hono)──► Expo app
                                                                       │
                                    rpc-react (react-query) ───────────┤ persisted cache (MMKV)
                                    expo-image ─────────────────────────┘ image disk cache
```

The app is **online**: it queries the backend reactively via `rpc-react` hooks. **Offline capability comes from the persisted cache** — already-fetched content works with no signal, and a **first-launch prefetch** warms the bank. No bundle, no on-device DB, no sync. See `perminou-mobile-ui`.

## Ports & adapters — where things go

**Backend** (`apps/backend`):
- `domain/` — entities (`Question`, `Answer`, `Exam`, `Category`, `Chapter`), invariants, Effect Schema. Pure.
- `application/` — use-cases as `Effect` values (`GetChapterQuestions`, `GetExam`). Depend on ports via the `R` channel.
- inbound adapter — **the @effect/rpc handlers** (`RpcGroup.toLayer`), served over **Hono** via `RpcServer`. Thin: a handler calls a use-case; typed errors travel over the wire.
- outbound adapters — `QuestionRepository` (Postgres `Layer` via `@effect/sql-drizzle`), `MediaUrls` (object-storage URL builder).

**Scraper** (`apps/scraper`): live site behind the `SourceGateway` Tag; writes via a `QuestionRepository` Postgres `Layer` (shares `packages/db`). See `perminou-scraping`.
**Mobile** (`apps/mobile`): the `@effect/rpc` client behind a `SyncClient` port, wrapped by `rpc-react` hooks. See `perminou-mobile-ui`.

## Example — @effect/rpc contract, handler, and the custom hook

```ts
// packages/rpc-contract/src/catalog.ts — the "router": RPC definitions, shared by server + client
export class CatalogRpcs extends RpcGroup.make(
  Rpc.make('ChapterQuestions', {
    payload: { chapterId: ChapterIdSchema },     // Effect Schema
    success: Schema.Array(Question),
    error: ChapterNotFound,                       // typed error travels over the wire
  }),
) {}
```

```ts
// apps/backend/src/catalog/adapters/inbound/catalog.handlers.ts — inbound adapter (thin)
export const CatalogHandlersLive = CatalogRpcs.toLayer({
  ChapterQuestions: ({ chapterId }) => getChapterQuestions(chapterId),  // returns the Effect use-case
});
// served over Hono: RpcServer.layer(CatalogRpcs) + RpcServer.layerProtocolHttp + RpcSerialization.layerJson
```

```ts
// packages/rpc-react — OUR library: a typed `api` proxy over the @effect/rpc client (tRPC-style DX)
// createRpcReact builds a nested Proxy from the contract: api.<namespace>.<rpc>.{ useQuery | useMutation | prefetch }
export const api = createRpcReact({ catalog: CatalogRpcs, exam: ExamRpcs });
// each leaf runs client[rpc._tag](payload) as an Effect → Promise for react-query; typed E rejects
```

```ts
// apps/mobile — same ergonomics as trpc.x.useQuery, zero tRPC, ONE import. Typed by rpc-contract.
const { data } = api.catalog.chapterQuestions.useQuery({ chapterId });
```

> `@effect/rpc` is `0.x` and mid-migration to v4 — exact signatures (`Rpc.make`, `toLayer`, `RpcServer`) may shift. The **contract** (payload/success/error schemas) is what's stable; keep churn inside `rpc-contract`/`rpc-react`.

## Common mistakes

- **Importing `@effect/rpc` in an app.** Apps import `rpc-react`/`rpc-contract` only, so 0.x churn hits one package.
- **Business logic in a handler.** The handler calls a use-case and lets typed errors flow. Logic lives in `application/`.
- **`domain` importing an adapter library.** Domain is pure TS + Effect Schema/Context only.
- **NestJS/tRPC.** Neither is used. Wiring is Layers + the `R` channel; the wire is `@effect/rpc`.
- **Duplicating types.** `Question` lives once in `packages/domain`; DB schema once in `packages/db`; RPC defs once in `packages/rpc-contract`.
- **Reintroducing an on-device dataset/bundle.** Offline = the persisted react-query cache, not a bundle (ADR 0003).

## Related skills

- `perminou-effect` — Tag/Layer/typed-errors + the @effect/rpc server/client bridge
- `perminou-scraping` — the `SourceGateway` port and hybrid engine → Postgres
- `perminou-testing` — how ports become test seams (fixtures, Testcontainers, rpc handler tests)
- `perminou-mobile-ui` — Expo + NativeWind + RNR + rpc-react persisted cache
