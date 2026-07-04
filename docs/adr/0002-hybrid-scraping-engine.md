# 0002 — Scraping engine (Playwright-primary) + public-media HTTP

**Status:** Accepted — spike complete (2026-07-04). One implementation detail (exact correction markup) deferred to Plan 5.

## Context

`perminou.narsa.gov.ma` is a **Django server-rendered PWA** behind **session-cookie auth**, bilingual (fr/ar), buggy and fragile. The 2026-07-04 spike (driving the live site on a logged-in session) settled the open questions.

## Spike findings (confirmed)

- **No API.** No JSON endpoint; a guessed per-question route returns 404. Content is server-rendered HTML only.
- **Question model:** each question has an **ID** — mostly numeric, but **~10% are alphanumeric** (`IS014`, `ISR001` — the signage sub-bank), so `QuestionId` is modeled as a **string**. The prompt and answer *meaning* live in an **image** (`.png`/`.gif`) and/or **audio** (`.mp3`); the on-page "answers" are **numbered checkboxes (2–4, multi-select)** with their own DB IDs. A question may be image-only (146), image+audio (565), or audio-only (800).
- **Correction format** (Task-5 capture): the end-of-exam page has one `div#questionModal_N` per slot with `img#modalQuestionImage_N` (→ the question id via its media URL) and, per correct answer, a `div.modal-answer > div.fw-bold1` reading `"<index>: C'est la bonne réponse"`. **Correctness is by 1-based index (on-page position), never by the answer's DB id** — so downstream joins correctness on `index`.
- **Media is PUBLIC** (no auth): `/media/uploads/questions/{images|son}/{fr|ar}/{id}.{png|mp3}`, per language, ~0.5 MB images / ~0.2 MB audio. IDs are **sparse** (not every integer is a question).
- **Correct answers are NOT in the DOM.** They're revealed only by completing the exam (submit each with "Valider", then the correction). Exact correction markup → captured in Plan 5 with Playwright.
- **No deterministic listing.** The per-chapter links are broken (raw Django URL-regex leaks into `href`). The only enumerator is **Examen Blanc**: 1 random question per load, 40 per exam, "Valider" POSTs to advance.
- **PWA service worker** serves an "offline template" fallback under bursty requests → the scraper must run with **service workers disabled**.
- **Sessions are short-lived** (~30 min) → re-auth on redirect-to-signin.
- **Auth scope:** only the *exam pages* need the session; **media is fetched anonymously over HTTP**.

## Decision

**Playwright-primary**, behind the `SourceGateway` port, service workers disabled:
- **Playwright** (real Chromium, logged in via `.env` creds): drive the Examen Blanc loop — read each question (id from its media URL + answer option IDs), submit, and parse the correction for the correct answer set. **Loop-until-dry**: repeat exams, dedup by question ID, stop after K consecutive exams add nothing new.
- **Public HTTP** (got): fetch each discovered question's image + audio for **both** `fr` and `ar` by ID — no session needed.
- Upsert into Postgres keyed on the **NARSA numeric question ID** (stable identity — this also resolves the upsert-idempotency concern from ADR 0006's review).

## Consequences

- Full-bank coverage is **statistical** (loop-until-dry), not a guaranteed 100% — the price of no API/listing. `log()` the saturation curve so coverage is visible.
- Media step is trivial and cheap (public, cacheable).
- The scraper is stateful and slow (drives a real exam UI), but it's an occasional batch job.
- Tests use recorded fixtures (`SourceGatewayFixture`); the opt-in drift test is the only live-touching check.

## Alternatives rejected

- **HTTP-only** — can't drive the JS/PWA exam flow or the correction reveal.
- **Enumerate media by ID `1..N`** — finds media but not question text/answers/correctness, and IDs are sparse (mostly 404s).
- **Python (Scrapy/Playwright)** — capable, but a second language outside the TS/Effect stack.
