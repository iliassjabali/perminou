import { test, expect, beforeAll, afterAll } from 'vitest';
import { Effect } from 'effect';
import { serve, type ServerType } from '@hono/node-server';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { applyMigrations, QuestionRepositoryLive } from '@perminou/db';
import { QuestionRepository } from '@perminou/domain';
import { makeApp } from '@perminou/backend/src/http';
import { makeExamClient } from '../src/client';

// De-risk gate (Plan 3, Task 1): does the @effect/rpc CLIENT genuinely talk to our real
// backend from plain Node? Boots a real server (Hono + @hono/node-server) backed by a
// real Testcontainers Postgres, then drives it with `makeExamClient` — no mocking.

let container: StartedPostgreSqlContainer;
let server: ServerType;
let baseUrl: string;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16').start();
  const uri = container.getConnectionUri();
  await applyMigrations(uri);

  const seed = [1, 2, 3].map((n) => ({
    id: String(n),
    category: 'B',
    hasImage: true,
    hasAudio: false,
    answers: [{ narsaId: n, index: 1, correct: true }],
  }));
  await Effect.runPromise(
    Effect.gen(function* () {
      const repo = yield* QuestionRepository;
      for (const q of seed) yield* repo.upsertQuestion(q as never);
    }).pipe(Effect.provide(QuestionRepositoryLive(uri))),
  );

  const { app } = makeApp(QuestionRepositoryLive(uri));
  await new Promise<void>((resolve) => {
    server = serve({ fetch: app.fetch, port: 0 }, (info) => {
      baseUrl = `http://localhost:${info.port}`;
      resolve();
    });
  });
}, 120000);

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await container.stop();
});

test('makeExamClient talks to the real backend over real HTTP', async () => {
  const program = Effect.gen(function* () {
    const client = yield* makeExamClient(`${baseUrl}/rpc`);
    const exam = yield* client.GetExam({ count: 2 });
    const all = yield* client.GetAllQuestions({});
    return { exam, all };
  });

  const { exam, all } = await Effect.runPromise(program.pipe(Effect.scoped));

  expect(exam).toHaveLength(2);
  expect(all.length).toBeGreaterThanOrEqual(3);
  for (const q of exam) {
    expect(typeof q.id).toBe('string');
    expect(Array.isArray(q.answers)).toBe(true);
  }
});
