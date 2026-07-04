# Perminou Backend API Implementation Plan (Plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. REQUIRED READING: `perminou-architecture`, `perminou-effect`, ADR 0005/0007/0008. Steps use checkbox (`- [ ]`).

**Goal:** Serve the scraped question bank from Postgres over `@effect/rpc` (on Hono), so the mobile app can fetch a mock exam and the full practice set.

**Architecture:** Hexagonal, all-in Effect. `packages/rpc-contract` holds `@effect/rpc` `RpcGroup`s (Effect Schema payload/success/error), shared server+client. `apps/backend` implements handlers as thin inbound adapters over use-cases that read `QuestionRepository`; served via `RpcServer` over a Hono HTTP server. Media stays client-derived (the wire `Question` has no URLs — the app builds `fr`/`ar` URLs from the id).

**Tech Stack:** Effect, `@effect/rpc`, `@effect/platform`, Hono + `@hono/node-server`, `@perminou/db` (Drizzle/Postgres), Vitest + Testcontainers, Node 24.

## Global Constraints

- Node only. `@perminou/*`. All-in Effect. Effect Schema (not Zod). Vitest.
- `packages/domain` stays pure. Handlers are thin — logic in `application/` use-cases.
- Media URLs are NOT sent over the wire — the client derives them per language via `mediaUrl` (Arabic = client-side).
- Tests never hit live NARSA. Repo tests use Testcontainers Postgres.
- `@effect/rpc` is `0.x`/pre-v4 — if an API differs from a snippet here, check the installed package's exports and adapt (don't invent); keep churn inside `rpc-contract`/backend adapters.
- Commit after each green step.

## Prereq note (data we have)

