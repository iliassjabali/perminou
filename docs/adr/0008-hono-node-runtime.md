# 0008 — HTTP host: Hono + Node runtime

**Status:** Accepted

## Context

With NestJS out (ADR 0005), the backend needs something to host the `@effect/rpc` server. We also need a runtime that reliably runs Playwright + Testcontainers for the scraper.

## Decision

**Hono** hosts the `@effect/rpc` HTTP server (thin, runtime-agnostic, good middleware/routing headroom). **Node** is the runtime **throughout** (backend and scraper). No Bun.

## Consequences

- Hono keeps the host lightweight and portable.
- One runtime simplifies the monorepo; Node keeps Playwright + Testcontainers reliable.
- Backend could adopt a different runtime later behind Hono, but there's no plan to.

## Alternatives rejected

- **NestJS** — dropped with the Effect decision.
- **Bun** (runtime) — attractive speed, but Playwright and Testcontainers are Node-first; not worth the risk on the fragile scraper, and mixing runtimes complicates the monorepo.
- **Standalone `@effect/platform` HTTP only** — works, but Hono adds routing/middleware ergonomics at negligible cost.
