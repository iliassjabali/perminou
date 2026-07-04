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
  expect(rows[0]!.answers.filter((a) => a.correct)).toHaveLength(1);
});
