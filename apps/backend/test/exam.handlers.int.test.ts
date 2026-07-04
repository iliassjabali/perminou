import { test, expect, beforeAll, afterAll } from 'vitest';
import { Effect, Layer } from 'effect';
import * as Headers from '@effect/platform/Headers';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { applyMigrations, QuestionRepositoryLive } from '@perminou/db';
import { QuestionRepository } from '@perminou/domain';
import { ExamRpcs } from '@perminou/rpc-contract';
import { ExamHandlersLive } from '../src/adapters/inbound/exam.handlers';

let container: StartedPostgreSqlContainer;
let uri: string;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16').start();
  uri = container.getConnectionUri();
  await applyMigrations(uri);
}, 120000);

afterAll(async () => {
  await container.stop();
});

test('GetExam / GetAllQuestions handlers return seeded questions from real Postgres', async () => {
  const seed = [1, 2, 3, 4, 5].map((n) => ({
    id: String(n),
    category: 'B',
    hasImage: true,
    hasAudio: false,
    answers: [
      { narsaId: n * 10, index: 1, correct: true },
      { narsaId: n * 10 + 1, index: 2, correct: false },
    ],
  }));

  // provideMerge: the same QuestionRepository instance backs both the handlers under test
  // AND this test's direct seeding call — mirrors how main.ts wires the composition root.
  const TestLayer = Layer.provideMerge(ExamHandlersLive, QuestionRepositoryLive(uri));

  const program = Effect.gen(function* () {
    const repo = yield* QuestionRepository;
    for (const q of seed) yield* repo.upsertQuestion(q as never);

    const getExam = yield* ExamRpcs.accessHandler('GetExam');
    const getAllQuestions = yield* ExamRpcs.accessHandler('GetAllQuestions');

    const exam = yield* getExam({ count: 3 }, Headers.empty);
    const all = yield* getAllQuestions({}, Headers.empty);
    return { exam, all };
  });

  const { exam, all } = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

  expect(exam).toHaveLength(3);
  expect(all.length).toBeGreaterThanOrEqual(5);
  expect(all.map((q) => q.id)).toEqual(expect.arrayContaining(['1', '2', '3', '4', '5']));
});
