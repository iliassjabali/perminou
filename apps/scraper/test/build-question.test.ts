import { test, expect } from 'vitest';
import { Effect } from 'effect';
import { buildQuestion } from '../src/domain/build-question';

const raw = { id: '565', category: 'B', hasImage: true, hasAudio: true,
  answers: [ { narsaId: 933, index: 1 }, { narsaId: 934, index: 2 }, { narsaId: 935, index: 3 }, { narsaId: 936, index: 4 } ] };

test('marks the correct answer set from the correction by index, not narsaId', async () => {
  // The correction reveals the correct answer's 1-based *index* (its on-page
  // position); it never exposes the answer's own narsaId. Indexes 1 and 3
  // correspond to narsaId 933 and 935 here.
  const q = await Effect.runPromise(buildQuestion(raw as never, [1, 3]));
  expect(q.answers.filter((a) => a.correct).map((a) => a.narsaId)).toEqual([933, 935]);
});
test('fails typed when a correct index is not among the answers', async () => {
  const exit = await Effect.runPromiseExit(buildQuestion(raw as never, [99]));
  expect(exit._tag).toBe('Failure'); // ScrapeShapeError — correction/answers mismatch
});
test('supports alphanumeric signage question ids', async () => {
  const signage = { ...raw, id: 'IS014' };
  const q = await Effect.runPromise(buildQuestion(signage as never, [1]));
  expect(q.id).toBe('IS014');
});
