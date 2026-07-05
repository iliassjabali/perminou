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

test('CORS: OPTIONS /rpc preflight is allowed for a browser origin', async () => {
  const { app } = makeApp(QuestionRepositoryTest);
  const res = await app.request('/rpc', {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:8081', 'Access-Control-Request-Method': 'POST' },
  });
  // The web client (served from a different origin) must be allowed to call /rpc.
  expect(res.headers.get('access-control-allow-origin')).toBe('*');
});
