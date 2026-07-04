# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Perminou is

An **offline-first mobile app for practicing the Moroccan driving-license theory exam** (*code de la route*). A scraper harvests NARSA's official question bank (`perminou.narsa.gov.ma`, a Django site) into an **immutable, versioned dataset**; a thin backend publishes dataset versions; an **Expo** app runs 100% offline against a local copy and pulls newer versions when online.

> Status: greenfield. The monorepo below is the target structure; scaffold it before implementing. Decisions are recorded in `docs/adr/`.

## Stack (decided)

- **Paradigm:** TypeScript, **all-in on Effect** (no NestJS) — Effect implements hexagonal architecture (`Context.Tag` = port, `Layer` = adapter, `R` channel enforces the dependency rule at compile time).
- **Runtime:** **Node** throughout (backend and scraper). No Bun. Playwright + Testcontainers are Node-first; one runtime keeps the monorepo simple.
- **HTTP host:** **Hono** (lightweight, runtime-agnostic) serving the **tRPC** router. Effect-backed resolvers via `ManagedRuntime`. Control-plane only.
- **Validation:** Effect **Schema** (not Zod).
- **ORM:** **Drizzle**. Backend Postgres via **`@effect/sql-drizzle`** (queries run as Effects). Migrations via **`drizzle-kit`**. The dataset bundle's `sqliteTable` schema is defined **once and shared** by scraper (`better-sqlite3`) and mobile (`drizzle-orm/expo-sqlite`) — no scraper↔mobile drift. NOT Prisma.
- **Mobile:** **Expo** + **NativeWind** (Tailwind for RN) + **React Native Reusables** (shadcn-for-RN, copy-paste/owned).
- **Data:** scraper = **Playwright (auth) + HTTP bulk (got/cheerio)** → `dataset-vN.sqlite`; backend persistence = **Postgres** (version manifest, later progress); on-device = **expo-sqlite**.
- **Tests:** **Vitest** everywhere; **Testcontainers** for real Postgres.
- **Monorepo:** **pnpm + Turborepo**.

## Monorepo layout

```
packages/
  domain/        # SINGLE SOURCE OF TRUTH: entities + Effect Schema + dataset/manifest contract + ports (Tags). Pure.
  api-contract/  # exported tRPC AppRouter type; mobile imports it (no codegen)
apps/
  scraper/       # hybrid crawler → immutable dataset-vN.sqlite + /media + manifest.json (Effect)
  backend/       # thin Effect backend: tRPC router (inbound adapter) + version manifest + bundle storage
  mobile/        # Expo offline-first app
docs/adr/        # architecture decision records
```

## Non-negotiable rules

1. **Dependency rule.** `packages/domain` imports no I/O library (Playwright, pg, tRPC, expo). Adapters depend on the domain, never the reverse. A use-case declares its ports in its `R` channel.
2. **Two planes.** tRPC carries *metadata* (manifest, progress). The large dataset **bundle** is downloaded from **plain HTTP/CDN** via a URL tRPC returns — never streamed through tRPC.
3. **Immutable datasets.** Published versions (v1, v2…) are never mutated. A fix is a new version.
4. **Tests never hit live NARSA.** The site is quarantined behind the `SourceGateway` port and fed recorded fixtures. The only live-touching check is the opt-in **drift test** (not in `pnpm test`).
5. **Scraper is gentle.** Bounded concurrency + backoff (`Schedule`), resource-safe browsers (`Scope`), resumable/idempotent, fail-loud with typed errors.
6. **Open question to resolve first:** are quiz answers in the DOM or only revealed after submitting? Decides scraper complexity — spike before building (ADR 0002).

## Commands (target — adjust as scaffolding lands)

```
pnpm install
pnpm dev                 # turbo: run app/backend dev
pnpm test                # vitest across the monorepo (NEVER touches live NARSA)
pnpm --filter scraper drift   # opt-in drift test against the live site (allowed to fail loud)
pnpm --filter scraper scrape  # run the scrape → emit dataset-vN
pnpm --filter mobile start    # Expo dev server
```

## Skills for this repo (`.claude/skills/`)

- **perminou-effect** — Tag/Layer/typed-errors, Schedule, Scope, Schema, tRPC bridge. Read first for any Effect code.
- **perminou-architecture** — monorepo layout, ports & adapters, two-plane split.
- **perminou-scraping** — hybrid engine, `SourceGateway`, fixtures, drift test.
- **perminou-testing** — Vitest, test Layers, Testcontainers, tRPC caller.
- **perminou-mobile-ui** — Expo + NativeWind + RNR, offline-first sqlite, sync flow.

## Workflow

Follow the user's global workflow: Spec → TDD (red-green-refactor, Vitest) → subagent-driven execution. Invoke `clean-hexagonal-architecture` and `typescript-best-practices` for structural/type work. `docs/adr/` holds decision records.
