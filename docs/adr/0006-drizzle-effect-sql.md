# 0006 — ORM: Drizzle + @effect/sql-drizzle on Postgres

**Status:** Accepted

## Context

The backend serves the question bank from Postgres; the scraper writes it there. We want a typed query builder, real migrations, and clean Effect integration behind the repository ports.

## Decision

**Drizzle**. The `pgTable` schema + `drizzle-kit` migrations live once in **`packages/db`**, shared by scraper (writes) and backend (reads). Queries execute via **`@effect/sql-drizzle`** so they run as Effects (typed errors, resource-safe connections, Layers) behind the `QuestionRepository` port.

## Consequences

- One schema definition shared scraper↔backend; no drift.
- Typed queries run as Effects; migrations via `drizzle-kit`.
- ORM stays an adapter detail — only `QuestionRepositoryLive` and `packages/db` import Drizzle; the domain never does.

## Alternatives rejected

- **`@effect/sql-pg` only** (raw SQL + Schema decode) — maximally Effect-native and viable for a small schema, but no query builder or migration DSL; loses the shared typed schema.
- **Prisma** — heavy engine, own DSL, no first-class Effect integration, generated client fights hexagonal boundaries.
- **Kysely** — good query builder, but less official Effect integration than `@effect/sql-drizzle`.