`Question = { id: string; category: string ('B'); hasImage; hasAudio; answers: {narsaId, index, correct}[] }`. No course-category / no question text (it's in the media). Backend serves: a random exam, and the full set.

---

### Task 1: Repository read methods for serving

**Files:**
- Modify: `packages/domain/src/ports.ts` (add methods), `packages/db/src/question-repository.ts` (implement)
- Test: `packages/db/test/question-repository.int.test.ts` (extend)

**Interfaces:**
- Produces on `QuestionRepository`:
  - `allQuestions(): Effect.Effect<Question[], DbError>`
  - `randomQuestions(count: number): Effect.Effect<Question[], DbError>` (Postgres `order by random() limit N`)

- [ ] **Step 1: Extend the failing integration test**

```ts
// add to packages/db/test/question-repository.int.test.ts (reuse the container + a few upserts)
test('allQuestions returns every upserted question; randomQuestions caps the count', async () => {
  const seed = [1, 2, 3, 4, 5].map((n) => ({ id: String(n), category: 'B', hasImage: true, hasAudio: false,
    answers: [{ narsaId: n * 10, index: 1, correct: true }, { narsaId: n * 10 + 1, index: 2, correct: false }] }));
  const rows = await Effect.runPromise(Effect.gen(function* () {
    const repo = yield* QuestionRepository;
    for (const q of seed) yield* repo.upsertQuestion(q as never);
    const all = yield* repo.allQuestions();
    const rnd = yield* repo.randomQuestions(3);
    return { all: all.length, rnd: rnd.length };
  }).pipe(Effect.provide(QuestionRepositoryLive(uri))));
  expect(rows.all).toBeGreaterThanOrEqual(5);
  expect(rows.rnd).toBe(3);
});
```

- [ ] **Step 2: Run — fail. Add the port methods**

```ts
// packages/domain/src/ports.ts — add to the QuestionRepository shape:
readonly allQuestions: () => Effect.Effect<Question[], DbError>;
readonly randomQuestions: (count: number) => Effect.Effect<Question[], DbError>;
```

- [ ] **Step 3: Implement in the adapter**

```ts
// packages/db/src/question-repository.ts — inside make(), add (reuse the row→Question decode helper):
const decodeRows = (rows: typeof questions.$inferSelect[]) =>
  Effect.forEach(rows, (row) => Effect.gen(function* () {
    const as = yield* db.select().from(answers).where(eq(answers.questionId, row.id)).orderBy(answers.index);
    return yield* decodeQuestion({ id: row.id, category: row.category, hasImage: row.hasImage, hasAudio: row.hasAudio,
      answers: as.map((a) => ({ narsaId: a.narsaId, index: a.index, correct: a.correct })) });
  }));
const allQuestions = () =>
  Effect.gen(function* () { return yield* decodeRows(yield* db.select().from(questions).orderBy(questions.id)); })
    .pipe(Effect.catchAll((cause) => Effect.fail(new DbError({ cause }))));
const randomQuestions = (count: number) =>
  Effect.gen(function* () { return yield* decodeRows(yield* db.select().from(questions).orderBy(sql`random()`).limit(count)); })
    .pipe(Effect.catchAll((cause) => Effect.fail(new DbError({ cause }))));
// import { sql } from 'drizzle-orm'; add allQuestions/randomQuestions to the returned object; refactor questionsByCategory to reuse decodeRows.
```

- [ ] **Step 4: Run — green. Commit** `feat(db): allQuestions + randomQuestions repository reads`

---

### Task 2: `packages/rpc-contract` — the exam RPCs

**Files:**
- Create: `packages/rpc-contract/package.json`, `tsconfig.json`, `src/question.ts` (wire schema), `src/exam.ts` (RpcGroup), `src/index.ts`
- Test: `packages/rpc-contract/test/contract.test.ts`

**Interfaces:**
- Produces: `QuestionWire` (Effect Schema mirroring domain `Question`), and `ExamRpcs = RpcGroup.make(Rpc.make('GetExam', { payload: { count: Int }, success: Array(QuestionWire), error: Never }), Rpc.make('GetAllQuestions', { payload: {}, success: Array(QuestionWire), error: Never }))`. Re-export from index. `export type ExamRouter = typeof ExamRpcs`.

- [ ] **Step 1:** create the package (deps: `effect`, `@effect/rpc`, `@perminou/domain`; scope `@perminou/rpc-contract`). Add to `vitest`/workspace (already globbed).
- [ ] **Step 2:** write a failing test asserting `ExamRpcs` exposes `GetExam`/`GetAllQuestions` and that `QuestionWire` decodes a sample question. Run red.
- [ ] **Step 3:** implement `QuestionWire` (Struct: id String, category String, hasImage/hasAudio Boolean, answers Array({narsaId Int, index Int, correct Boolean})) and `ExamRpcs`. Run green.
- [ ] **Step 4:** commit `feat(rpc-contract): exam RPC group + question wire schema`.

> If the exact `Rpc.make`/`RpcGroup.make` signature differs in the installed `@effect/rpc`, check `node_modules/@effect/rpc/dist/dts` and adapt; keep the payload/success/error schemas as specified.

---

### Task 3: `apps/backend` — use-cases + handlers + Hono server

**Files:**
- Create: `apps/backend/package.json`, `tsconfig.json`, `src/application/{get-exam,get-all-questions}.ts`, `src/adapters/inbound/exam.handlers.ts`, `src/http.ts` (Hono + RpcServer), `src/main.ts` (composition root), `src/load-env.ts`
- Test: `apps/backend/test/get-exam.test.ts`, `apps/backend/test/exam.handlers.int.test.ts`

**Interfaces:**
- `getExam(count: number): Effect<Question[], never, QuestionRepository>` → `repo.randomQuestions(count)`.
- `getAllQuestions(): Effect<Question[], never, QuestionRepository>` → `repo.allQuestions()`.
- `ExamHandlersLive = ExamRpcs.toLayer({ GetExam: ({count}) => getExam(count), GetAllQuestions: () => getAllQuestions() })`.
- `http.ts`: build a Hono app; mount the `@effect/rpc` HTTP handler (via `RpcServer` + `RpcSerialization.layerJson` + the platform HTTP app, or the web-handler bridge) at `POST /rpc`; add `GET /health` → 200.
- `main.ts`: `@hono/node-server` `serve()` the app on `PORT` (default 3000), with `QuestionRepositoryLive(DATABASE_URL)` provided.

- [ ] **Step 1:** create the package (deps: `effect`, `@effect/rpc`, `@effect/platform`, `hono`, `@hono/node-server`, `@perminou/domain`, `@perminou/db`, `@perminou/rpc-contract`; dev: `tsx`). Add `dev`/`start` scripts.
- [ ] **Step 2 (unit):** failing test for `getExam` with a fake `QuestionRepository` Layer (returns 3 questions) → assert length 3. Run red → implement use-cases → green.
- [ ] **Step 3 (integration):** test that exercises the handler layer end-to-end against **Testcontainers Postgres** (seed a few questions, apply migrations, call the `GetExam` handler via `ExamRpcs` server-side caller or an in-process RpcClient) → assert it returns seeded questions. Run red → implement handlers + `http.ts` + `main.ts` → green.
- [ ] **Step 4:** verify `GET /health` returns 200 (supertest or a Hono `app.request('/health')`).
- [ ] **Step 5:** commit `feat(backend): @effect/rpc exam API over Hono (GetExam/GetAllQuestions + health)`.

> `@effect/rpc` server wiring is the pre-1.0 risk. If mounting via Hono is fiddly, an acceptable fallback is `@effect/platform`'s HTTP server hosting the RpcServer directly (still Effect, still the same `ExamRpcs`), noted as a deviation — the CONTRACT (`ExamRpcs`) must not change.

---

### Task 4: `packages/api-contract` export for the client (type only)

**Files:**
- Modify: `packages/rpc-contract/src/index.ts` — ensure `ExamRpcs` + `ExamRouter` type are exported for the mobile client (Plan 3 `rpc-react` consumes them).

- [ ] Confirm the client can import `ExamRpcs` + `QuestionWire` type from `@perminou/rpc-contract`. Add a type-level test (`expectTypeOf`) if useful. Commit `chore(rpc-contract): finalize client-facing exports`.

---

## Self-Review

**Spec coverage:** serve random exam + full set (T1 repo reads → T3 use-cases/handlers); `@effect/rpc` contract shared (T2/T4); Hono host + health (T3); Testcontainers for repo/handler tests; media stays client-derived (no URLs on the wire). Menu scope (mock-exam/practice/media-filter) is satisfiable from `GetExam`/`GetAllQuestions` client-side.

**Placeholder scan:** concrete tasks carry code; the `@effect/rpc` server-mount specifics are the one area an implementer resolves against the installed package (documented, with a stated fallback) — not a silent gap.

**Type consistency:** `QuestionWire` mirrors domain `Question` exactly; `ExamRpcs` names (`GetExam`/`GetAllQuestions`) identical across T2 (def), T3 (handlers), Plan 3 (client). Repo methods `allQuestions`/`randomQuestions` identical T1↔T3.

**Deferred:** true course-category browsing (needs more scraping); the upsert-transaction wrap (still logged from Plan 5). Neither blocks this plan.
