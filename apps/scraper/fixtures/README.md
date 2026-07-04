# Fixtures

HTML fixtures for the Playwright `SourceGateway` adapter (Task 5) are recorded
manually from an authenticated, service-worker-disabled Playwright session
against the live NARSA site, via `apps/scraper/scripts/capture-fixtures.ts`
(`pnpm --filter @perminou/scraper capture-fixtures`):

1. Log in with `.env` (`NARSA_USERNAME` / `NARSA_PASSWORD`).
2. Save the raw HTML of one exam question page to `exam-question.html`.
3. Complete the exam and save the raw HTML of the correction page to
   `exam-correction.html`.
4. Scrub both files of the CSRF token and any personal/account info before
   committing (the script does this automatically).

Task 4's `buildQuestion` is pure and does not depend on these HTML fixtures —
it operates on the already-parsed `RawQuestion`/correction shape and is
tested with inline fixture data in
`apps/scraper/test/build-question.test.ts`.

## Recorded fixtures (2026-07-04)

- `exam-question.html` — one exam-question page (image+audio question,
  category "B"), parsed by `src/adapters/parse-question-html.ts`.
- `exam-correction.html` — the end-of-exam correction, parsed by
  `src/adapters/parse-correction-html.ts`.

**Discovery:** the correction reveals the correct answer's 1-based *index*
(its on-page position), never its `narsaId` — the answer checkbox's own DB id
never appears in the correction markup at all. Downstream code (`buildQuestion`,
the harvest orchestrator) must join `correctByQuestion[id]` against
`RawQuestion.answers[].index`, not `.narsaId`. See the doc comment on
`RawCorrection` in `src/domain/ports/source-gateway.ts`.

**Also discovered:** most NARSA question ids are numeric, but a handful use an
alphanumeric id (`IS014`, `IS040`, `ISR003`, `ISR001` in this capture) for what
looks like a special-signage sub-bank. The current domain model only accepts
numeric ids (ADR 0002), so `parse-question-html.ts` fails loud
(`ScrapeShapeError`) if one of these is the *current* question, and
`parse-correction-html.ts` skips them in the correction table (they can never
join back to a numeric `RawQuestion.id` anyway). This is a known gap for a
future task, not something Task 5 resolves.
