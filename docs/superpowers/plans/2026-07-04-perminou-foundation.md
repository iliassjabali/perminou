# Perminou Foundation — Monorepo, Domain & Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the pnpm + Turborepo monorepo with a pure Effect-Schema domain and a Postgres persistence layer (Drizzle + `@effect/sql-drizzle`) proven by Testcontainers — the foundation the scraper and backend both build on.

**Architecture:** Hexagonal, all-in Effect. `packages/domain` is pure (entities + Effect Schema + ports as `Context.Tag`). `packages/db` owns the Drizzle `pgTable` schema, migrations, and the `QuestionRepository` adapter `Layer` (used later by both scraper and backend). Dependencies point inward — `db` depends on `domain`, never the reverse.

**Tech Stack:** TypeScript, Effect (incl. Effect Schema), Drizzle ORM + `@effect/sql-drizzle` + `@effect/sql-pg`, Postgres 16, `drizzle-kit`, Vitest, `@testcontainers/postgresql`, pnpm, Turborepo, Node 24.

## Global Constraints

- **Runtime:** Node only (no Bun). Node 24.
- **Paradigm:** all-in Effect. No NestJS, no tRPC. Ports = `Context.Tag`, adapters = `Layer`. Domain imports no I/O library.
- **Validation:** Effect Schema (not Zod).
- **Tests:** Vitest everywhere. TDD red-green-refactor. No test hits live NARSA.
- **ORM:** Drizzle; queries execute via `@effect/sql-drizzle`. Migrations via `drizzle-kit`.
- **Commit:** after every green step.
- **Package scope:** `@perminou/*`.

---

## File Structure

- `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `vitest.config.ts` — workspace root.
- `packages/domain/` — `src/ids.ts` (branded IDs), `src/entities.ts` (Effect Schema), `src/ports.ts` (`QuestionRepository` Tag + errors), `src/index.ts`. Pure.
- `packages/db/` — `src/schema.ts` (Drizzle `pgTable`), `src/client.ts` (`@effect/sql-pg` + `PgDrizzle` layers), `src/question-repository.ts` (adapter `Layer`), `drizzle.config.ts`, `migrations/`.
- `packages/db/test/` — `migrations.int.test.ts`, `question-repository.int.test.ts` (Testcontainers).

---

### Task 1: Workspace scaffold

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `vitest.config.ts`
- Create: `packages/domain/package.json`, `packages/domain/tsconfig.json`, `packages/domain/src/index.ts`
- Test: `packages/domain/test/smoke.test.ts`

**Interfaces:**
- Produces: a runnable `pnpm test` (Vitest) across the workspace; `@perminou/domain` importable.

- [ ] **Step 1: Write the failing smoke test**

```ts
// packages/domain/test/smoke.test.ts
import { test, expect } from 'vitest';
import { hello } from '../src/index';

test('domain package is wired', () => {
  expect(hello()).toBe('perminou');
});
```

- [ ] **Step 2: Create workspace files**

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

```json
// package.json
{
  "name": "perminou",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": { "test": "vitest run", "build": "turbo build", "typecheck": "turbo typecheck" },
  "devDependencies": {
    "turbo": "^2.0.0", "typescript": "^5.6.0", "vitest": "^2.1.0",
    "@testcontainers/postgresql": "^10.13.0"
  },
  "engines": { "node": ">=24" }
}
```

```json
// turbo.json
{ "$schema": "https://turbo.build/schema.json",
  "tasks": { "build": { "dependsOn": ["^build"] }, "typecheck": {}, "test": {} } }
```

```json
// tsconfig.base.json
{ "compilerOptions": {
  "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext",
  "strict": true, "exactOptionalPropertyTypes": true, "noUncheckedIndexedAccess": true,
  "skipLibCheck": true, "declaration": true, "composite": true } }
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['packages/**/test/**/*.test.ts'], testTimeout: 60000 } });
```

- [ ] **Step 3: Create the domain package + minimal source**

```json
// packages/domain/package.json
{ "name": "@perminou/domain", "version": "0.0.0", "type": "module",
  "main": "src/index.ts", "types": "src/index.ts",
  "dependencies": { "effect": "^3.14.0" },
  "scripts": { "typecheck": "tsc --noEmit" } }
