import './load-env';
import { serve } from '@hono/node-server';
import { QuestionRepositoryLive } from '@perminou/db';
import { makeApp } from './http';

// Composition root. Wires the live QuestionRepository adapter and serves the
// @effect/rpc exam API over Hono. Requires DATABASE_URL in the environment.
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set (see .env / docker-compose.yml)');
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const { app } = makeApp(QuestionRepositoryLive(DATABASE_URL));

serve({ fetch: app.fetch, port: PORT }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`@perminou/backend listening on http://localhost:${info.port}`);
});
