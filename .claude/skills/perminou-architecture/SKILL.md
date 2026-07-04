---
name: perminou-architecture
description: Use when adding a package/app, deciding where a class/interface/file belongs, wiring the backend↔mobile contract, or reviewing dependency direction in the Perminou monorepo (scraper, backend, mobile). Covers Turborepo layout, hexagonal ports & adapters implemented with Effect (Context.Tag/Layer), and the tRPC control-plane vs CDN data-plane split.
---

# Perminou Architecture

## Overview

Perminou is an offline-first *code de la route* (Moroccan driving-exam) prep app. A scraper harvests NARSA's question bank into an **immutable, versioned dataset**; a thin backend publishes dataset versions; an Expo app runs fully offline against a local copy.

**Stack:** all-in **Effect** (domain + scraper + backend) on **Node**, **tRPC** served by **Hono**, **Drizzle** ORM (`@effect/sql-drizzle` for Postgres; shared `sqliteTable` for scraper↔mobile), **Expo + NativeWind + React Native Reusables** mobile, **Vitest**, **pnpm + Turborepo**. No NestJS. Node runtime throughout (no Bun).

**Core principle:** the domain is pure and central. Everything touching the outside world (NARSA's HTML, Postgres, tRPC, expo-sqlite) is an **adapter behind a port**, and in Effect a port is a `Context.Tag` and an adapter is a `Layer`. Dependencies point inward — enforced by the `R` channel of `Effect<A, E, R>`, so a missing/mis-wired adapter is a compile error, not a runtime crash. See `perminou-effect`.

## Monorepo layout (pnpm + Turborepo)

```
perminou/
  packages/
    domain/        # SINGLE SOURCE OF TRUTH: entities + Effect Schema + dataset/manifest contract + ports (Tags)
    api-contract/  # exported AppRouter type (tRPC) — mobile imports this, no codegen
  apps/
    scraper/       # hybrid Playwright + HTTP crawler → dataset artifact (Effect)
    backend/       # thin Effect backend: tRPC router (inbound adapter) + version manifest + bundle storage
    mobile/        # Expo (NativeWind + React Native Reusables), offline-first
  docs/adr/        # architecture decision records
```

`packages/domain` imports **nothing** from Playwright, Postgres drivers, tRPC, or expo. It may use `effect` (Schema, Context, Data). If you import an I/O library into `domain`, the boundary is wrong.

## The two-plane rule (why the app is fast on bad networks)

| Plane | Carries | Transport | Why |
|---|---|---|---|
| **Control** | manifest metadata (latest version, checksum, `bundleUrl`), later progress sync | **tRPC** (typed) | tiny payloads, end-to-end type safety, no hand-written client |
| **Data** | the dataset bundle (SQLite file + media) | **plain HTTP / CDN** | large immutable binary — needs caching, resumable/edge delivery; must NOT stream through tRPC |

A tRPC procedure returns the bundle's URL + checksum; the app downloads the bundle directly. tRPC carries *metadata, not megabytes*.

## Ports & adapters — where things go

**Backend** (`apps/backend`):
- `domain/` — entities (`Question`, `Answer`, `Exam`, `DatasetVersion`), invariants, Effect Schema. Pure.
- `application/` — use-cases as `Effect` values (`ResolveLatestDataset`, `RecordProgress`). Depend on ports (Tags) via the `R` channel.
- inbound adapter — **the tRPC router**, mounted on a **Hono** server (`@hono/trpc-server`): thin. Runs a use-case via `ManagedRuntime`, maps the `E` channel to tRPC errors. No business logic.
- outbound adapters — `DatasetRepository` (Postgres `Layer` via `@effect/sql-drizzle`), `BundleStorage` (object storage `Layer`).

**Scraper** (`apps/scraper`): live site behind the `SourceGateway` Tag — see `perminou-scraping`.
**Mobile** (`apps/mobile`): expo-sqlite behind `LocalDatasetStore`, tRPC client behind `SyncClient` — see `perminou-mobile-ui`.

## Example — the tRPC router is *just an inbound adapter* over an Effect use-case

```ts
// apps/backend/src/dataset/application/resolve-latest-dataset.ts
// PURE application layer. Its type declares the ports it needs (R) and how it can fail (E).
export const resolveLatestDataset: Effect.Effect<
  DatasetManifest, NoDatasetPublished, DatasetRepository | BundleStorage
> = Effect.gen(function* () {
  const repo = yield* DatasetRepository;          // port
  const storage = yield* BundleStorage;           // port
  const version = yield* repo.findLatest();
  if (!version) return yield* Effect.fail(new NoDatasetPublished());
  return {
    version: version.number,
    checksum: version.checksum,
    bundleUrl: yield* storage.signedUrl(version.bundleKey),
    questionCount: version.questionCount,
    schemaVersion: version.schemaVersion,
  };
});

// apps/backend/src/dataset/adapters/inbound/dataset.router.ts
// THIN inbound adapter. Swap tRPC for @effect/rpc without touching the use-case.
const runtime = ManagedRuntime.make(MainLayer);   // MainLayer provides DatasetRepository + BundleStorage
export const datasetRouter = t.router({
  getManifest: t.procedure.query(() =>
    runtime.runPromise(
      resolveLatestDataset.pipe(
        Effect.catchTag('NoDatasetPublished', () => Effect.fail(new TRPCError({ code: 'NOT_FOUND' }))),
      ),
    ),
  ),
});
export type AppRouter = typeof datasetRouter;      // re-exported via packages/api-contract
```

```ts
// apps/mobile — client fully typed by AppRouter, zero codegen
const manifest = await trpc.dataset.getManifest.query();
// manifest.bundleUrl is downloaded via plain fetch, NOT through tRPC
```

## Common mistakes

- **Business logic in the tRPC router.** The router runs a use-case and maps errors. Logic lives in `application/`.
- **Streaming the bundle through tRPC.** Never. tRPC returns the URL; the app fetches the binary from CDN.
- **`domain` importing an adapter library.** Domain is pure TS + Effect Schema/Context only.
- **NestJS-style DI or `@Injectable`.** Wiring is Layers + the `R` channel. See `perminou-effect`.
- **Duplicating types across apps.** A `Question` is defined once in `packages/domain`.
- **Mutating a published dataset version.** Versions are immutable, append-only (v1, v2…). A fix is a new version.

## Related skills

- `perminou-effect` — Tag/Layer/typed-errors mechanics (read this to implement the above)
- `perminou-scraping` — the `SourceGateway` port and hybrid engine
- `perminou-testing` — how ports become test seams (fixtures, Testcontainers, tRPC caller)
- `perminou-mobile-ui` — Expo offline-first + NativeWind + React Native Reusables
