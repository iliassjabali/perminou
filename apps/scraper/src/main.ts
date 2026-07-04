import 'dotenv/config';
import { Layer, ManagedRuntime } from 'effect';
import { QuestionRepositoryLive } from '@perminou/db';
import { PlaywrightSourceGatewayLive } from './adapters/playwright-source-gateway';
import { MediaProbeLive } from './adapters/http-media';
import { harvest } from './application/harvest';

// Composition root. Wires the live adapters and runs the harvest.
// Requires NARSA_USERNAME / NARSA_PASSWORD and DATABASE_URL in the environment.
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set (see .env / docker-compose.yml)');
}

const MainLayer = Layer.mergeAll(
  PlaywrightSourceGatewayLive,
  QuestionRepositoryLive(DATABASE_URL),
  MediaProbeLive,
);

const runtime = ManagedRuntime.make(MainLayer);

runtime
  .runPromise(harvest({ dryRounds: 3 }))
  .then((s) => {
    // eslint-disable-next-line no-console
    console.log(`Harvest complete: ${s.totalQuestions} questions in ${s.rounds} rounds`);
  })
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Harvest failed:', e);
    process.exitCode = 1;
  })
  .finally(() => runtime.dispose());
