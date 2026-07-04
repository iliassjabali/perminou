import { test, expect, beforeAll, afterAll } from 'vitest';
import { Effect } from 'effect';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { applyMigrations } from '../src/migrate';
import { QuestionRepository } from '@perminou/domain';
import { QuestionRepositoryLive } from '../src/question-repository';

let container: StartedPostgreSqlContainer;
let uri: string;
beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16').start();
  uri = container.getConnectionUri();
  await applyMigrations(uri);
}, 120000);
afterAll(async () => { await container.stop(); });

test('upsert is idempotent by NARSA id and replaces answers', async () => {
  const q = { id: '565', category: 'B', hasImage: true, hasAudio: true,
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

test('persists alphanumeric signage question ids (e.g. IS014)', async () => {
  const q = { id: 'IS014', category: 'B', hasImage: true, hasAudio: false,
    answers: [ { narsaId: 1, index: 1, correct: true }, { narsaId: 2, index: 2, correct: false } ] };
  const program = Effect.gen(function* () {
    const repo = yield* QuestionRepository;
    yield* repo.upsertQuestion(q as never);
    return yield* repo.questionsByCategory('B');
  });
  const rows = await Effect.runPromise(program.pipe(Effect.provide(QuestionRepositoryLive(uri))));
  expect(rows.map((r) => r.id)).toContain('IS014');
});

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
