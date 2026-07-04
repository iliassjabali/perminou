# 0001 — Monorepo: pnpm + Turborepo

**Status:** Accepted

## Context

Scraper, backend, and mobile are all TypeScript and share three things: domain types (`Question`, `Category`…), the database schema, and the `@effect/rpc` API contract. If these live in separate repos they drift or require published npm packages with release overhead.

## Decision

One **pnpm + Turborepo** monorepo. Shared code lives in `packages/` (`domain`, `db`, `rpc-contract`, `rpc-react`); the three deliverables in `apps/` (`scraper`, `backend`, `mobile`). A change to a shared type or the API contract fails the dependent app's typecheck immediately.

## Consequences

- Single source of truth; no type duplication or drift.
- Turborepo caches builds/tests per package.
- One `pnpm install`, one Vitest style, one CI.

## Alternatives rejected

- **Polyrepo** — clean isolation but domain/schema types drift or need a published package + release cadence. Only justified for separate teams/owners; this is one owner.
- **Nx** — richer enforced module boundaries and generators, but heavier setup than needed here. Turborepo's simplicity wins for a 3-app repo.
