// Playwright SourceGateway adapter — the only place that touches the live
// NARSA site. Not unit-tested directly (see the opt-in drift test, Task 8);
// this file must stay typecheck-clean and is exercised manually via
// `scripts/capture-fixtures.ts` and, later, the drift test.
import { Effect, Layer, Schedule, Duration } from 'effect';
import { chromium, type Page } from 'playwright';
import {
  SourceGateway,
  type Session,
  type RawQuestion,
  type RawCorrection,
} from '../domain/ports/source-gateway';
import { AuthError, SessionExpired, FetchError } from '../domain/errors';
import { parseQuestionHtml } from './parse-question-html';
import { parseCorrectionHtml } from './parse-correction-html';

const BASE_URL = 'https://perminou.narsa.gov.ma';
const SIGNIN_URL = `${BASE_URL}/accounts/signin/`;
const EXAM_URL = `${BASE_URL}/quizexamenblanc/take/`;

/**
 * The public `Session` is opaque (`{ cookie: string }`) — this adapter is the
 * only producer of `Session` values, and every one it hands out actually
 * carries the live Playwright `Page` driving that exam run.
 */
interface PlaywrightSession extends Session {
  readonly page: Page;
}

const asPlaywrightSession = (s: Session): PlaywrightSession => s as PlaywrightSession;

const assertNotSignedOut = (page: Page) =>
  page.url().includes('/accounts/signin/')
    ? Effect.fail(new SessionExpired({ url: page.url() }))
    : Effect.void;

const make = Effect.gen(function* () {
  const browser = yield* Effect.acquireRelease(
    Effect.promise(() => chromium.launch({ headless: true })),
    (b) => Effect.promise(() => b.close()),
  );

  // Service workers MUST be blocked — the PWA's offline fallback otherwise
  // masks real content under bursty requests (ADR 0002).
  const context = yield* Effect.acquireRelease(
    Effect.promise(() => browser.newContext({ serviceWorkers: 'block' })),
    (c) => Effect.promise(() => c.close()),
  );

  // The exam is a STATEFUL flow: we navigate to the exam URL once per exam, then
  // "Valider" advances question-to-question in place. Re-navigating per question
  // both disrupts that state and hammers the site (→ ERR_CONNECTION_RESET). Track
  // whether an exam is currently in progress so we only goto at the start of one.
  let examInProgress = false;
  // Gentle backoff for transient navigation errors (network resets etc.).
  const gotoRetry = Schedule.exponential(Duration.seconds(1)).pipe(Schedule.compose(Schedule.recurs(3)));

  const login = () =>
    Effect.gen(function* () {
      const page = yield* Effect.tryPromise({
        try: () => context.newPage(),
        catch: () => new AuthError({}),
      });

      yield* Effect.tryPromise({
        try: async () => {
          await page.goto(SIGNIN_URL, { waitUntil: 'domcontentloaded' });
          await page.fill('input[name="username"]', process.env.NARSA_USERNAME ?? '');
          await page.fill('input[name="password"]', process.env.NARSA_PASSWORD ?? '');
          const submit = page
            .locator(
              'form:has(input[name="password"]) button[type="submit"], form:has(input[name="password"]) input[type="submit"]',
            )
            .first();
          if (await submit.count()) {
            await submit.click();
          } else {
            await page.locator('input[name="password"]').press('Enter');
          }
          await page.waitForLoadState('domcontentloaded');
        },
        catch: () => new AuthError({}),
      });

      if (page.url().includes('/accounts/signin/')) {
        return yield* Effect.fail(new AuthError({ status: 401 }));
      }

      const session: PlaywrightSession = { cookie: page.url(), page };
      return session;
    });

  const nextExamQuestion = (s: Session) =>
    Effect.gen(function* () {
      const { page } = asPlaywrightSession(s);
      // Only navigate at the START of an exam; within an exam "Valider" already
      // moved us to the current question, so we just read the page in place.
      if (!examInProgress) {
        yield* Effect.tryPromise({
          try: () => page.goto(EXAM_URL, { waitUntil: 'domcontentloaded' }),
          catch: (cause) => new FetchError({ url: EXAM_URL, cause }),
        }).pipe(
          Effect.retry(gotoRetry),
          Effect.tapError(() => Effect.sync(() => { examInProgress = false; })),
        );
        examInProgress = true;
      }
      yield* assertNotSignedOut(page);
      const html = yield* Effect.promise(() => page.content());
      const question: RawQuestion = yield* parseQuestionHtml(html, EXAM_URL).pipe(
        Effect.mapError((cause) => new FetchError({ url: EXAM_URL, cause })),
      );
      return question;
    });

  const submitAndAdvance = (s: Session, answerNarsaIds: number[]) =>
    Effect.gen(function* () {
      const { page } = asPlaywrightSession(s);
      yield* Effect.tryPromise({
        try: async () => {
          for (const narsaId of answerNarsaIds) {
            await page.locator(`input[name="answers"][value="${narsaId}"]`).check();
          }
          await page.locator('input[value="Valider"]').first().click();
          await page.waitForLoadState('domcontentloaded');
          await new Promise((r) => setTimeout(r, 350)); // gentle: don't hammer the gov service
        },
        // Not retried: re-clicking Valider would double-submit. A failure abandons
        // the exam (reset the flag so the next question starts a fresh one).
        catch: (cause) => new FetchError({ url: EXAM_URL, cause }),
      }).pipe(Effect.tapError(() => Effect.sync(() => { examInProgress = false; })));
      yield* assertNotSignedOut(page);
      const remaining = yield* Effect.promise(() => page.locator('input[name="answers"]').count());
      if (remaining === 0) {
        examInProgress = false; // exam finished — next nextExamQuestion starts fresh
        return 'done' as const;
      }
      return 'more' as const;
    });

  const fetchCorrection = (s: Session) =>
    Effect.gen(function* () {
      const { page } = asPlaywrightSession(s);
      yield* assertNotSignedOut(page);
      const html = yield* Effect.promise(() => page.content());
      const correction: RawCorrection = yield* parseCorrectionHtml(html, EXAM_URL).pipe(
        Effect.mapError((cause) => new FetchError({ url: EXAM_URL, cause })),
      );
      return correction;
    });

  return { login, nextExamQuestion, submitAndAdvance, fetchCorrection };
});

export const PlaywrightSourceGatewayLive = Layer.scoped(SourceGateway, make);
