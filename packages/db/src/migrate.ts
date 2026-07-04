import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

export async function applyMigrations(connectionUri: string): Promise<void> {
  const sql = postgres(connectionUri, { max: 1 });
  await migrate(drizzle(sql), { migrationsFolder: new URL('../migrations', import.meta.url).pathname });
  await sql.end();
}
