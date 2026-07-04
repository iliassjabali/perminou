// OPT-IN DRIFT TEST — this file is `.live.ts`, NOT `.test.ts`, so `pnpm test`
// never runs it. Run manually / nightly with `pnpm --filter @perminou/scraper drift`.
// It hits the LIVE NARSA site (logs in via NARSA_USERNAME/NARSA_PASSWORD from .env)
// and asserts the exam markup still yields a well-shaped question. It is designed to
// FAIL LOUDLY when NARSA changes their HTML — a red drift test means "re-record the
// fixtures and re-check the parsers", not "the build is broken".
import '../src/load-env';
import { test, expect } from 'vitest';
import { Effect } from 'effect';
import { SourceGateway } from '../src/domain/ports/source-gateway';
import { PlaywrightSourceGatewayLive } from '../src/adapters/playwright-source-gateway';

test('live: NARSA exam markup still yields a well-shaped question', async () => {
  const program = Effect.gen(function* () {
    const gw = yield* SourceGateway;
    const session = yield* gw.login();
    return yield* gw.nextExamQuestion(session);
  });
  const q = await Effect.runPromise(program.pipe(Effect.provide(PlaywrightSourceGatewayLive)));

  expect(q.id.length).toBeGreaterThan(0);          // an id was parsed from a media URL
  expect(q.category.length).toBeGreaterThan(0);    // "Catégorie X" still present
  expect(q.answers.length).toBeGreaterThanOrEqual(2); // multi-select options still present
  expect(q.answers.every((a) => Number.isInteger(a.index) && a.index >= 1)).toBe(true);
}, 90_000);
