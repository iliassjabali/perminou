# Database seed

`perminou-questions.sql` is a **data-only** dump of the harvested NARSA question bank
(385 questions, 1049 answers, 503 correct) — so you don't have to re-run the scraper.

## Restore into a fresh local DB

```bash
docker compose up -d db                                   # from repo root
pnpm --filter @perminou/scraper db:migrate                # create the schema (Drizzle migrations)
docker exec -i perminou-db psql -U perminou -d perminou < packages/db/seed/perminou-questions.sql
```

Regenerate after a re-scrape:
```bash
docker exec perminou-db pg_dump -U perminou -d perminou --data-only --no-owner --column-inserts \
  -t questions -t answers > packages/db/seed/perminou-questions.sql
```
