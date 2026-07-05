# Perminou

An **audio-first "Tinder for questions"** app to practice the Moroccan driving-license theory exam (*code de la route*). A scraper harvested NARSA's official bank — **385 questions, 1,049 answers, 100% audio** — into Postgres; an Effect/Hono `@effect/rpc` backend serves it; an Expo app presents it as a **swipeable deck**: each card auto-plays the spoken question, shows the image + numbered answers, tap + **Valider** to reveal green/red, **swipe right = got-it / left = review**. Practice · scored Mock-Exam · Review · **fr/العربية** toggle.

> Personal-use project. Not affiliated with NARSA. Media is fetched from NARSA's public host.

## The whole thing, end to end

```
NARSA (Django, session-auth)
   │  scraper (Playwright loop-until-dry, gentle, resilient)
   ▼
Postgres  ── 385 questions + answers (correct = 1-based index)  [seed: packages/db/seed]
   │  @effect/rpc backend over Hono (GET /health, POST /rpc)
   ▼
rpc-react  ── typed `api` proxy over @effect/rpc client + react-query + MMKV persisted cache
   │
   ▼
Expo app (NativeWind) ── Home → Practice / Mock Exam / Review, swipe deck, audio-first, fr/ar
```

## Monorepo

```
packages/
  domain/        Effect Schema entities + ports (Tags). Pure.
  db/            Drizzle pgTable schema + migrations + QuestionRepository (Postgres). + seed/ (data dump)
  rpc-contract/  @effect/rpc RpcGroup (ExamRpcs) + QuestionWire — shared server+client
  rpc-react/     custom lib: typed `api` proxy (react-query) + MMKV persisted cache (+ /native Expo preset)
apps/
  scraper/       Playwright + HTTP harvester → Postgres; opt-in live drift test
  backend/       Effect + Hono @effect/rpc API (GetExam / GetAllQuestions + health + CORS)
  mobile/        Expo Tinder deck (gesture-handler + reanimated, expo-audio, native-stack nav)
docs/adr/        8 ADRs · docs/superpowers/{specs,plans} · .claude/skills/ (perminou-*)
```

## Tech stack

All-in **Effect** (domain + scraper + backend) on **Node** · **@effect/rpc** over **Hono** · **Drizzle**/Postgres (`@effect/sql-drizzle`) · **Expo + NativeWind + gesture-handler/reanimated** · custom **rpc-react** (react-query + MMKV) · **Vitest** + Testcontainers · **pnpm + Turborepo**. See `docs/adr/` (0001–0008) for the decisions and rejected alternatives.

## Run the full stack locally

**Prereqs:** Node ≥ 24, pnpm ≥ 9, Docker, Expo Go (for phone/audio).

```bash
pnpm install
cp .env.example .env                        # set NARSA_USERNAME/PASSWORD only if you plan to re-scrape

# 1. Database (with the seeded 385 questions — no scrape needed)
docker compose up -d db
pnpm --filter @perminou/scraper db:migrate
docker exec -i perminou-db psql -U perminou -d perminou < packages/db/seed/perminou-questions.sql

# 2. Backend API (:3000)
pnpm --filter @perminou/backend dev

# 3. App — set the API URL to your Mac's LAN IP, then start Expo
echo "EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000" > apps/mobile/.env
pnpm --filter mobile start
#   • Web:   http://localhost:8081  (visual UX; audio limited in-browser)
#   • Phone: Expo Go → exp://<your-lan-ip>:8081  (full audio)
```

Re-harvest the bank (needs your NARSA creds in `.env`): `pnpm --filter @perminou/scraper scrape`.

## Status

| Area | State |
|---|---|
| `packages/domain`, `db` (schema + repo) | ✅ built, tested (Testcontainers) |
| `apps/scraper` — harvested the full bank | ✅ 385 questions in Postgres + committed seed |
| `apps/backend` — `@effect/rpc` API + CORS | ✅ built, tested (real HTTP round-trip) |
| `packages/rpc-contract`, `rpc-react` | ✅ built; `@effect/rpc` client bundles on Metro/Hermes |
| `apps/mobile` — Tinder deck (Practice/Exam/Review, fr/ar) | ✅ built, bundles clean |
| 100+ tests, typecheck 7/7 | ✅ green |

**Known follow-ups:** on-device runtime confirmation (Hermes `TextEncoder` polyfill, audio); deeper card-level RTL (Home is RTL); mock-exam exhaustion edge case; backend readiness probe + graceful shutdown; align the split `@effect/platform` versions; a web `localStorage` fallback if MMKV ever misbehaves in-browser.

## Documentation

- **[docs/STATUS.md](docs/STATUS.md)** — full build journey, decisions, pivots, and current state (the context).
- **[CLAUDE.md](CLAUDE.md)** — working agreement, stack, rules, commands.
- **[docs/adr/](docs/adr/)** — 8 ADRs, each with alternatives rejected.
- **[docs/superpowers/](docs/superpowers/)** — the design spec + the 4 implementation plans.
- **[.claude/skills/](.claude/skills/)** — `perminou-*` skills (architecture, effect, scraping, testing, mobile-ui, scaffolding).
