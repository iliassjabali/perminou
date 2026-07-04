# 0002 — Hybrid scraping engine (Playwright + HTTP)

**Status:** Accepted — with one open spike

## Context

`perminou.narsa.gov.ma` is a **Django server-rendered site** behind **session-cookie auth**, bilingual (fr/ar). Recon found: no JSON API/SPA; JS-constructed links; an incomplete TLS cert chain; and **short-lived sessions** (observed lapse within ~30 min → redirect to `/accounts/signin/`). One question is unresolved: **are correct answers in the page HTML, or only revealed after submitting a quiz?**

## Decision

A **hybrid engine**, all behind one `SourceGateway` port (Effect `Context.Tag`):
- **Playwright** (real Chromium) — login, session capture, JS-built links, and *submitting quizzes to reveal answers* if needed.
- **HTTP** (got + cheerio) with the captured cookie — fast bulk page/image pulls.

Written in **TypeScript/Effect** (in-stack, shared domain types). Detects redirect-to-signin → raises `SessionExpired` → re-auths via Playwright → resumes. Gentle (bounded concurrency + `Schedule` backoff), resource-safe (`Scope`), idempotent (upsert by source key), writes into Postgres.

**Open spike (do first):** determine answers-in-DOM vs post-submit; record the real selectors here; then update the `perminou-scraping` skill (its selectors are currently unverified placeholders).

## Consequences

- Robust to auth, JS, flaky TLS, and session expiry.
- Slower than pure HTTP, but it's an occasional batch job — acceptable.
- Tests use recorded fixtures via `SourceGatewayFixture`; a separate opt-in drift test is the only live-touching check.

## Alternatives rejected

- **HTTP-only** — brittle against auth refresh, JS-built links, and answer-reveal.
- **Headless-only** — robust but needlessly slow for bulk static pages.
- **Python (Scrapy/Playwright)** — capable, but a second language outside the TS/Effect stack; no shared domain types.
