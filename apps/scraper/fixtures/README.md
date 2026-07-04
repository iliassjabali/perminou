# Fixtures

HTML fixtures for the Playwright `SourceGateway` adapter (Task 5) are recorded
manually from an authenticated, service-worker-disabled Playwright session
against the live NARSA site:

1. Log in with `.env` (`NARSA_USERNAME` / `NARSA_PASSWORD`).
2. Save the raw HTML of one exam question page to `exam-question.html`.
3. Complete the exam and save the raw HTML of the correction page to
   `exam-correction.html`.
4. Scrub both files of the CSRF token and any personal/account info before
   committing.

Task 4's `buildQuestion` is pure and does not depend on these HTML fixtures —
it operates on the already-parsed `RawQuestion`/correction shape and is
tested with inline fixture data in
`apps/scraper/test/build-question.test.ts`.

No fixtures are recorded yet (Task 5 is out of scope for this change).
