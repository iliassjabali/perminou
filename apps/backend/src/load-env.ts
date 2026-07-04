// Load the repo-root .env regardless of CWD. `pnpm --filter @perminou/backend …`
// runs in apps/backend/, so the default `dotenv/config` (which reads CWD/.env) would
// miss the repo-root .env and leave DATABASE_URL/PORT undefined. Import this module
// (for its side effect) BEFORE reading process.env. Mirrors apps/scraper/src/load-env.ts.
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)); // apps/backend/src
config({ path: path.resolve(here, '../../../.env') }); // repo root
