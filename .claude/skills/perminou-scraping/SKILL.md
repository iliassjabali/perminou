---
name: perminou-scraping
description: Use when building, changing, or debugging the Perminou scraper — harvesting NARSA's driving-exam question bank from perminou.narsa.gov.ma into Postgres. Covers the hybrid Playwright-auth + HTTP-bulk engine, the SourceGateway port (Effect Context.Tag), session re-auth on expiry, gentle rate-limiting with Schedule, resource-safe browsers with Scope, resumability, recorded HTML fixtures, and the opt-in drift test. Applies when the source HTML changes, scrapes break, or answers aren't in the DOM.
---

# Perminou Scraping

## Overview

The source (`perminou.narsa.gov.ma`) is a **Django server-rendered site** behind **session-cookie auth**, bilingual (fr/ar), buggy and fragile (it leaks raw Django URL regex into links and has an incomplete TLS cert chain). We harvest its full question bank **into Postgres** (via the shared `packages/db` `pgTable` schema the backend reads). Written in **Effect** — see `perminou-effect`.

**Core principle:** the live site is the enemy of determinism. Quarantine it behind **one port** (`SourceGateway`, a `Context.Tag`). Everything downstream (normalization, persistence) operates on captured bytes, never the network — pure and unit-testable by providing a fixture `Layer`.

> ✅ **Structure confirmed by the 2026-07-04 spike** (see ADR 0002). Key facts below are real, not placeholders. The one remaining detail — the exact HTML markup of the *correction* (how the correct answer set is marked) — is captured during Plan 5 with Playwright.

## Confirmed structure (spike 2026-07-04, ADR 0002)

- **No API.** Django SSR; no JSON endpoint (per-question route 404s).
- **Question = numeric ID + image and/or audio + numbered checkbox answers.** The prompt/answer *meaning* is in the image (`.png`) and/or audio (`.mp3`); on-page answers are **2–4 checkboxes (multi-select)** with DB IDs. Types vary: image-only (146), image+audio (565), audio-only (800).
- **Media is PUBLIC** (no auth): `/media/uploads/questions/{images|son}/{fr|ar}/{id}.{png|mp3}`, per language. IDs are sparse.
- **Correct answers are NOT in the DOM** — revealed only by completing the exam (submit each with "Valider", then the correction).
- **Enumeration:** no deterministic listing (chapter links are broken Django regex). Only path = **Examen Blanc** (`/quizexamenblanc/take/`): 1 random question/load, 40/exam, "Valider" POSTs to advance. Harvest via **loop-until-dry** (repeat exams, dedup by question ID).
- **PWA service worker** serves an offline fallback under bursty requests → run Playwright with **service workers disabled**.

## Hybrid engine (ADR 0002) — Playwright-primary

| Concern | Adapter (`Layer`) | Why |
|---|---|---|
| Login, drive the Examen-Blanc loop, submit + parse the **correction** | **Playwright** (real Chromium, SW disabled) | only way to enumerate + reveal correct answers |
| Fetch each question's image + audio (fr + ar) by ID | **HTTP** (got) — **no session** | media is public; cheap and cacheable |

Playwright authenticates (via `.env` creds) and enumerates; the HTTP adapter fetches media anonymously. Both `Layer`s implement the same `SourceGateway` Tag. Runs on **Node**. Upsert into Postgres keyed on the **NARSA numeric question ID** (stable identity).

## The SourceGateway port

```ts
// apps/scraper/src/domain/ports/source-gateway.ts
export class SourceGateway extends Context.Tag('SourceGateway')<
  SourceGateway,
  {
    readonly authenticate: (c: Credentials) => Effect.Effect<Session, AuthError>;
    readonly fetchPage: (url: string, s: Session) => Effect.Effect<RawPage, FetchError | SessionExpired>;
    readonly fetchMedia: (url: string, s: Session) => Effect.Effect<Uint8Array, FetchError | SessionExpired>;
    readonly revealQuizAnswers: (url: string, s: Session) => Effect.Effect<RawPage, FetchError | SessionExpired>;
  }
>() {}
```

- **Real Layers:** `PlaywrightSourceGatewayLive`, `HttpSourceGatewayLive`.
- **Test Layer:** `SourceGatewayFixture` — reads recorded HTML from `apps/scraper/fixtures/`. Tests NEVER hit the network.

**Sessions are short-lived** (observed: the NARSA session lapsed within ~30 min). Every fetch result must be checked for a **redirect to `/accounts/signin/`** (Django bounces expired sessions there, as a 302 or a signin-page body under a 200). On detection, raise `SessionExpired`, **re-authenticate via Playwright, and retry** — never treat the signin page as valid content. Model it as a dedicated typed error a `Schedule`-driven policy catches by re-running `authenticate` and resuming.

## Non-negotiables for a fragile source