```

```json
// packages/domain/tsconfig.json
{ "extends": "../../tsconfig.base.json", "include": ["src", "test"] }
```

```ts
// packages/domain/src/index.ts
export const hello = () => 'perminou';
```

- [ ] **Step 4: Install and run the test**

Run: `pnpm install && pnpm test`
Expected: PASS (1 test, `domain package is wired`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm+turborepo workspace with domain package and vitest"
```

---

### Task 2: Domain entities (Effect Schema)

**Files:**
- Create: `packages/domain/src/ids.ts`, `packages/domain/src/entities.ts`
- Modify: `packages/domain/src/index.ts` (re-export)
- Test: `packages/domain/test/entities.test.ts`

**Interfaces:**
- Produces:
  - Branded IDs: `CategoryId`, `ChapterId`, `QuestionId` (each `string & Brand`), with `*Schema` decoders.
  - Schemas + types: `Lang = 'fr' | 'ar'`; `Answer { label: string; correct: boolean }`; `Question { id: QuestionId; sourceUrl: string; chapterId: ChapterId; lang: Lang; text: string; imageUrl?: string; ordinal: number; answers: Answer[] }`; `Chapter { id; categoryId; title; ordinal }`; `Category { id; title; ordinal }`.
  - `decodeQuestion = Schema.decodeUnknown(Question)`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/domain/test/entities.test.ts
import { test, expect } from 'vitest';
import { Effect, Either } from 'effect';
import { Schema } from 'effect';
import { Question, decodeQuestion } from '../src/entities';

const valid = {
  id: 'q_1', sourceUrl: 'https://perminou.narsa.gov.ma/fr/quiz/1', chapterId: 'ch_1',
  lang: 'fr', text: 'Que signifie ce panneau ?', ordinal: 1,
  answers: [{ label: 'Stop', correct: true }, { label: 'Cédez', correct: false }],
};

test('decodes a valid question', () => {
  const q = Schema.decodeUnknownSync(Question)(valid);
  expect(q.answers.filter((a) => a.correct)).toHaveLength(1);
  expect(q.lang).toBe('fr');
});

test('rejects an empty question text', async () => {
  const res = await Effect.runPromise(Effect.either(decodeQuestion({ ...valid, text: '' })));
  expect(Either.isLeft(res)).toBe(true);
});

