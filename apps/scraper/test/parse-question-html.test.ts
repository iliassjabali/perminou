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
  expect(q.id).toBe(100);
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
