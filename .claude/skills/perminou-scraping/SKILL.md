---
name: perminou-scraping
description: Use when building, changing, or debugging the Perminou scraper — harvesting NARSA's driving-exam question bank from perminou.narsa.gov.ma into Postgres. Covers the hybrid Playwright-auth + HTTP-bulk engine, the SourceGateway port (Effect Context.Tag), session re-auth on expiry, gentle rate-limiting with Schedule, resource-safe browsers with Scope, resumability, recorded HTML fixtures, and the opt-in drift test. Applies when the source HTML changes, scrapes break, or answers aren't in the DOM.
---

# Perminou Scraping

## Overview

The source (`perminou.narsa.gov.ma`) is a **Django server-rendered site** behind **session-cookie auth**, bilingual (fr/ar), buggy and fragile (it leaks raw Django URL regex into links and has an incomplete TLS cert chain). We harvest its full question bank **into Postgres** (via the shared `packages/db` `pgTable` schema the backend reads). Written in **Effect** — see `perminou-effect`.

**Core principle:** the live site is the enemy of determinism. Quarantine it behind **one port** (`SourceGateway`, a `Context.Tag`). Everything downstream (normalization, persistence) operates on captured bytes, never the network — pure and unit-testable by providing a fixture `Layer`.

> ⚠️ **The HTML selectors in this skill are UNVERIFIED EXAMPLES.** No scraping spike has run yet, so `[data-question-text]`, `[data-correct]`, etc. are placeholders illustrating shape — NOT confirmed selectors. Resolve the real DOM structure via the spike (below) before trusting any of them.

## Hybrid engine (ADR 0002)

| Concern | Adapter (`Layer`) | Why |
|---|---|---|
| Login, session capture, JS-built links, answer-revealing interactions | **Playwright** (real Chromium) | handles auth, flaky TLS, and *submitting a quiz to reveal correct answers* if not in raw HTML |
| Bulk page + image fetches | **HTTP** (got + cheerio) with the captured cookie | fast, light; most pages are static HTML |

Playwright authenticates once and hands the session cookie to the HTTP adapter. Both `Layer`s implement the same `SourceGateway` Tag. Runs on **Node** (Playwright + Testcontainers are Node-first).

## The pivotal unknown — resolve it FIRST (spike)

**Are correct answers present in the page HTML, or only revealed after submitting a quiz?** This decides scraper complexity, and it is **still open**:
- answers in the DOM → HTTP bulk is enough.
- not → Playwright simulates a submission per quiz and reads the result page.

Record the finding + the real selectors in `docs/adr/0002`, then replace the placeholder selectors here.

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

## Example — normalization is pure, driven by fixtures (selectors are PLACEHOLDERS)

```ts
// apps/scraper/src/domain/normalize-question.ts
// PURE: input is captured bytes; output is a decoded domain entity. No I/O. Failure is typed.
// NOTE: [data-question-text]/[data-answer]/[data-correct] are UNVERIFIED placeholders — confirm via the spike.
import { Effect, Schema } from 'effect';
import { Question } from '@perminou/domain';
import * as cheerio from 'cheerio';

export const normalizeQuestion = (page: RawPage) =>
  Effect.gen(function* () {
    const $ = cheerio.load(page.html);
    const text = $('[data-question-text]').text().trim();   // placeholder selector
    if (!text) {
      return yield* Effect.fail(
        new ScrapeShapeError({ url: page.url, reason: 'missing question text', htmlSnippet: page.html.slice(0, 400) }),
      );
    }
    const answers = $('[data-answer]').map((_, el) => ({    // placeholder selectors
      label: $(el).text().trim(),
      correct: $(el).attr('data-correct') === 'true',
    })).get();

    return yield* Schema.decodeUnknown(Question)({          // validate at the boundary
      sourceUrl: page.url, text, answers,
      lang: page.url.includes('/ar/') ? 'ar' : 'fr',
    });
  });
```

```ts
// apps/scraper/test/normalize-question.test.ts (Vitest)
import { Effect } from 'effect';
import { readFileSync } from 'node:fs';

test('extracts a fr question + correct answer from recorded HTML', async () => {
  const page = { url: 'https://.../fr/quiz/12', html: readFileSync('fixtures/quiz-12-fr.html', 'utf8') };
  const q = await Effect.runPromise(normalizeQuestion(page));
  expect(q.answers.filter((a) => a.correct)).toHaveLength(1);
});
```

## Common mistakes

- **Hitting the live site from a unit test.** Provide `SourceGatewayFixture`. Only the drift test touches the network.
- **Trusting the placeholder selectors.** Run the spike; record real selectors in ADR 0002; then update this skill.
- **Swallowing parse failures.** A missing selector must fail with `ScrapeShapeError`, not produce a half-question.
- **Unbounded concurrency / hand-rolled retry loops.** Use `Effect.forEach({ concurrency })` + `Schedule`. Be gentle.
- **Leaking Playwright resources.** Acquire with `acquireRelease`/`Scope`.
- **Non-idempotent writes.** Upsert by stable source key; a re-run must not duplicate rows.
- **Parsing a signin page as content.** Detect redirect-to-`/signin`, raise `SessionExpired`, re-auth, resume.
- **Assuming `/fr/` and `/ar/` are identical.** Separate pages; scrape and store both languages.

## Related skills

- `perminou-effect` — Schedule, Scope, Data.TaggedError, Layers (the primitives used here)
- `perminou-architecture` — where the scraper sits; `packages/db` shared schema
- `perminou-testing` — fixtures, drift test, Vitest conventions
