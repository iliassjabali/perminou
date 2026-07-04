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
