import { test, expect, beforeAll, afterAll } from 'vitest';
import { Effect, Layer } from 'effect';
import { serve, type ServerType } from '@hono/node-server';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { applyMigrations, QuestionRepositoryLive } from '@perminou/db';
import { QuestionRepository } from '@perminou/domain';
import { ExamRpcs } from '@perminou/rpc-contract';
import * as RpcClient from '@effect/rpc/RpcClient';
import * as RpcSerialization from '@effect/rpc/RpcSerialization';
import { FetchHttpClient } from '@effect/platform';
import { makeApp } from '../src/http';

// This is the risk area the plan flagged explicitly: does @effect/rpc actually mount
// on Hono + @hono/node-server and round-trip real HTTP requests? Verified here with a
// real server on an ephemeral port and a real @effect/rpc HTTP client (no mocking).

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

test('POST /rpc serves GetAllQuestions/GetExam over real HTTP via Hono + @hono/node-server', async () => {
  const ClientLayer = RpcClient.layerProtocolHttp({ url: `${baseUrl}/rpc` }).pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(RpcSerialization.layerJson),
  );

  const program = Effect.gen(function* () {
    const client = yield* RpcClient.make(ExamRpcs);
    const all = yield* client.GetAllQuestions({});
    const exam = yield* client.GetExam({ count: 2 });
    return { all, exam };
  });

  const { all, exam } = await Effect.runPromise(
    program.pipe(Effect.provide(ClientLayer), Effect.scoped),
  );

  expect(all.length).toBeGreaterThanOrEqual(3);
  expect(exam).toHaveLength(2);
});
