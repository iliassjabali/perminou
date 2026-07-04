# Perminou

A mobile app for practicing the **Moroccan driving-license theory exam** (*code de la route*). A scraper harvests NARSA's official question bank ([`perminou.narsa.gov.ma`](https://perminou.narsa.gov.ma)) into Postgres; a typed API serves it; an Expo app fetches it live and **persists its cache** so already-loaded content works offline.

> **Personal-use project.** Not affiliated with NARSA; no public redistribution of its content.

## Overview

- **Online with an offline-capable cache** — not offline-first. The app is live (typed RPC) but persists its react-query cache (MMKV) and prefetches on first launch, so it *behaves* offline-first without a bundle or on-device DB. ([ADR 0003](docs/adr/0003-online-first-cached.md))
- **All-in [Effect](https://effect.website)** — Effect implements hexagonal architecture: ports are `Context.Tag`, adapters are `Layer`, and the `R` channel makes the dependency rule a compile error. No NestJS. ([ADR 0005](docs/adr/0005-all-in-effect.md))
- **`@effect/rpc` + a custom `rpc-react`** — typed errors end-to-end, wrapped in an owned library that gives a one-import, tRPC-style `api` proxy. No tRPC. ([ADR 0007](docs/adr/0007-effect-rpc-custom-rpc-react.md))

```
NARSA HTML ──scraper (Playwright+HTTP)──► Postgres ──backend (@effect/rpc over Hono)──► Expo app
                                                                                         │
                                              rpc-react (typed api proxy + react-query) ─┤ MMKV persisted cache
                                              expo-image ──────────────────────────────── ┘ image disk cache
```

## Monorepo layout

```
packages/
  domain/        # entities + Effect Schema + ports (Tags). Pure — no I/O.        [built]
  db/            # shared Drizzle pgTable schema + migrations (scraper↔backend)    [built]
  rpc-contract/  # @effect/rpc RpcGroup defs (Effect Schema) — shared server+client [pending]
  rpc-react/     # custom lib: typed `api` proxy (react-query) over the client      [pending]
apps/
  scraper/       # hybrid Playwright + HTTP crawler → writes the bank into Postgres [pending]
  backend/       # Effect + Hono; serves @effect/rpc handlers from Postgres         [pending]
  mobile/        # Expo online app; persisted react-query cache = offline           [pending]
```

## Tech stack

| Concern | Choice | ADR |
|---|---|---|
| Monorepo | pnpm + Turborepo | [0001](docs/adr/0001-monorepo-pnpm-turborepo.md) |
| Paradigm | all-in Effect (no NestJS) | [0005](docs/adr/0005-all-in-effect.md) |
| Runtime | Node 24 (no Bun) | [0008](docs/adr/0008-hono-node-runtime.md) |
| HTTP host | Hono | [0008](docs/adr/0008-hono-node-runtime.md) |
| API / client | `@effect/rpc` + custom `rpc-react` (react-query) | [0007](docs/adr/0007-effect-rpc-custom-rpc-react.md) |
| Validation | Effect Schema | — |
| ORM | Drizzle + `@effect/sql-drizzle` (Postgres) | [0006](docs/adr/0006-drizzle-effect-sql.md) |
| Scraper | Playwright (auth) + HTTP bulk | [0002](docs/adr/0002-hybrid-scraping-engine.md) |
| Mobile | Expo + NativeWind + React Native Reusables | [0004](docs/adr/0004-expo-nativewind-rnr.md) |
| Tests | Vitest + Testcontainers | — |

## Getting started

**Prerequisites:** Node ≥ 24, pnpm ≥ 9, Docker (for local Postgres + the integration tests).

```bash
pnpm install
cp .env.example .env
docker compose up -d db   # local Postgres for dev + migrations (tests use their own ephemeral DB)
pnpm test                 # Vitest across the monorepo (never touches live NARSA)
pnpm typecheck
```

### Scaffolding (write less boilerplate)

Every feature has the same file-shape, so generate it — don't hand-write it ([`perminou-scaffolding`](.claude/skills/perminou-scaffolding/SKILL.md)):

```bash
pnpm plop feature   # backend slice: @effect/rpc def + Effect use-case + handler + failing test
pnpm plop entity    # domain Effect-Schema entity + failing test
pnpm plop screen    # Expo screen wired to the api proxy
```

You fill only the logic; the file-shape, imports, and export-wiring are generated.

## Status

| Area | State |
|---|---|
| Monorepo scaffold, `packages/domain` (entities, ports) | ✅ built, tested |
| plop generators | ✅ ready |
| `packages/db` (Postgres schema + `QuestionRepository`) | ✅ built, tested (Testcontainers) |
| Scraper | 🔜 blocked on the answers-in-DOM spike ([ADR 0002](docs/adr/0002-hybrid-scraping-engine.md)) |
| Backend / rpc-react / mobile | 🔜 planned |

## Documentation

- **[CLAUDE.md](CLAUDE.md)** — working agreement, stack, rules, commands.
- **[docs/adr/](docs/adr/)** — architecture decision records (0001–0008), each with alternatives rejected.
- **[docs/superpowers/specs/](docs/superpowers/specs/)** — the design spec.
- **[docs/superpowers/plans/](docs/superpowers/plans/)** — TDD implementation plans.
- **[.claude/skills/](.claude/skills/)** — `perminou-*` skills: architecture, effect, scraping, testing, mobile-ui, scaffolding.
