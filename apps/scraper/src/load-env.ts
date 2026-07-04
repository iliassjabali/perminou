// Load the repo-root .env regardless of CWD. `pnpm --filter @perminou/scraper …`
// runs in apps/scraper/, so the default `dotenv/config` (which reads CWD/.env)
// would miss the repo-root .env and leave NARSA_USERNAME/PASSWORD/DATABASE_URL
// undefined. Import this module (for its side effect) BEFORE reading process.env.
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)); // apps/scraper/src
config({ path: path.resolve(here, '../../../.env') }); // repo root
