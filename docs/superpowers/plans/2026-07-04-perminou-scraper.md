# Perminou Scraper Implementation Plan (Plan 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. REQUIRED READING before any task: the `perminou-scraping` and `perminou-effect` skills, and ADR 0002.

**Goal:** Harvest NARSA's driving-exam question bank into Postgres — driving the Examen-Blanc loop with Playwright (correct answers via the correction), fetching public media by ID, upserting keyed on the NARSA question id.

**Architecture:** Effect + hexagonal. The live site sits behind the `SourceGateway` port (Playwright adapter, service workers disabled). Normalization is pure and fixture-tested. Media is fetched anonymously over HTTP. A loop-until-dry orchestrator dedups by question id and upserts into Postgres via the existing `QuestionRepository`.

**Tech Stack:** Effect (Schedule/Scope/Data.TaggedError/Schema), Playwright, got, cheerio, Drizzle + `@effect/sql-drizzle`, Vitest + Testcontainers, Node 24.

## Global Constraints

- Node only. `@perminou/*`. All-in Effect. Effect Schema (not Zod). Vitest.
- Domain stays pure (no Playwright/pg imports). Live site ONLY behind `SourceGateway`.
- **Tests never hit live NARSA.** Fixtures only; the drift test is opt-in and out of `pnpm test`.
- Playwright launches with **service workers disabled** (the PWA offline fallback trips otherwise — ADR 0002).
- Gentle: bounded concurrency + `Schedule` backoff; resumable/idempotent.
- Media is PUBLIC — fetch over HTTP with no session.
- Upsert identity = **NARSA numeric question id** (resolves ADR 0006's upsert-invariant follow-up).
- Credentials from `.env` (`NARSA_USERNAME` / `NARSA_PASSWORD`), never committed, never logged.
- Commit after every green step.

## Confirmed data shape (ADR 0002 spike)

A question = numeric id + optional image + optional audio + 2–4 **numbered, multi-select** answers. The prompt/answer meaning is in the media. Media URL: `/media/uploads/questions/{images|son}/{fr|ar}/{id}.{png|mp3}`. Correct answers come from completing an exam (the correction), not the question HTML.

---

### Task 1: Revise the domain model to the real shape

**Files:**
- Rewrite: `packages/domain/src/entities.ts`
- Modify: `packages/domain/src/ports.ts` (repository signature), `packages/domain/src/ids.ts`
- Test: `packages/domain/test/entities.test.ts` (rewrite)

**Interfaces:**
- Produces:
  - `QuestionId = number & Brand`.
  - `Answer` = `{ narsaId: number; index: number; correct: boolean }` (index is the 1..4 label; multi-select ⇒ 0+ correct).
  - `Question` = `{ id: QuestionId; category: string; hasImage: boolean; hasAudio: boolean; answers: Answer[] }`.
  - `mediaUrl(kind: 'image'|'sound', lang: 'fr'|'ar', id: QuestionId): string` — pure URL builder.
  - `decodeQuestion = Schema.decodeUnknown(Question)`.
  - `QuestionRepository.upsertQuestion(q: Question)` + `questionsByCategory(category: string)` (replaces `questionsForChapter`; chapters aren't enumerable).

- [ ] **Step 1: Rewrite the failing tests**

```ts
// packages/domain/test/entities.test.ts
import { test, expect } from 'vitest';
import { Effect, Either, Schema } from 'effect';
import { Question, decodeQuestion, mediaUrl } from '../src/entities';

const valid = { id: 565, category: 'B', hasImage: true, hasAudio: true,
  answers: [ { narsaId: 933, index: 1, correct: true }, { narsaId: 934, index: 2, correct: false },
             { narsaId: 935, index: 3, correct: true }, { narsaId: 936, index: 4, correct: false } ] };

test('decodes a valid multi-select question', () => {
  const q = Schema.decodeUnknownSync(Question)(valid);
  expect(q.answers.filter((a) => a.correct)).toHaveLength(2);
});
test('rejects a non-integer id', async () => {
  const r = await Effect.runPromise(Effect.either(decodeQuestion({ ...valid, id: 1.5 })));
  expect(Either.isLeft(r)).toBe(true);
});
test('builds media urls by id + lang', () => {
  expect(mediaUrl('image', 'fr', 565 as never)).toBe('/media/uploads/questions/images/fr/565.png');
  expect(mediaUrl('sound', 'ar', 800 as never)).toBe('/media/uploads/questions/son/ar/800.mp3');
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `pnpm test packages/domain`
Expected: FAIL (new exports don't exist yet).

- [ ] **Step 3: Implement the revised entities + ids**

```ts
// packages/domain/src/ids.ts
import { Schema } from 'effect';
export const QuestionId = Schema.Int.pipe(Schema.brand('QuestionId'));
export type QuestionId = Schema.Schema.Type<typeof QuestionId>;
```

```ts
// packages/domain/src/entities.ts
import { Schema } from 'effect';
import { QuestionId } from './ids';

export const Lang = Schema.Literal('fr', 'ar');
export type Lang = Schema.Schema.Type<typeof Lang>;

export const Answer = Schema.Struct({
  narsaId: Schema.Int, index: Schema.Int, correct: Schema.Boolean,
});
export type Answer = Schema.Schema.Type<typeof Answer>;

export const Question = Schema.Struct({
  id: QuestionId,
  category: Schema.NonEmptyString,
  hasImage: Schema.Boolean,
  hasAudio: Schema.Boolean,
  answers: Schema.Array(Answer),
});
export type Question = Schema.Schema.Type<typeof Question>;
export const decodeQuestion = Schema.decodeUnknown(Question);

const MEDIA = '/media/uploads/questions';
export const mediaUrl = (kind: 'image' | 'sound', lang: Lang, id: QuestionId): string =>
  kind === 'image' ? `${MEDIA}/images/${lang}/${id}.png` : `${MEDIA}/son/${lang}/${id}.mp3`;
```

- [ ] **Step 4: Update the port**

```ts
// packages/domain/src/ports.ts
import { Context, Data, Effect } from 'effect';
import type { Question } from './entities';

export class DbError extends Data.TaggedError('DbError')<{ cause: unknown }> {}

export class QuestionRepository extends Context.Tag('QuestionRepository')<
  QuestionRepository,
  {
    readonly upsertQuestion: (q: Question) => Effect.Effect<void, DbError>;
    readonly questionsByCategory: (category: string) => Effect.Effect<Question[], DbError>;
  }
>() {}
```

Update `packages/domain/test/ports.test.ts` to the new method names (fake Layer returns `[]`).

- [ ] **Step 5: Run tests — verify green**

Run: `pnpm test packages/domain && pnpm --filter @perminou/domain exec tsc --noEmit`
Expected: PASS + clean typecheck.

- [ ] **Step 6: Commit**

```bash
git add packages/domain
git commit -m "refactor(domain): model questions as id + media flags + multi-select answers (real NARSA shape)"
```

---

### Task 2: Update the Postgres schema + repository to the new shape

**Files:**
- Rewrite: `packages/db/src/schema.ts` (drop `categories`/`chapters` question FK; keep it simple)
- Rewrite: `packages/db/src/question-repository.ts`
- Regenerate: `packages/db/migrations/*` (new baseline)
- Test: `packages/db/test/question-repository.int.test.ts` (rewrite)

**Interfaces:**
- Consumes: revised `@perminou/domain`.
- Produces: `questions(id pk, category, has_image, has_audio)` + `answers(id pk, question_id fk cascade, narsa_id, index, correct)`; `QuestionRepositoryLive` upserts keyed on `questions.id` (the NARSA id) and replaces answers.

- [ ] **Step 1: Rewrite the schema**

```ts
// packages/db/src/schema.ts
import { pgTable, integer, text, boolean, primaryKey } from 'drizzle-orm/pg-core';

export const questions = pgTable('questions', {
  id: integer('id').primaryKey(),           // NARSA numeric id — stable identity
  category: text('category').notNull(),
  hasImage: boolean('has_image').notNull(),
  hasAudio: boolean('has_audio').notNull(),
});

export const answers = pgTable('answers', {
  questionId: integer('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  narsaId: integer('narsa_id').notNull(),
  index: integer('index').notNull(),
  correct: boolean('correct').notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.questionId, t.narsaId] }) }));
```

- [ ] **Step 2: Regenerate migration + rewrite the failing integration test**

Run: `pnpm --filter @perminou/db generate` (delete the old `migrations/0000_*` first so this is the baseline).

```ts
// packages/db/test/question-repository.int.test.ts  (Testcontainers, keep the container setup from before)
test('upsert is idempotent by NARSA id and replaces answers', async () => {
  const q = { id: 565, category: 'B', hasImage: true, hasAudio: true,
    answers: [ { narsaId: 933, index: 1, correct: true }, { narsaId: 934, index: 2, correct: false } ] };
  const program = Effect.gen(function* () {
    const repo = yield* QuestionRepository;
    yield* repo.upsertQuestion(q as never);
    yield* repo.upsertQuestion({ ...q, answers: [{ narsaId: 933, index: 1, correct: false }] } as never); // re-scrape
    return yield* repo.questionsByCategory('B');
  });
  const rows = await Effect.runPromise(program.pipe(Effect.provide(QuestionRepositoryLive(uri))));
  expect(rows).toHaveLength(1);                      // idempotent
  expect(rows[0]!.answers).toHaveLength(1);          // answers replaced
  expect(rows[0]!.answers[0]!.correct).toBe(false);  // updated
});
```

- [ ] **Step 3: Run — verify fail, then implement the adapter**

```ts
// packages/db/src/question-repository.ts
import { Effect, Layer } from 'effect';
import { eq } from 'drizzle-orm';
import { PgDrizzle } from '@effect/sql-drizzle/Pg';
import { QuestionRepository, DbError, decodeQuestion, type Question } from '@perminou/domain';
import { questions, answers } from './schema';
import { DrizzleLive } from './client';

const make = Effect.gen(function* () {
  const db = yield* PgDrizzle;
  const upsertQuestion = (q: Question) =>
    Effect.gen(function* () {
      yield* db.insert(questions).values({ id: q.id, category: q.category, hasImage: q.hasImage, hasAudio: q.hasAudio })
        .onConflictDoUpdate({ target: questions.id, set: { category: q.category, hasImage: q.hasImage, hasAudio: q.hasAudio } });
      yield* db.delete(answers).where(eq(answers.questionId, q.id));
      if (q.answers.length) yield* db.insert(answers).values(q.answers.map((a) => ({ questionId: q.id, narsaId: a.narsaId, index: a.index, correct: a.correct })));
    }).pipe(Effect.catchAll((cause) => Effect.fail(new DbError({ cause }))));
  const questionsByCategory = (category: string) =>
    Effect.gen(function* () {
      const qs = yield* db.select().from(questions).where(eq(questions.category, category)).orderBy(questions.id);
      return yield* Effect.forEach(qs, (row) =>
        Effect.gen(function* () {
          const as = yield* db.select().from(answers).where(eq(answers.questionId, row.id)).orderBy(answers.index);
          return yield* decodeQuestion({ id: row.id, category: row.category, hasImage: row.hasImage, hasAudio: row.hasAudio,
            answers: as.map((a) => ({ narsaId: a.narsaId, index: a.index, correct: a.correct })) });
        }));
    }).pipe(Effect.catchAll((cause) => Effect.fail(new DbError({ cause }))));
  return { upsertQuestion, questionsByCategory };
});
export const QuestionRepositoryLive = (uri: string) =>
  Layer.effect(QuestionRepository, make).pipe(Layer.provide(DrizzleLive(uri)));
```

- [ ] **Step 4: Run — verify green. Commit**

Run: `pnpm test packages/db && pnpm typecheck`
```bash
git add packages/db && git commit -m "refactor(db): questions/answers schema for the real NARSA shape; upsert by narsa id"
```

---

### Task 3: Scaffold `apps/scraper` + the `SourceGateway` port & typed errors

**Files:**
- Create: `apps/scraper/package.json`, `apps/scraper/tsconfig.json`, `apps/scraper/src/domain/ports/source-gateway.ts`, `apps/scraper/src/domain/errors.ts`
- Test: `apps/scraper/test/source-gateway.contract.test.ts`

**Interfaces:**
- Produces (in `errors.ts`): `AuthError`, `SessionExpired`, `FetchError`, `ScrapeShapeError` (all `Data.TaggedError`, each with context fields).
- Produces `SourceGateway` `Context.Tag`:
  - `login(): Effect<Session, AuthError>`
  - `nextExamQuestion(s: Session): Effect<RawQuestion, FetchError | SessionExpired>` — one question of a running exam (starts one if needed)
  - `submitAndAdvance(s: Session, answerNarsaIds: number[]): Effect<'more' | 'done', FetchError | SessionExpired>`
  - `fetchCorrection(s: Session): Effect<RawCorrection, FetchError | SessionExpired>` — the finished-exam correction
  - `RawQuestion = { id: number; category: string; hasImage: boolean; hasAudio: boolean; answers: { narsaId: number; index: number }[] }`
  - `RawCorrection = { correctByQuestion: Record<number, number[]> }` (question id → correct answer narsaIds)

- [ ] **Step 1: Write the port contract test (a fake Layer satisfies it)**

```ts
// apps/scraper/test/source-gateway.contract.test.ts
import { test, expect } from 'vitest';
import { Effect, Layer } from 'effect';
import { SourceGateway } from '../src/domain/ports/source-gateway';

test('a Layer can satisfy SourceGateway', async () => {
  const fake = Layer.succeed(SourceGateway, {
    login: () => Effect.succeed({ cookie: 'x' } as never),
    nextExamQuestion: () => Effect.succeed({ id: 46, category: 'B', hasImage: true, hasAudio: false, answers: [{ narsaId: 1, index: 1 }] } as never),
    submitAndAdvance: () => Effect.succeed('more' as const),
    fetchCorrection: () => Effect.succeed({ correctByQuestion: { 46: [1] } } as never),
  });
  const out = await Effect.runPromise(Effect.gen(function* () {
    const gw = yield* SourceGateway; return yield* gw.nextExamQuestion({} as never);
  }).pipe(Effect.provide(fake)));
  expect(out.id).toBe(46);
});
```

- [ ] **Step 2: Run — fail. Implement `errors.ts` + `source-gateway.ts`**

```ts
// apps/scraper/src/domain/errors.ts
import { Data } from 'effect';
export class AuthError extends Data.TaggedError('AuthError')<{ status?: number }> {}
export class SessionExpired extends Data.TaggedError('SessionExpired')<{ url: string }> {}
export class FetchError extends Data.TaggedError('FetchError')<{ url: string; cause: unknown }> {}
export class ScrapeShapeError extends Data.TaggedError('ScrapeShapeError')<{ url: string; reason: string; htmlSnippet: string }> {}
```

```ts
// apps/scraper/src/domain/ports/source-gateway.ts
import { Context, Effect } from 'effect';
import type { AuthError, SessionExpired, FetchError } from '../errors';

export interface Session { readonly cookie: string; }
export interface RawQuestion { readonly id: number; readonly category: string; readonly hasImage: boolean; readonly hasAudio: boolean; readonly answers: ReadonlyArray<{ narsaId: number; index: number }>; }
export interface RawCorrection { readonly correctByQuestion: Readonly<Record<number, number[]>>; }

export class SourceGateway extends Context.Tag('SourceGateway')<
  SourceGateway,
  {
    readonly login: () => Effect.Effect<Session, AuthError>;
    readonly nextExamQuestion: (s: Session) => Effect.Effect<RawQuestion, FetchError | SessionExpired>;
    readonly submitAndAdvance: (s: Session, answerNarsaIds: number[]) => Effect.Effect<'more' | 'done', FetchError | SessionExpired>;
    readonly fetchCorrection: (s: Session) => Effect.Effect<RawCorrection, FetchError | SessionExpired>;
  }
>() {}
```

- [ ] **Step 3: Run — green. Commit**

```bash
git add apps/scraper && git commit -m "feat(scraper): SourceGateway port + typed errors"
```

---

### Task 4: Pure parser — RawQuestion → domain Question, fixture-tested

**Files:**
- Create: `apps/scraper/src/domain/build-question.ts`
- Create: `apps/scraper/fixtures/README.md` (how fixtures are recorded)
- Test: `apps/scraper/test/build-question.test.ts`

**Interfaces:**
- Consumes: `RawQuestion` + `RawCorrection`.
- Produces: `buildQuestion(raw: RawQuestion, correct: number[]): Effect<Question, ScrapeShapeError>` — merges the correct answer set into the answers and decodes through the domain Schema.

- [ ] **Step 1: Write the failing test**

```ts
// apps/scraper/test/build-question.test.ts
import { test, expect } from 'vitest';
import { Effect } from 'effect';
import { buildQuestion } from '../src/domain/build-question';

const raw = { id: 565, category: 'B', hasImage: true, hasAudio: true,
  answers: [ { narsaId: 933, index: 1 }, { narsaId: 934, index: 2 }, { narsaId: 935, index: 3 }, { narsaId: 936, index: 4 } ] };

test('marks the correct answer set from the correction', async () => {
  const q = await Effect.runPromise(buildQuestion(raw as never, [933, 935]));
  expect(q.answers.filter((a) => a.correct).map((a) => a.narsaId)).toEqual([933, 935]);
});
test('fails typed when a correct id is not among the answers', async () => {
  const exit = await Effect.runPromiseExit(buildQuestion(raw as never, [999]));
  expect(exit._tag).toBe('Failure'); // ScrapeShapeError — correction/answers mismatch
});
```

- [ ] **Step 2: Run — fail. Implement**

```ts
// apps/scraper/src/domain/build-question.ts
import { Effect, Schema } from 'effect';
import { Question } from '@perminou/domain';
import { ScrapeShapeError } from './errors';
import type { RawQuestion } from './ports/source-gateway';

export const buildQuestion = (raw: RawQuestion, correct: number[]) =>
  Effect.gen(function* () {
    const known = new Set(raw.answers.map((a) => a.narsaId));
    const unknown = correct.filter((id) => !known.has(id));
    if (unknown.length) {
      return yield* Effect.fail(new ScrapeShapeError({ url: `question/${raw.id}`, reason: `correct ids not in answers: ${unknown}`, htmlSnippet: '' }));
    }
    return yield* Schema.decodeUnknown(Question)({
      id: raw.id, category: raw.category, hasImage: raw.hasImage, hasAudio: raw.hasAudio,
      answers: raw.answers.map((a) => ({ narsaId: a.narsaId, index: a.index, correct: correct.includes(a.narsaId) })),
    }).pipe(Effect.mapError((cause) => new ScrapeShapeError({ url: `question/${raw.id}`, reason: String(cause), htmlSnippet: '' })));
  });
```

- [ ] **Step 3: Run — green. Commit**

```bash
git add apps/scraper && git commit -m "feat(scraper): pure buildQuestion merges correction into answers"
```

---

### Task 5: Playwright `SourceGateway` adapter (live capture + fixture-first parsers)

> This task touches the live site — it needs a valid `.env` login. It is where the exact exam-page and **correction** HTML markup are discovered. Method: **record a fixture, then TDD the parser against it.**

**Files:**
- Create: `apps/scraper/src/adapters/playwright-source-gateway.ts`
- Create: `apps/scraper/src/adapters/parse-question-html.ts`, `apps/scraper/src/adapters/parse-correction-html.ts`
- Fixtures: `apps/scraper/fixtures/exam-question.html`, `apps/scraper/fixtures/exam-correction.html`
- Test: `apps/scraper/test/parse-question-html.test.ts`, `apps/scraper/test/parse-correction-html.test.ts`

- [ ] **Step 1: Record fixtures from the live site** (one-time, manual, documented). Using an authenticated Playwright (SW disabled), save the raw HTML of (a) one exam question and (b) the end-of-exam correction into the two fixture files. Record what the correction markup looks like — this is the last unknown from ADR 0002.

- [ ] **Step 2: TDD `parse-question-html.ts`** against `exam-question.html`: extract `id` (from the `/media/uploads/questions/images|son/.../<id>.` URL), `category` (the "Catégorie X" text), `hasImage`/`hasAudio` (presence of the media els), and `answers` (`input[name=answers]` → `{ narsaId: Number(value), index }`). Assert against the fixture's known values.

- [ ] **Step 3: TDD `parse-correction-html.ts`** against `exam-correction.html`: extract `correctByQuestion` (question id → correct answer narsaIds) from whatever markup the correction uses (discovered in Step 1). Assert the count/shape.

- [ ] **Step 4: Implement `PlaywrightSourceGatewayLive`** — a `Layer` providing `SourceGateway`. `login` uses `.env` creds; the browser context is created with **`serviceWorkers: 'block'`**. `nextExamQuestion` reads the current question via `parseQuestionHtml`. `submitAndAdvance` checks the given answers + clicks Valider, returning `'more' | 'done'`. `fetchCorrection` reads the correction page via `parseCorrectionHtml`. Wrap browser acquisition in `Effect.acquireRelease` (Scope). On any response redirecting to `/accounts/signin/`, fail `SessionExpired`.

- [ ] **Step 5: Run the fixture-based parser tests — green.** (The `PlaywrightSourceGatewayLive` itself is not unit-tested — it's exercised by the opt-in drift test, Task 8.)

- [ ] **Step 6: Commit** (do NOT commit any real credentials; fixtures must be scrubbed of the CSRF token / personal name)

```bash
git add apps/scraper && git commit -m "feat(scraper): playwright SourceGateway adapter + fixture-tested html parsers"
```

---

### Task 6: Public media probe adapter

**Files:**
- Create: `apps/scraper/src/adapters/http-media.ts`
- Test: `apps/scraper/test/http-media.test.ts`

**Interfaces:**
- Produces `MediaProbe` `Context.Tag`: `exists(url: string): Effect<boolean, never>` (HEAD; 200 ⇒ true). Used to set `hasImage`/`hasAudio` per language and to confirm media, over anonymous HTTP.
- Test with a fake `Layer` (do NOT hit the network in unit tests).

- [ ] Steps: contract test with a fake Layer (map of url→bool) → implement a `got`-based `MediaProbeLive` (HEAD, `Schedule` retry, bounded) → green → commit `feat(scraper): public media probe adapter`.

---

### Task 7: Loop-until-dry orchestrator + persist

**Files:**
- Create: `apps/scraper/src/application/harvest.ts`
- Create: `apps/scraper/src/main.ts` (CLI composition root)
- Test: `apps/scraper/test/harvest.test.ts`

**Interfaces:**
- Produces `harvest(opts: { dryRounds: number }): Effect<HarvestSummary, ScrapeShapeError | DbError, SourceGateway | QuestionRepository>`:
  - Loop: run an exam (repeatedly `nextExamQuestion` + `submitAndAdvance` until `'done'`), collect the `RawQuestion`s + the `RawCorrection`, `buildQuestion` each, `upsertQuestion`, dedup by id in a `Set`. Repeat exams until **K consecutive exams add zero new question ids**. `log()` the saturation each round.

- [ ] **Step 1: Write the failing test** — provide fake `SourceGateway` (a scripted bank of, say, 5 questions served randomly) + fake `QuestionRepository` (in-memory Map). Assert that after enough rounds `harvest` collects all 5 unique ids and stops (dry). Assert dedup (no id upserted twice with different content unless changed).

- [ ] **Step 2: Run — fail. Implement `harvest.ts`** (pure Effect over the two ports; `Schedule`/bounded concurrency only where it touches I/O). Then `main.ts` wires `PlaywrightSourceGatewayLive` + `QuestionRepositoryLive(process.env.DATABASE_URL)` + `MediaProbeLive` into a `ManagedRuntime` and runs `harvest`.

- [ ] **Step 3: Run — green (fakes only, no live site). Commit**

```bash
git add apps/scraper && git commit -m "feat(scraper): loop-until-dry harvest orchestrator + CLI composition root"
```

---

### Task 8: Opt-in drift test (the only live-touching check)

**Files:**
- Create: `apps/scraper/test/drift.live.ts` (NOT `*.test.ts` — excluded from `pnpm test`)
- Modify: `apps/scraper/package.json` (add `"drift": "vitest run test/drift.live.ts"`)

- [ ] Implement a script that logs in, pulls ONE real exam question, and asserts `parseQuestionHtml` still returns a well-shaped `RawQuestion` (id numeric, ≥2 answers). Designed to **fail loudly** when NARSA's markup changes. Documented as run-manually / nightly, never in `pnpm test`. Commit `test(scraper): opt-in drift test against live NARSA`.

---

## Self-Review

**Spec coverage:** ADR 0002 findings → Playwright-primary behind `SourceGateway` (T3/T5), SW disabled (T5.4), public-media HTTP (T6), loop-until-dry (T7), correction→correct-answers (T4/T5), upsert by NARSA id (T1/T2, closes ADR 0006 follow-up), fixtures + drift test (T5/T8, tests never hit live per Global Constraints). Domain/db realigned to the real shape (T1/T2).

**Placeholder scan:** concrete tasks (T1–T4, T6, T7) carry full code. T5's exact selectors/markup are legitimately discovered by recording a fixture first (fixture-first TDD, per the `perminou-scraping` skill) — not a placeholder; the *method* is fully specified.

**Type consistency:** `Question`/`Answer` shape identical across T1 (domain), T2 (db decode), T4 (buildQuestion). `QuestionRepository` methods `upsertQuestion`/`questionsByCategory` identical T1↔T2↔T7. `SourceGateway` signatures identical T3↔T5↔T7.

**Open item folded in:** ADR 0006 upsert-invariant → resolved by keying on the NARSA numeric id (T1/T2). The `@effect/experimental` peer-range follow-up is orthogonal (dependency hygiene) — address opportunistically, not blocking.
