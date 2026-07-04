---
name: perminou-effect
description: Use when writing or reviewing any Effect code in the Perminou monorepo (scraper, backend, domain) — defining ports/adapters as Context.Tag + Layer, modeling typed errors with Data.TaggedError, retry/backoff with Schedule, resource safety with Scope, bounded concurrency, Effect Schema validation, or bridging Effect to the tRPC edge via ManagedRuntime. Applies whenever you see Effect<A, E, R>, Layer, Context.Tag, or a "which layer provides this" question.
---

# Perminou Effect Patterns

## Overview

Perminou is **all-in on Effect** (no NestJS). Effect isn't just a library here — it's how we *implement* hexagonal architecture. The mapping is exact:

| Hexagonal concept | Effect construct |
|---|---|
| Port (interface) | `Context.Tag<Service, Shape>` |
| Adapter (implementation) | `Layer` providing that Tag |
| "which ports does this need?" | the `R` channel of `Effect<A, E, R>` |
| "what can fail?" | the `E` channel — `Data.TaggedError` |
| Dependency rule enforcement | **the compiler** — can't run until every `R` is provided |

**Core principle:** if code depends on a port, that port appears in its `R` type. You physically cannot run it until a `Layer` provides that port. The dependency rule stops being a code-review convention and becomes a compile error.

## Ports & adapters

```ts
// PORT — interface + typed handle. Lives in domain/application. Depends on nothing concrete.
export class QuestionRepository extends Context.Tag('QuestionRepository')<
  QuestionRepository,
  { readonly questionsForChapter: (id: ChapterId) => Effect.Effect<Question[], DbError> }
>() {}

// ADAPTERS — different Layers, same Tag. Swap by providing a different Layer.
export const QuestionRepositoryLive = Layer.effect(
  QuestionRepository,
  Effect.gen(function* () {
    const sql = yield* PgClient;                    // depends on another port
    return { questionsForChapter: (id) => /* real Drizzle query, returns Effect */ };
  }),
);
export const QuestionRepositoryTest = Layer.succeed(
  QuestionRepository,
  { questionsForChapter: () => Effect.succeed(fakeQuestions) },
);
```

## Typed errors (the `E` channel)

```ts
import { Data } from 'effect';
export class ScrapeShapeError extends Data.TaggedError('ScrapeShapeError')<{
  url: string; reason: string; htmlSnippet: string;
}> {}
export class AuthError extends Data.TaggedError('AuthError')<{ status: number }> {}

// failures are values in the type, not thrown exceptions:
// Effect<Question, ScrapeShapeError | AuthError, SourceGateway>
```

Handle exhaustively with `Effect.catchTags({ ScrapeShapeError: ..., AuthError: ... })`. No silent `catch`.

## Resilience for the fragile scraper

```ts
import { Effect, Schedule, Duration } from 'effect';

// gentle retry with backoff + cap — declarative, not a hand-rolled loop
const gentle = Schedule.exponential(Duration.seconds(1)).pipe(
  Schedule.intersect(Schedule.recurs(4)),
);
const fetchWithRetry = (url: string) => fetchPage(url).pipe(Effect.retry(gentle));

// bounded concurrency — the "be gentle to NARSA" cap, built in
const pages = Effect.forEach(urls, fetchWithRetry, { concurrency: 2 });
```

## Resource safety for Playwright (`Scope`)

```ts
// browser is released even on interruption/failure — no leaked Chromium
const browser = Effect.acquireRelease(
  Effect.promise(() => chromium.launch()),
  (b) => Effect.promise(() => b.close()),
); // : Effect<Browser, never, Scope>
```

## Validation — Effect Schema (replaces Zod)

```ts
import { Schema } from 'effect';
export const Question = Schema.Struct({
  sourceUrl: Schema.String,
  text: Schema.NonEmptyString,
  lang: Schema.Literal('fr', 'ar'),
  answers: Schema.Array(Schema.Struct({ label: Schema.String, correct: Schema.Boolean })),
});
export type Question = Schema.Schema.Type<typeof Question>;
// decode at the boundary; failure is a typed ParseError in the E channel:
const parse = Schema.decodeUnknown(Question);
```

## Bridging to the tRPC edge

The tRPC router is a **thin inbound adapter**. It runs an Effect use-case through a `ManagedRuntime` (built once from the app's `MainLayer`) and maps the typed-error channel to tRPC errors.

```ts
const runtime = ManagedRuntime.make(MainLayer);   // MainLayer provides every port

export const catalogRouter = t.router({
  chapterQuestions: t.procedure
    .input(Schema.standardSchemaV1(ChapterIdSchema))   // Effect Schema as tRPC validator
    .query(({ input }) =>
      runtime.runPromise(
        getChapterQuestions(input).pipe(
          Effect.catchTag('ChapterNotFound', () =>
            Effect.fail(new TRPCError({ code: 'NOT_FOUND' })),
          ),
        ),
      ),
    ),
});
```

## Common mistakes

- **Mixing paradigms.** No NestJS DI, no `@Injectable`. Dependencies come from the `R` channel via Layers only.
- **`throw` inside an Effect.** Model failures as `Data.TaggedError` in the `E` channel.
- **A domain function importing a concrete adapter.** It depends on the `Context.Tag` (port); the adapter is provided as a `Layer` at the edge.
- **Building a `ManagedRuntime` per request.** Build it once from `MainLayer`; reuse it in the router.
- **Swallowing errors with a catch-all.** Use `catchTags` and handle each tagged error, or let it propagate typed.

## Related skills

- `perminou-architecture` — the monorepo + two-plane split this wires into
- `perminou-scraping` — `SourceGateway` as a Tag, Schedule/Scope in practice
- `perminou-testing` — providing a test `Layer` instead of mocks
- Global: `clean-hexagonal-architecture`, `typescript-best-practices`
