/**
 * One-off, manually-run capture script (Plan 5 / Task 5, Step 1).
 *
 * Logs into the live NARSA site with Playwright (service workers blocked),
 * captures one exam-question page and the end-of-exam correction page, and
 * writes SCRUBBED HTML fixtures used to TDD the parsers.
 *
 * SAFETY:
 *  - Credentials come ONLY from process.env.NARSA_USERNAME / NARSA_PASSWORD
 *    (loaded via dotenv from the repo root .env). They are never logged,
 *    printed, or written to any file.
 *  - Every saved fixture is scrubbed of the CSRF token, the logged-in
 *    user's display name, and any literal occurrence of the username.
 *  - Runs exactly ONE exam (40 questions) with a small delay between
 *    submissions — no retry storms.
 *
 * Run: pnpm --filter @perminou/scraper capture-fixtures
 *  (or: npx tsx apps/scraper/scripts/capture-fixtures.ts, from the repo root)
 */
import { chromium } from 'playwright';
import { config as loadEnv } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

loadEnv({ path: path.join(REPO_ROOT, '.env') });

const BASE_URL = 'https://perminou.narsa.gov.ma';
const SIGNIN_URL = `${BASE_URL}/accounts/signin/`;
const EXAM_URL = `${BASE_URL}/quizexamenblanc/take/`;
const QUESTIONS_PER_EXAM = 40;
const SAFETY_MAX_ROUNDS = QUESTIONS_PER_EXAM + 5; // buffer for an extra "view correction" hop
const GENTLE_DELAY_MS = 400;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Scrub CSRF token values, the user's display name, the account id, and the literal username from captured HTML. */
function scrub(html: string, username: string | undefined): string {
  let out = html.replace(
    /<input\b[^>]*name=["']csrfmiddlewaretoken["'][^>]*>/gi,
    (tag) => tag.replace(/value=["'][^"']*["']/i, 'value="SCRUBBED"'),
  );
  // "Bonjour" greeting followed by the user's display name (up to the next tag).
  out = out.replace(/Bonjour\s*:?\s*[^<\n]+/gi, 'Bonjour : SCRUBBED');
  // Internal account id embedded in links/paths, e.g. "/accounts/1234/".
  out = out.replace(/\/accounts\/\d+\//g, '/accounts/SCRUBBED/');
  if (username) {
    out = out.split(username).join('SCRUBBED');
  }
  return out;
}

async function ensureFixturesDir(): Promise<void> {
  await mkdir(FIXTURES_DIR, { recursive: true });
}

async function main(): Promise<void> {
  const username = process.env.NARSA_USERNAME;
  const password = process.env.NARSA_PASSWORD;
  if (!username || !password) {
    console.error('BLOCKED: NARSA_USERNAME / NARSA_PASSWORD not set in .env');
    process.exit(1);
  }

  await ensureFixturesDir();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();

  try {
    // --- Login ---
    console.log('Navigating to sign-in page...');
    await page.goto(SIGNIN_URL, { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);

    const submit = page
      .locator('form:has(input[name="password"]) button[type="submit"], form:has(input[name="password"]) input[type="submit"]')
      .first();
    if (await submit.count()) {
      await submit.click();
    } else {
      await page.locator('input[name="password"]').press('Enter');
    }
    await page.waitForLoadState('domcontentloaded');

    if (page.url().includes('/accounts/signin/')) {
      console.error('BLOCKED: still on sign-in page after submitting credentials — login failed (bad selector or bad creds?).');
      const snippet = (await page.content()).slice(0, 800);
      console.error('DOM snippet (no creds):', snippet.replace(/value=["'][^"']*["']/gi, 'value="..."'));
      process.exit(1);
    }
    console.log('Logged in.');

    // --- Exam loop ---
    console.log('Navigating to exam...');
    await page.goto(EXAM_URL, { waitUntil: 'domcontentloaded' });

    let questionFixtureSaved = false;
    let round = 0;

    while (round < SAFETY_MAX_ROUNDS) {
      round += 1;
      const html = await page.content();
      const hasAnswers = await page.locator('input[name="answers"]').count();

      if (hasAnswers === 0) {
        // No more answer checkboxes — treat this as the correction page.
        const scrubbed = scrub(html, username);
        await writeFile(path.join(FIXTURES_DIR, 'exam-correction.html'), scrubbed, 'utf8');
        console.log('correction captured');
        return;
      }

      if (!questionFixtureSaved) {
        const scrubbed = scrub(html, username);
        await writeFile(path.join(FIXTURES_DIR, 'exam-question.html'), scrubbed, 'utf8');
        questionFixtureSaved = true;
        console.log('exam question fixture saved');
      }

      // Tick the first checkbox answer.
      await page.locator('input[name="answers"]').first().check();

      const valider = page.locator('input[value="Valider"]').first();
      await valider.click();
      await page.waitForLoadState('domcontentloaded');

      console.log(`question ${Math.min(round, QUESTIONS_PER_EXAM)}/${QUESTIONS_PER_EXAM}`);
      await sleep(GENTLE_DELAY_MS);
    }

    console.error(`BLOCKED: exceeded ${SAFETY_MAX_ROUNDS} rounds without reaching a correction page.`);
    process.exit(1);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((err) => {
  console.error('BLOCKED: capture script failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
