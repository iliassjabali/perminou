# 0005 — All-in Effect (no NestJS)

**Status:** Accepted

## Context

We want hexagonal boundaries that are *enforced*, typed errors, and a resilient scraper (retries, resource safety, bounded concurrency). Options ranged from NestJS (framework, convention-enforced boundaries) to Effect (library, type-enforced boundaries).

## Decision

**All-in Effect** across `domain`, `scraper`, and `backend`. Effect *implements* hexagonal architecture: `Context.Tag` = port, `Layer` = adapter, and the `R` channel of `Effect<A, E, R>` makes a missing/mis-wired adapter a **compile error**. `Data.TaggedError` puts failures in the typed `E` channel; `Schedule`/`Scope`/bounded concurrency give the scraper resilience and resource safety for free.

## Consequences

- The dependency rule is compiler-enforced, not a code-review convention.
- Typed errors end-to-end; no `throw`/`catch` guessing.
- **Learning curve** is the main cost and the biggest schedule risk — mitigated by the `perminou-effect` skill and keeping wire schemas simple.
- Sets aside the existing NestJS tooling/skills.

## Alternatives rejected

- **NestJS** — mature, batteries-included, matches existing skills, but boundaries hold only by convention and typed errors aren't first-class. The thin API surface doesn't need its weight.
- **Effect inside NestJS** — two DI systems, worst of both. Rejected.
