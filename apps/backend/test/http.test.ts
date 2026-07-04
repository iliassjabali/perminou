import { test, expect } from 'vitest';
import { Layer } from 'effect';
import { QuestionRepository } from '@perminou/domain';
import { Effect } from 'effect';
import { makeApp } from '../src/http';

const QuestionRepositoryTest = Layer.succeed(QuestionRepository, {
  upsertQuestion: () => Effect.void,
  questionsByCategory: () => Effect.succeed([]),
  allQuestions: () => Effect.succeed([]),
  randomQuestions: () => Effect.succeed([]),
});

test('GET /health returns 200 with {status: "ok"}', async () => {
  const { app } = makeApp(QuestionRepositoryTest);
  const res = await app.request('/health');
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: 'ok' });
});
