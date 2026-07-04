// Apply the @perminou/db migrations to the DATABASE_URL from the repo-root .env.
// Run: pnpm --filter @perminou/scraper db:migrate  (with `docker compose up -d db` running)
import '../src/load-env';
import { applyMigrations } from '@perminou/db';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set (see .env / docker-compose.yml)');
  process.exit(1);
}

applyMigrations(url)
  .then(() => {
    console.log('migrations applied');
    process.exit(0);
  })
  .catch((e) => {
    console.error('migration failed:', e);
    process.exit(1);
  });
