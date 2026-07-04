---
name: perminou-testing
description: Use when writing or reviewing any test in the Perminou monorepo, choosing a test layer, or setting up Vitest, Testcontainers, or @effect/rpc handler tests. Covers the per-layer strategy, the "tests never hit live NARSA" fixture-quarantine rule, providing Effect test Layers instead of mocks, Testcontainers Postgres for outbound adapters, @effect/rpc handler contract tests, and TDD red-green-refactor. Applies to scraper, backend, and mobile.
---

# Perminou Testing

## Overview

**Runner is Vitest everywhere** (not Jest) — ESM-native, fast, one config style across `packages/domain`, scraper, backend, and mobile. TDD throughout: write the failing test first, watch it fail for the right reason, then implement.

**Core principle:** tests are deterministic because the outside world lives behind ports. In Effect that means you **provide a test `Layer`** for a port instead of mocking. Live NARSA, real Postgres, and the network are replaced by fixture Layers and ephemeral containers. The port seam from `perminou-architecture` IS the test seam.

## Per-layer strategy

| Unit | What to test | How | Real I/O? |
|---|---|---|---|
| `packages/domain` | Effect Schema, entity invariants, scoring rules | pure Vitest | no |
| `apps/scraper` | normalization/parsing | provide `SourceGatewayFixture` + recorded HTML | **no** |
| `apps/scraper` | source drift | opt-in drift test, manual/nightly, fails loud | yes (isolated) |
| `apps/backend` | domain + use-cases | pure Vitest, provide fake port `Layer`s | no |
| `apps/backend` | repo/storage adapters | **Testcontainers Postgres** + migrations | ephemeral DB |
| `apps/backend` | @effect/rpc handlers | call the handler `Layer` directly | ephemeral DB |
| `apps/mobile` | logic/hooks, cached queries | Vitest + RN Testing Library, mocked rpc-react | no |
| `apps/mobile` | server contract | **compile-time** via shared `rpc-contract` types | n/a |

## The one rule that matters most

**No test in the default suite touches the live NARSA site.** It's quarantined behind `SourceGateway` and fed recorded fixtures. The single exception is the opt-in drift test (see `perminou-scraping`), which is not part of `pnpm test`.

## Example — use-case with a test Layer (pure, fast)

```ts
// apps/backend/test/resolve-latest-dataset.test.ts (Vitest)
import { Effect, Layer } from 'effect';
import { resolveLatestDataset } from '../src/dataset/application/resolve-latest-dataset';
import { DatasetRepository, BundleStorage } from '@perminou/domain';

test('returns a manifest with a signed bundle url for the latest version', async () => {
  const repoLayer = Layer.succeed(DatasetRepository, {
    findLatest: () => Effect.succeed({ number: 3, checksum: 'abc', bundleKey: 'v3.sqlite', questionCount: 900, schemaVersion: 1 }),
  });
  const storageLayer = Layer.succeed(BundleStorage, {
    signedUrl: (k: string) => Effect.succeed(`https://cdn/${k}?sig=x`),
  });

  const manifest = await Effect.runPromise(
    resolveLatestDataset.pipe(Effect.provide(Layer.merge(repoLayer, storageLayer))),
  );

  expect(manifest.version).toBe(3);
  expect(manifest.bundleUrl).toContain('v3.sqlite');
});
```

The `R` channel makes this safe: if `resolveLatestDataset` needs a port you forgot to provide, **it won't compile** — the test can't lie about its dependencies.

## Example — outbound adapter with Testcontainers (real Postgres, ephemeral)

```ts
// apps/backend/test/dataset.repository.int.test.ts (Vitest)
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Effect } from 'effect';

let container: Awaited<ReturnType<PostgreSqlContainer['start']>>;
beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16').start();
  await runMigrations(container.getConnectionUri());   // real migrations
}, 60_000);
afterAll(() => container.stop());

test('findLatest returns the highest version number', async () => {
  const program = Effect.gen(function* () {
    const repo = yield* DatasetRepository;
    yield* repo.save(datasetVersion({ number: 1 }));
    yield* repo.save(datasetVersion({ number: 2 }));
    return yield* repo.findLatest();
  });
  const latest = await Effect.runPromise(program.pipe(Effect.provide(DatasetRepositoryLive(container.getConnectionUri()))));
  expect(latest?.number).toBe(2);
});
```

## Example — @effect/rpc handler test (no HTTP, real DB)

```ts
// apps/backend/test/catalog.handlers.test.ts (Vitest)
import { Effect, Layer } from 'effect';
import { getChapterQuestions } from '../src/catalog/application/get-chapter-questions';

test('ChapterQuestions returns a chapter's questions', async () => {
  const program = getChapterQuestions(chapterId).pipe(
    Effect.provide(QuestionRepositoryLive(container.getConnectionUri())),
  );
  const questions = await Effect.runPromise(program);
  expect(questions.length).toBeGreaterThan(0);
});

test('ChapterQuestions fails typed when the chapter is missing', async () => {
  const exit = await Effect.runPromiseExit(
    getChapterQuestions(missingId).pipe(Effect.provide(QuestionRepositoryTest)),
  );
  expect(exit._tag).toBe('Failure');   // ChapterNotFound in the E channel
});
```

Test the **use-case Effect** directly (that's where the logic is); the `@effect/rpc` handler is a one-line delegate, so an HTTP round-trip test adds little. The **mobile** side needs no runtime contract test: the shared `rpc-contract` `RpcGroup` types the client, so a server/client mismatch is a **typecheck failure**.

## TDD red-green-refactor here

1. **Red** — write the test against the port/Tag. For the scraper, record (or hand-write) the fixture HTML first, then assert the parse. Run it; confirm it fails because the code doesn't exist yet.
2. **Green** — minimal implementation to pass.
3. **Refactor** — clean up with the test green.

## Common mistakes

- **Reaching the network in a unit test.** Wrong seam — provide a fixture `Layer`.
- **Mocking the DB.** Don't. Use a real ephemeral Postgres via Testcontainers; mocks hide SQL/migration bugs.
- **Mocking Effect services by hand.** Provide a `Layer.succeed(Tag, impl)` instead — same seam the app uses.
- **Writing a mobile "contract test" that re-declares server types.** The shared `rpc-contract` `RpcGroup` guarantees it at compile time.
- **Putting the drift test in `pnpm test`.** It's opt-in and allowed to fail; keep it out of the default suite.
- **Asserting on incidental HTML.** Assert on extracted domain values, not on markup that changes.

## Related skills

- `perminou-effect` — Layers as test seams
- `perminou-architecture` — ports are the test seams
- `perminou-scraping` — fixtures + drift test