test('rejects an unknown lang', async () => {
  const res = await Effect.runPromise(Effect.either(decodeQuestion({ ...valid, lang: 'en' })));
  expect(Either.isLeft(res)).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test packages/domain`
Expected: FAIL (cannot find `../src/entities`).

- [ ] **Step 3: Implement IDs and entities**

```ts
// packages/domain/src/ids.ts
import { Schema } from 'effect';
export const CategoryId = Schema.String.pipe(Schema.brand('CategoryId'));
export const ChapterId = Schema.String.pipe(Schema.brand('ChapterId'));
export const QuestionId = Schema.String.pipe(Schema.brand('QuestionId'));
export type CategoryId = Schema.Schema.Type<typeof CategoryId>;
export type ChapterId = Schema.Schema.Type<typeof ChapterId>;
export type QuestionId = Schema.Schema.Type<typeof QuestionId>;
```

```ts
// packages/domain/src/entities.ts
import { Schema } from 'effect';
import { CategoryId, ChapterId, QuestionId } from './ids';

export const Lang = Schema.Literal('fr', 'ar');
export type Lang = Schema.Schema.Type<typeof Lang>;

export const Answer = Schema.Struct({
  label: Schema.NonEmptyString,
  correct: Schema.Boolean,
});
export type Answer = Schema.Schema.Type<typeof Answer>;

export const Question = Schema.Struct({
  id: QuestionId,
  sourceUrl: Schema.NonEmptyString,
  chapterId: ChapterId,
  lang: Lang,
  text: Schema.NonEmptyString,
  imageUrl: Schema.optional(Schema.String),
  ordinal: Schema.Int,
  answers: Schema.Array(Answer),
});
export type Question = Schema.Schema.Type<typeof Question>;
export const decodeQuestion = Schema.decodeUnknown(Question);

export const Chapter = Schema.Struct({
  id: ChapterId, categoryId: CategoryId, title: Schema.NonEmptyString, ordinal: Schema.Int,
});
export type Chapter = Schema.Schema.Type<typeof Chapter>;

export const Category = Schema.Struct({
  id: CategoryId, title: Schema.NonEmptyString, ordinal: Schema.Int,
});
export type Category = Schema.Schema.Type<typeof Category>;
```

```ts
// packages/domain/src/index.ts
export * from './ids';
export * from './entities';
export * from './ports';
```

> Note: `index.ts` re-exports `./ports` (Task 3). Create an empty `packages/domain/src/ports.ts` now (`export {};`) so this compiles; Task 3 fills it in.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test packages/domain`
Expected: PASS (3 entity tests + the smoke test).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(domain): Effect Schema entities and branded ids"
```

---

### Task 3: QuestionRepository port + typed errors

**Files:**
- Modify: `packages/domain/src/ports.ts`
- Test: `packages/domain/test/ports.test.ts`

**Interfaces:**
- Produces:
  - `DbError` (`Data.TaggedError`, fields `{ cause: unknown }`).
  - `QuestionRepository` `Context.Tag` with:
    - `upsertQuestion: (q: Question) => Effect.Effect<void, DbError>`
    - `questionsForChapter: (id: ChapterId) => Effect.Effect<Question[], DbError>`
  - This Tag is the seam both the scraper (writes) and backend (reads) depend on.

- [ ] **Step 1: Write the failing test (a fake Layer satisfies the port)**

```ts
// packages/domain/test/ports.test.ts
import { test, expect } from 'vitest';
import { Effect, Layer } from 'effect';
import { QuestionRepository } from '../src/ports';

test('a Layer can satisfy the QuestionRepository port', async () => {
  const fake = Layer.succeed(QuestionRepository, {
    upsertQuestion: () => Effect.void,
    questionsForChapter: () => Effect.succeed([]),
  });
  const program = Effect.gen(function* () {
    const repo = yield* QuestionRepository;
    yield* repo.upsertQuestion({} as never);
    return yield* repo.questionsForChapter('ch_1' as never);
  });
  const out = await Effect.runPromise(program.pipe(Effect.provide(fake)));
  expect(out).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/domain`
Expected: FAIL (`QuestionRepository` not exported).

- [ ] **Step 3: Implement the port and error**

```ts
// packages/domain/src/ports.ts
import { Context, Data, Effect } from 'effect';
import type { Question } from './entities';
import type { ChapterId } from './ids';

export class DbError extends Data.TaggedError('DbError')<{ cause: unknown }> {}

export class QuestionRepository extends Context.Tag('QuestionRepository')<
  QuestionRepository,
  {
    readonly upsertQuestion: (q: Question) => Effect.Effect<void, DbError>;
    readonly questionsForChapter: (id: ChapterId) => Effect.Effect<Question[], DbError>;
  }
>() {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/domain`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(domain): QuestionRepository port and DbError"
```

---

### Task 4: Postgres schema + migration (Testcontainers)

**Files:**
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/src/schema.ts`, `packages/db/drizzle.config.ts`
- Create (generated): `packages/db/migrations/*`
- Test: `packages/db/test/migrations.int.test.ts`

**Interfaces:**
- Consumes: `@perminou/domain` types.
- Produces: Drizzle tables `categories`, `chapters`, `questions`, `answers`; a generated SQL migration; `applyMigrations(connectionUri: string): Promise<void>`.

- [ ] **Step 1: Create the db package**

```json
// packages/db/package.json
{ "name": "@perminou/db", "version": "0.0.0", "type": "module",
  "main": "src/index.ts", "types": "src/index.ts",
  "dependencies": {
    "@perminou/domain": "workspace:*", "effect": "^3.14.0",
    "drizzle-orm": "^0.36.0", "postgres": "^3.4.0",
    "@effect/sql": "^0.24.0", "@effect/sql-pg": "^0.24.0", "@effect/sql-drizzle": "^0.24.0"
  },
  "devDependencies": { "drizzle-kit": "^0.28.0" },
  "scripts": { "typecheck": "tsc --noEmit", "generate": "drizzle-kit generate" } }
```

```json
// packages/db/tsconfig.json
{ "extends": "../../tsconfig.base.json", "include": ["src", "test"],
  "references": [{ "path": "../domain" }] }
```

- [ ] **Step 2: Write the Drizzle schema**

```ts
// packages/db/src/schema.ts
import { pgTable, text, integer, boolean, uuid, index } from 'drizzle-orm/pg-core';

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  ordinal: integer('ordinal').notNull(),
});

export const chapters = pgTable('chapters', {
  id: text('id').primaryKey(),
  categoryId: text('category_id').notNull().references(() => categories.id),
  title: text('title').notNull(),
  ordinal: integer('ordinal').notNull(),
});

export const questions = pgTable('questions', {
  id: text('id').primaryKey(),
  sourceUrl: text('source_url').notNull().unique(),   // stable upsert key
  chapterId: text('chapter_id').notNull().references(() => chapters.id),
  lang: text('lang').notNull(),                        // 'fr' | 'ar'
  text: text('text').notNull(),
  imageUrl: text('image_url'),
  ordinal: integer('ordinal').notNull(),
}, (t) => ({ byChapter: index('questions_chapter_idx').on(t.chapterId) }));

export const answers = pgTable('answers', {
  id: uuid('id').defaultRandom().primaryKey(),
  questionId: text('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  correct: boolean('correct').notNull(),
});
```

```ts
// packages/db/drizzle.config.ts
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: './src/schema.ts', out: './migrations', dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/perminou' },
});
```

- [ ] **Step 3: Generate the migration**

Run: `pnpm --filter @perminou/db generate`
Expected: a `migrations/0000_*.sql` file is created containing `CREATE TABLE` statements for all four tables.

- [ ] **Step 4: Write the failing migration test**

```ts
// packages/db/test/migrations.int.test.ts
import { test, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import postgres from 'postgres';
import { applyMigrations } from '../src/migrate';

let container: StartedPostgreSqlContainer;
beforeAll(async () => { container = await new PostgreSqlContainer('postgres:16').start(); }, 120000);
afterAll(async () => { await container.stop(); });

test('migrations create the questions table', async () => {
  await applyMigrations(container.getConnectionUri());
  const sql = postgres(container.getConnectionUri());
  const rows = await sql`select table_name from information_schema.tables where table_schema = 'public'`;
  const names = rows.map((r) => r.table_name);
  await sql.end();
  expect(names).toEqual(expect.arrayContaining(['categories', 'chapters', 'questions', 'answers']));
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `pnpm test packages/db`
Expected: FAIL (cannot find `../src/migrate`).

- [ ] **Step 6: Implement `applyMigrations`**

```ts
// packages/db/src/migrate.ts
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

export async function applyMigrations(connectionUri: string): Promise<void> {
  const sql = postgres(connectionUri, { max: 1 });
  await migrate(drizzle(sql), { migrationsFolder: new URL('../migrations', import.meta.url).pathname });
  await sql.end();
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm test packages/db`
Expected: PASS (Docker required; the container starts, migrations apply, all four tables exist).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(db): drizzle schema + migration verified via testcontainers"
```

---

### Task 5: QuestionRepository Drizzle adapter (Testcontainers)

**Files:**
- Create: `packages/db/src/client.ts`, `packages/db/src/question-repository.ts`, `packages/db/src/index.ts`
- Test: `packages/db/test/question-repository.int.test.ts`

**Interfaces:**
- Consumes: `QuestionRepository` Tag + `Question`/`ChapterId` from `@perminou/domain`; `schema` from Task 4.
- Produces: `QuestionRepositoryLive: (connectionUri: string) => Layer<QuestionRepository>` — `upsertQuestion` upserts the question + replaces its answers by `sourceUrl`; `questionsForChapter` returns decoded `Question[]` ordered by `ordinal`.

- [ ] **Step 1: Write the failing integration test**

```ts
// packages/db/test/question-repository.int.test.ts
import { test, expect, beforeAll, afterAll } from 'vitest';
import { Effect } from 'effect';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import postgres from 'postgres';
import { applyMigrations } from '../src/migrate';
import { QuestionRepository } from '@perminou/domain';
import { QuestionRepositoryLive } from '../src/question-repository';

let container: StartedPostgreSqlContainer;
let uri: string;
beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16').start();
  uri = container.getConnectionUri();
  await applyMigrations(uri);
  const sql = postgres(uri);
  await sql`insert into categories (id, title, ordinal) values ('cat_1', 'LA ROUTE', 1)`;
  await sql`insert into chapters (id, category_id, title, ordinal) values ('ch_1', 'cat_1', 'Panneaux', 1)`;
  await sql.end();
}, 120000);
afterAll(async () => { await container.stop(); });

const q = {
  id: 'q_1', sourceUrl: 'https://x/fr/quiz/1', chapterId: 'ch_1', lang: 'fr',
  text: 'Panneau ?', ordinal: 1,
  answers: [{ label: 'Stop', correct: true }, { label: 'Cédez', correct: false }],
} as const;

test('upsert then read back a question with answers', async () => {
  const program = Effect.gen(function* () {
    const repo = yield* QuestionRepository;
    yield* repo.upsertQuestion(q as never);
    yield* repo.upsertQuestion(q as never);              // idempotent — no duplicate
    return yield* repo.questionsForChapter('ch_1' as never);
  });
  const rows = await Effect.runPromise(program.pipe(Effect.provide(QuestionRepositoryLive(uri))));
  expect(rows).toHaveLength(1);
  expect(rows[0].answers.filter((a) => a.correct)).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/db`
Expected: FAIL (cannot find `../src/question-repository`).

- [ ] **Step 3: Implement the client layers**

```ts
// packages/db/src/client.ts
import { PgClient } from '@effect/sql-pg';
import { PgDrizzle } from '@effect/sql-drizzle/Pg';
import { Layer, Config } from 'effect';

export const PgLive = (connectionUri: string) =>
  PgClient.layer({ url: Config.succeed(connectionUri) });

export const DrizzleLive = (connectionUri: string) =>
  PgDrizzle.layer.pipe(Layer.provide(PgLive(connectionUri)));
```

- [ ] **Step 4: Implement the repository adapter**

```ts
// packages/db/src/question-repository.ts
import { Effect, Layer } from 'effect';
import { eq } from 'drizzle-orm';
import { PgDrizzle } from '@effect/sql-drizzle/Pg';
import { QuestionRepository, DbError, decodeQuestion, type Question, type ChapterId } from '@perminou/domain';
import { questions, answers } from './schema';
import { DrizzleLive } from './client';

const make = Effect.gen(function* () {
  const db = yield* PgDrizzle;

  const upsertQuestion = (q: Question) =>
    Effect.gen(function* () {
      yield* db.insert(questions).values({
        id: q.id, sourceUrl: q.sourceUrl, chapterId: q.chapterId, lang: q.lang,
        text: q.text, imageUrl: q.imageUrl ?? null, ordinal: q.ordinal,
      }).onConflictDoUpdate({
        target: questions.sourceUrl,
        set: { text: q.text, lang: q.lang, imageUrl: q.imageUrl ?? null, ordinal: q.ordinal },
      });
      yield* db.delete(answers).where(eq(answers.questionId, q.id));
      if (q.answers.length > 0) {
        yield* db.insert(answers).values(q.answers.map((a) => ({ questionId: q.id, label: a.label, correct: a.correct })));
      }
    }).pipe(Effect.catchAll((cause) => Effect.fail(new DbError({ cause }))));

  const questionsForChapter = (id: ChapterId) =>
    Effect.gen(function* () {
      const qs = yield* db.select().from(questions).where(eq(questions.chapterId, id)).orderBy(questions.ordinal);
      return yield* Effect.forEach(qs, (row) =>
        Effect.gen(function* () {
          const as = yield* db.select().from(answers).where(eq(answers.questionId, row.id));
          return yield* decodeQuestion({
            id: row.id, sourceUrl: row.sourceUrl, chapterId: row.chapterId, lang: row.lang,
            text: row.text, imageUrl: row.imageUrl ?? undefined, ordinal: row.ordinal,
            answers: as.map((a) => ({ label: a.label, correct: a.correct })),
          });
        }));
    }).pipe(Effect.catchAll((cause) => Effect.fail(new DbError({ cause }))));

  return { upsertQuestion, questionsForChapter };
});

export const QuestionRepositoryLive = (connectionUri: string) =>
  Layer.effect(QuestionRepository, make).pipe(Layer.provide(DrizzleLive(connectionUri)));
```

```ts
// packages/db/src/index.ts
export * from './schema';
export * from './migrate';
export * from './question-repository';
export * from './client';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test packages/db`
Expected: PASS (upsert is idempotent → 1 row; 1 correct answer).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(db): QuestionRepository drizzle adapter via @effect/sql-drizzle"
```

---

### Task 6: Scaffolding generators (plop)

**Files:**
- Modify: `package.json` (add `plop` devDep + `plop` script)
- Modify: `packages/domain/src/index.ts` (add the `/* plop:entity-export */` marker)
- Present already: `plopfile.mjs` at repo root (generators: feature / entity / screen).

**Interfaces:**
- Produces: `pnpm plop <feature|entity|screen>` works; the `entity` generator auto-exports via the domain barrel marker.

- [ ] **Step 1: Add plop to the root package.json**

Add to `scripts`: `"plop": "plop"`. Add to `devDependencies`: `"plop": "^4.0.0"`.

- [ ] **Step 2: Add the entity-export marker to the domain barrel**

```ts
// packages/domain/src/index.ts
export * from './ids';
export * from './entities';
export * from './ports';
/* plop:entity-export */
```

- [ ] **Step 3: Install**

Run: `pnpm install`
Expected: `plop` resolves.

- [ ] **Step 4: Verify the entity generator**

Run: `pnpm plop entity` → name `ScaffoldSmoke`
Expected: creates `packages/domain/src/entities/scaffold-smoke.ts` + `packages/domain/test/scaffold-smoke.test.ts`, and appends `export * from './entities/scaffold-smoke';` after the marker in `index.ts`.

- [ ] **Step 5: Remove the throwaway, keep the wiring**

```bash
rm packages/domain/src/entities/scaffold-smoke.ts packages/domain/test/scaffold-smoke.test.ts
git checkout packages/domain/src/index.ts   # drop the appended smoke export; keep the marker
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: add plop generators (feature/entity/screen) + verify entity generator"
```

> The `feature` and `screen` generators target packages created in later plans (`rpc-contract`, `backend`, `mobile`); they're verified there.

---

## Self-Review

**Spec coverage:** Foundation (monorepo, Task 1) ✓ · domain entities/schema (Tasks 2–3, spec §4) ✓ · `packages/db` shared schema + `QuestionRepository` port/adapter (Tasks 3–5, spec §3 table) ✓ · Testcontainers strategy (Tasks 4–5, spec §7) ✓. Out of this plan's scope by design: scraper (Plan 5, spike-blocked), backend rpc (Plan 2), rpc-react (Plan 3), mobile (Plan 4), exams (added when backend needs them).

**Placeholder scan:** No TBD/TODO; every code step shows real code; the empty `ports.ts` stub in Task 2 is explicitly created and filled in Task 3 (not a placeholder).

**Type consistency:** `QuestionRepository` methods `upsertQuestion`/`questionsForChapter` are identical across Tasks 3 and 5. `sourceUrl` is the upsert key in both schema (Task 4) and adapter (Task 5). Branded IDs from Task 2 are consumed as `ChapterId` in Tasks 3/5.

**Version caveat:** `@effect/sql-drizzle` / `@effect/sql-pg` are pre-1.0 — the `PgDrizzle` import path and `PgClient.layer` config shape may shift; if an import fails, check the installed package's exports. This is isolated to `packages/db/src/client.ts`.
