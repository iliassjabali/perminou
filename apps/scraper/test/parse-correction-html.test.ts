import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Effect } from 'effect';
import { parseCorrectionHtml } from '../src/adapters/parse-correction-html';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '../fixtures/exam-correction.html'), 'utf8');

test('extracts the correct answer index set per NARSA question id from a recorded correction page', async () => {
  const { correctByQuestion } = await Effect.runPromise(parseCorrectionHtml(html));

  // 40 question slots in the correction; 4 carry non-numeric NARSA ids
  // (IS014, IS040, ISR003, ISR001 — a "code"/special-signage sub-bank outside
  // the numeric-id assumption) and are skipped: see fixtures/README.md.
  expect(Object.keys(correctByQuestion)).toHaveLength(36);

  expect(correctByQuestion[416]).toEqual([1]);
  expect(correctByQuestion[101]).toEqual([2]);
  expect(correctByQuestion[146]).toEqual([1, 2]); // multi-select correction
  expect(correctByQuestion[473]).toEqual([2, 3, 4]);
  expect(correctByQuestion[100]).toEqual([1]);
});

test('fails typed when no correction blocks are found', async () => {
  const exit = await Effect.runPromiseExit(parseCorrectionHtml('<html><body>not a correction page</body></html>'));
  expect(exit._tag).toBe('Failure');
});
