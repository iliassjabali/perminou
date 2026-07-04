import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Effect } from 'effect';
import { parseQuestionHtml } from '../src/adapters/parse-question-html';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '../fixtures/exam-question.html'), 'utf8');

test('extracts id, category, media flags, and answers from a recorded exam question', async () => {
  const q = await Effect.runPromise(parseQuestionHtml(html));
  expect(q.id).toBe('100');
  expect(q.category).toBe('B');
  expect(q.hasImage).toBe(true);
  expect(q.hasAudio).toBe(true);
  expect(q.answers).toEqual([
    { narsaId: 2226, index: 1 },
    { narsaId: 2227, index: 2 },
  ]);
});

test('fails typed when no question id can be found in the media urls', async () => {
  const exit = await Effect.runPromiseExit(parseQuestionHtml('<html><body>no media here</body></html>'));
  expect(exit._tag).toBe('Failure');
});

test('keeps an alphanumeric signage question id instead of failing loud', async () => {
  const signageHtml = `<html><body>
    <img src="/media/uploads/questions/images/fr/IS014.png">
    <div class="categorie-content"><span class="font-text">B</span></div>
    <input name="answers" value="1">
    <input name="answers" value="2">
  </body></html>`;
  const q = await Effect.runPromise(parseQuestionHtml(signageHtml));
  expect(q.id).toBe('IS014');
});

test('matches a .gif question image and extracts the id before the extension', async () => {
  const gifHtml = `<html><body>
    <img src="/media/uploads/questions/images/fr/234.gif">
    <div class="categorie-content"><span class="font-text">B</span></div>
    <input name="answers" value="1">
    <input name="answers" value="2">
  </body></html>`;
  const q = await Effect.runPromise(parseQuestionHtml(gifHtml));
  expect(q.id).toBe('234');
  expect(q.hasImage).toBe(true);
});
