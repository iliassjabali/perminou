# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Perminou is

A **mobile app for practicing the Moroccan driving-license theory exam** (*code de la route*). A scraper harvests NARSA's official question bank (`perminou.narsa.gov.ma`, a Django site) into **Postgres**; a backend serves it via a typed API; an **Expo** app fetches it live and **persists its react-query cache** so previously-loaded content stays usable offline.

**Not offline-first** (no bundled dataset, no on-device DB, no sync). It's **online with an offline-capable cache**: react-query persistence + a first-launch prefetch make it *behave* offline-first while staying a live API app.

> Status: **built** — the full stack runs locally (scraper → 385 questions in Postgres → `@effect/rpc` backend → Expo Tinder app). See `README.md` "Run the full stack" and **`docs/STATUS.md`** for the complete build journey, decisions, and known follow-ups. Decisions are in `docs/adr/` (0001–0008).

## Stack (decided)

- **Paradigm:** TypeScript, **all-in on Effect** (backend + scraper + domain; no NestJS) — Effect implements hexagonal architecture (`Context.Tag` = port, `Layer` = adapter, `R` channel enforces the dependency rule at compile time).
- **Runtime:** **Node** throughout. No Bun.
- **HTTP host:** **Hono** serving the **`@effect/rpc`** handlers (`RpcServer`). No tRPC.
- **API + client data:** **`@effect/rpc`** on the wire (typed errors end-to-end) + a **custom `rpc-react`** library exposing a typed `api` proxy over `@tanstack/react-query` (tRPC-style DX, one import). App never imports `@effect/rpc` directly. See ADR 0007.
- **Validation:** Effect **Schema** (not Zod). Used for domain entities and `@effect/rpc` payload/success/error.
- **ORM:** **Drizzle** on Postgres via **`@effect/sql-drizzle`** (queries run as Effects); migrations via **`drizzle-kit`**. The `pgTable` schema is defined once in `packages/db` and shared by scraper (writes) and backend (reads). NOT Prisma.
- **Mobile:** **Expo** + **NativeWind** (Tailwind for RN) + **React Native Reusables** (shadcn-for-RN). react-query **persisted cache** (MMKV) + **`expo-image`** disk cache for offline capability.
- **Data:** scraper = **Playwright (auth) + HTTP bulk (got/cheerio)** → **Postgres**; images → object storage/CDN (stored as URLs).
- **Tests:** **Vitest** everywhere; **Testcontainers** for real Postgres.
- **Monorepo:** **pnpm + Turborepo**.

## Monorepo layout

```
packages/
  domain/        # entities + Effect Schema + ports (Tags). Pure — no I/O libs.
  db/            # shared Drizzle pgTable schema + drizzle-kit migrations (scraper writes, backend reads)
  rpc-contract/  # @effect/rpc RpcGroup defs (Effect Schema) — shared by backend + mobile
  rpc-react/     # custom lib: typed `api` proxy (react-query hooks) over the @effect/rpc client
apps/
  scraper/       # hybrid crawler → writes the question bank into Postgres (Effect)
  backend/       # Effect + Hono; serves @effect/rpc handlers from Postgres
  mobile/        # Expo online app; persisted react-query cache = offline capability
docs/adr/        # architecture decision records
```

## Non-negotiable rules

1. **Dependency rule.** `packages/domain` imports no I/O library (Playwright, pg, `@effect/rpc`, expo). Adapters depend on the domain, never the reverse. A use-case declares its ports in its `R` channel.
2. **Tests never hit live NARSA.** The site is quarantined behind the `SourceGateway` port and fed recorded fixtures. The only live-touching check is the opt-in **drift test** (not in `pnpm test`).
3. **Scraper is gentle & resilient.** Bounded concurrency + backoff (`Schedule`), resource-safe browsers (`Scope`), resumable/idempotent, fail-loud typed errors, **survives session expiry** (re-auth on redirect-to-signin).
4. **Offline capability = cache, not bundle.** The app is online; react-query persistence + a first-launch prefetch provide offline use of already-fetched content. Do not reintroduce an on-device dataset/bundle without an ADR.
5. **Scaffold, don't hand-write boilerplate.** Before creating a new backend feature, domain entity, or mobile screen, run `pnpm plop` (see `perminou-scaffolding`). Hand-writing the file-shape is the exception. The only code you write by hand is the logic that fills the generated `// TODO`s.
6. **Correct answers are revealed by the exam correction, marked by 1-based INDEX** (not the answer's DB id) — spike resolved, ADR 0002 finalized. Question ids can be alphanumeric (signage sub-bank) so `QuestionId` is a string. Media is public.

## Commands

```
pnpm install
pnpm test                     # vitest across the monorepo (NEVER touches live NARSA)
pnpm typecheck                # turbo tsc --noEmit, all packages
docker compose up -d db       # local Postgres
pnpm --filter @perminou/scraper db:migrate   # apply Drizzle migrations
docker exec -i perminou-db psql -U perminou -d perminou < packages/db/seed/perminou-questions.sql  # seed 385 Qs
pnpm --filter @perminou/backend dev          # @effect/rpc API on :3000 (health + /rpc + CORS)
pnpm --filter mobile start    # Expo — web http://localhost:8081 · phone exp://<lan-ip>:8081 (set apps/mobile/.env EXPO_PUBLIC_API_URL=http://<lan-ip>:3000)
pnpm --filter @perminou/scraper scrape   # re-harvest into Postgres (needs NARSA creds in .env)
pnpm --filter @perminou/scraper drift    # opt-in live drift test (allowed to fail loud)
pnpm plop <feature|entity|screen>        # scaffold boilerplate (see perminou-scaffolding)
```

## Skills for this repo (`.claude/skills/`)

- **perminou-scaffolding** — `pnpm plop` generators. Read BEFORE hand-writing a new feature/entity/screen.
- **perminou-effect** — Tag/Layer/typed-errors, Schedule, Scope, Schema, @effect/rpc bridge. Read first for any Effect code.
- **perminou-architecture** — monorepo layout, ports & adapters, online @effect/rpc API + rpc-react client.
- **perminou-scraping** — hybrid engine, `SourceGateway`, session re-auth, fixtures, drift test.
- **perminou-testing** — Vitest, test Layers, Testcontainers, @effect/rpc handler tests.
- **perminou-mobile-ui** — Expo + NativeWind + RNR, rpc-react persisted cache, offline-via-cache.

## Workflow

Follow the user's global workflow: Spec → TDD (red-green-refactor, Vitest) → subagent-driven execution. Invoke `clean-hexagonal-architecture` and `typescript-best-practices` for structural/type work. `docs/adr/` holds decision records.