1. **Gentle.** Cap concurrency (`Effect.forEach(..., { concurrency: 2 })`) + backoff (`Schedule`). Public gov service on your own session — do not hammer it.
2. **Resource-safe.** Acquire Playwright browsers/pages with `Effect.acquireRelease` so they close on failure/interruption — no leaked Chromium.
3. **Resumable & idempotent.** Persist progress; a re-run skips completed work. Writes to Postgres **upsert** by a stable source key (e.g. source URL / NARSA question id) so re-runs never duplicate rows.
4. **Fail loud, typed.** A missing selector fails with `ScrapeShapeError` carrying the URL + HTML snippet — never silently emit an empty/partial question.
5. **Validate at the boundary.** Every entity is decoded through the `packages/domain` Effect Schema before it's written. Invalid → typed `ParseError`, not a warning.
6. **Survive session expiry.** Detect redirect-to-`/signin`, raise `SessionExpired`, re-auth, resume. A signin page must never be parsed as content.

## Drift detection (the ONLY live-touching test)

Fixture tests prove the parser is correct against *known* HTML. A separate **opt-in drift test** fetches a couple of real pages and asserts the shape still matches — so we learn when NARSA changes their HTML.

- Lives outside the default suite (e.g. `pnpm --filter scraper drift`), runs manually or nightly in CI.
- **Designed to fail loudly.** A red drift test means "re-record fixtures and re-scrape," not "the build is broken."

## Example — parse one exam question, pure, driven by fixtures

```ts
// apps/scraper/src/domain/parse-exam-question.ts
// PURE: input is a captured exam-question HTML page; output is the question WITHOUT correctness
// (the correct answer set comes from the correction step, added later). No I/O; failure is typed.
import { Effect } from 'effect';
import * as cheerio from 'cheerio';

export const parseExamQuestion = (page: RawPage) =>
  Effect.gen(function* () {
    const $ = cheerio.load(page.html);
    const imgSrc = $('img[src*="/media/uploads/questions/images"]').attr('src');
    const sonSrc = $('audio source[src*="/son/"], audio[src*="/son/"]').attr('src');
    const id = imgSrc?.match(/\/(\d+)\.png/)?.[1] ?? sonSrc?.match(/\/(\d+)\.mp3/)?.[1];
    if (!id) {
      return yield* Effect.fail(new ScrapeShapeError({
        url: page.url, reason: 'no question id in media urls', htmlSnippet: page.html.slice(0, 400),
      }));
    }
    const lang = page.url.includes('/ar/') ? 'ar' : 'fr';
    const answerIds = $('input[name=answers]').map((_, el) => $(el).attr('value')).get();
    return {
      id: Number(id),
      lang,
      imageUrl: imgSrc ? `/media/uploads/questions/images/${lang}/${id}.png` : undefined,
      soundUrl: sonSrc ? `/media/uploads/questions/son/${lang}/${id}.mp3` : undefined,
      answerIds,          // e.g. ['933','934','935','936'] — correctness resolved from the correction
    };
  });
```

```ts
// apps/scraper/test/parse-exam-question.test.ts (Vitest)
import { Effect } from 'effect';
import { readFileSync } from 'node:fs';

test('extracts id + answer option ids from a recorded exam question', async () => {
  const page = { url: 'https://.../quizexamenblanc/take/', html: readFileSync('fixtures/exam-q565-fr.html', 'utf8') };
  const q = await Effect.runPromise(parseExamQuestion(page));
  expect(q.id).toBe(565);
  expect(q.answerIds).toHaveLength(4);
  expect(q.soundUrl).toContain('/son/fr/565.mp3');
});
```

## Common mistakes

- **Hitting the live site from a unit test.** Provide `SourceGatewayFixture`. Only the drift test touches the network.
- **Looking for question text in the DOM.** There is none — the prompt is in the image/audio. Parse the question **id** from the media URL and the **answer option IDs** from the checkboxes.
- **Expecting correctness in the question HTML.** It's not there — resolve it from the correction after completing the exam.
- **Leaving the service worker enabled.** Bursty requests trip the PWA offline fallback; launch the Playwright context with service workers disabled.
- **Fetching media through the session.** Media is public — fetch anonymously over HTTP (fr + ar).
- **Swallowing parse failures.** A missing id must fail with `ScrapeShapeError`, not produce a half-question.
- **Unbounded concurrency / hand-rolled retry loops.** Use `Effect.forEach({ concurrency })` + `Schedule`. Be gentle.
- **Leaking Playwright resources.** Acquire with `acquireRelease`/`Scope`.
- **Non-idempotent writes.** Upsert by stable source key; a re-run must not duplicate rows.
- **Parsing a signin page as content.** Detect redirect-to-`/signin`, raise `SessionExpired`, re-auth, resume.
- **Assuming `/fr/` and `/ar/` are identical.** Separate pages; scrape and store both languages.

## Related skills

- `perminou-effect` — Schedule, Scope, Data.TaggedError, Layers (the primitives used here)
- `perminou-architecture` — where the scraper sits; `packages/db` shared schema
- `perminou-testing` — fixtures, drift test, Vitest conventions
